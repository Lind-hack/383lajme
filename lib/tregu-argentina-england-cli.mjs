import { buildArgentinaEnglandDraft } from "./tregu-three-outcome.mjs";

export const ARGENTINA_ENGLAND_EVENT_ID = "760515";
export const ESPN_SUMMARY_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${ARGENTINA_ENGLAND_EVENT_ID}`;
export const ESPN_SCHEDULE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260715";
export const DRAFTKINGS_SOCCER_URL = "https://sportsbook.draftkings.com/leagues/soccer";

function normalizedLabel(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z]+/g, " ").trim();
}

function outcomeKey(label) {
  const value = normalizedLabel(label);
  if (value === "england") return "england";
  if (value === "argentina") return "argentina";
  if (value === "draw" || value === "tie") return "draw";
  return null;
}

function decimalOdds(outcome) {
  const decimal = Number(outcome?.decimalOdds ?? outcome?.decimal_odds ?? outcome?.oddsDecimal);
  if (Number.isFinite(decimal) && decimal > 1) return decimal;
  const american = Number(outcome?.americanOdds ?? outcome?.american_odds);
  if (!Number.isFinite(american) || american === 0) return Number.NaN;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

/** Refuses generic match-winner, extra-time, or missing-draw feeds rather than inferring a draw. */
export function extractVerifiedFullTimeThreeWayOdds(data) {
  const marketName = String(data?.marketName ?? data?.market_name ?? data?.name ?? "").trim();
  const eventName = String(data?.event ?? data?.eventName ?? data?.event_name ?? "").toLowerCase();
  if (!eventName.includes("england") || !eventName.includes("argentina")) throw new Error("DraftKings market is not verified for England versus Argentina.");
  if (!/(full\s*time|90\s*(?:minutes?|mins?))\b/i.test(marketName) || /extra\s*time|penalt/i.test(marketName)) {
    throw new Error("DraftKings source is not a verified full-time 1X2 market.");
  }
  const byOutcome = {};
  for (const outcome of data?.outcomes ?? []) {
    const key = outcomeKey(outcome?.label ?? outcome?.name ?? outcome?.participant);
    const price = decimalOdds(outcome);
    if (key && Number.isFinite(price) && price > 1 && byOutcome[key] === undefined) byOutcome[key] = price;
  }
  if (byOutcome.draw === undefined) throw new Error("DraftKings full-time 1X2 source lacks a draw price; refusing to derive one.");
  if (byOutcome.england === undefined || byOutcome.argentina === undefined) throw new Error("DraftKings full-time 1X2 source lacks both team prices.");
  const raw = { england: 1 / byOutcome.england, draw: 1 / byOutcome.draw, argentina: 1 / byOutcome.argentina };
  const total = raw.england + raw.draw + raw.argentina;
  return {
    market_name: marketName,
    probabilities: { england: raw.england / total, draw: raw.draw / total, argentina: raw.argentina / total },
    odds: byOutcome,
  };
}

function normalizedProbabilities(probabilities) {
  const values = [probabilities?.england, probabilities?.draw, probabilities?.argentina].map(Number);
  if (values.some((value) => !Number.isFinite(value) || value <= 0) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) throw new Error("Pre-match reference probabilities must be positive and normalized.");
  return { england: values[0], draw: values[1], argentina: values[2] };
}

export function buildArgentinaEnglandDraftFromRuntimeSources({ event, schedule, draftKings, modelReference, espnFetchedAt, now = new Date() }) {
  if (!schedule?.source_url || !espnFetchedAt) {
    throw new Error("Runtime official ESPN schedule/score source URL with timestamp is required.");
  }
  const opening = draftKings?.data ? extractVerifiedFullTimeThreeWayOdds(draftKings.data) : null;
  if (!opening && (!modelReference?.probabilities || !Array.isArray(modelReference?.cited_sources) || modelReference.cited_sources.length === 0)) {
    throw new Error("A verified full-time 1X2 source or cited Groq pre-match reference model is required.");
  }
  const reference = opening ?? { probabilities: normalizedProbabilities(modelReference.probabilities) };
  const citedSources = opening
    ? [{ title: `DraftKings ${opening.market_name}`, source: "DraftKings", url: String(draftKings.source_url), fetched_at: String(draftKings.fetched_at) }]
    : modelReference.cited_sources.map((source) => ({ title: String(source.title ?? source.source), source: String(source.source), url: String(source.url) }));
  const draft = buildArgentinaEnglandDraft({ event, verifiedNews: citedSources, openingOdds: reference, now });
  return {
    ...draft,
    pre_match_analysis: {
      opening_probabilities: reference.probabilities,
      reference_kind: opening ? "bookmaker_full_time_1x2" : "groq_pre_match_reference_model",
      bookmaker_odds_available: Boolean(opening),
      sources: [
        { kind: "espn_event", source: "ESPN", url: String(event.source_url), fetched_at: String(espnFetchedAt) },
        { kind: "espn_schedule_score", source: "ESPN", url: String(schedule.source_url), fetched_at: String(espnFetchedAt) },
        ...(opening ? [{ kind: "draftkings_full_time_1x2", source: "DraftKings", url: String(draftKings.source_url), fetched_at: String(draftKings.fetched_at), market_name: opening.market_name, odds: opening.odds }]
          : [{ kind: "groq_pre_match_reference_model", source: "Groq", model: String(modelReference.model), cited_sources: modelReference.cited_sources }]),
      ],
    },
  };
}

/** The command must never write unless its caller explicitly supplies --apply. */
export function buildArgentinaEnglandSubmission({ args = [], draft }) {
  const apply = args.includes("--apply") && args.includes("--open");
  return { apply, body: apply ? { draft, dryRun: false, open: true } : { draft, dryRun: true } };
}

function parseDraftKingsPayload(text) {
  try { return JSON.parse(text); } catch { /* page may be HTML with embedded state */ }
  const scripts = [...String(text).matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  for (const script of scripts) {
    try { return JSON.parse(script); } catch { /* try the next explicit JSON script */ }
  }
  throw new Error("DraftKings response did not contain a parseable structured odds payload.");
}

function findMarket(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) { const result = findMarket(item); if (result) return result; }
    return null;
  }
  if (Array.isArray(node.outcomes) && (node.marketName || node.market_name || node.name)) {
    try { extractVerifiedFullTimeThreeWayOdds(node); return node; } catch { /* keep searching for a verified 1X2 market */ }
  }
  for (const value of Object.values(node)) { const result = findMarket(value); if (result) return result; }
  return null;
}

function eventFromEspnSummary(body) {
  const competition = body?.header?.competitions?.[0];
  return {
    provider: "espn", event_id: ARGENTINA_ENGLAND_EVENT_ID, league: "fifa.world", date: competition?.date,
    competitors: (competition?.competitors ?? []).map((competitor) => ({ team: competitor?.team?.displayName })), source_url: ESPN_SUMMARY_URL,
  };
}

async function fetchGroqPreMatchReference({ fetchImpl, sources }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("DraftKings full-time 1X2 was unavailable and GROQ_API_KEY is required for the labeled model reference.");
  const response = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0, response_format: { type: "json_object" }, messages: [
      { role: "system", content: "Return only normalized England/Draw/Argentina pre-match probabilities using only cited official or reputable sources. Social posts are discovery only: do not use social facts, rumors, sentiment, or uncited claims." },
      { role: "user", content: JSON.stringify({ event: "England vs Argentina, ESPN 760515", cited_sources: sources, required_json: { england: "number", draw: "number", argentina: "number" } }) },
    ] }),
  });
  if (!response.ok) throw new Error(`Groq pre-match reference returned ${response.status}.`);
  const raw = (await response.json())?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq pre-match reference returned no content.");
  return { provider: "Groq", model: "llama-3.3-70b-versatile", probabilities: normalizedProbabilities(JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""))), cited_sources: sources };
}

/** Fetches ESPN plus a first-party sportsbook when available; otherwise uses only a labeled Groq reference over retained official citations. */
export async function fetchArgentinaEnglandRuntimeSources({ fetchImpl = fetch, now = new Date() } = {}) {
  const fetchedAt = now.toISOString();
  const [summaryResponse, scheduleResponse, draftKingsResponse] = await Promise.all([
    fetchImpl(ESPN_SUMMARY_URL, { headers: { accept: "application/json" }, cache: "no-store" }),
    fetchImpl(ESPN_SCHEDULE_URL, { headers: { accept: "application/json" }, cache: "no-store" }),
    fetchImpl(DRAFTKINGS_SOCCER_URL, { headers: { accept: "text/html, application/json" }, cache: "no-store" }),
  ]);
  if (!summaryResponse.ok) throw new Error(`Official ESPN event ${ARGENTINA_ENGLAND_EVENT_ID} returned ${summaryResponse.status}.`);
  if (!scheduleResponse.ok) throw new Error(`Official ESPN schedule/score source returned ${scheduleResponse.status}.`);
  const [summary, schedule, draftKingsText] = await Promise.all([summaryResponse.json(), scheduleResponse.json(), draftKingsResponse.ok ? draftKingsResponse.text() : Promise.resolve("")]);
  let candidate = null;
  try { candidate = draftKingsResponse.ok ? findMarket(parseDraftKingsPayload(draftKingsText)) : null; } catch { candidate = null; }
  const officialSources = [
    { source: "ESPN", title: "Official ESPN event", url: ESPN_SUMMARY_URL },
    { source: "ESPN", title: "Official ESPN schedule and score", url: ESPN_SCHEDULE_URL },
  ];
  const modelReference = candidate ? null : await fetchGroqPreMatchReference({ fetchImpl, sources: officialSources });
  return {
    event: eventFromEspnSummary(summary),
    schedule: { source_url: ESPN_SCHEDULE_URL, fetched_at: fetchedAt, data: schedule },
    draftKings: candidate ? { source_url: DRAFTKINGS_SOCCER_URL, fetched_at: fetchedAt, data: candidate } : null,
    modelReference,
    espnFetchedAt: fetchedAt,
  };
}

export async function runArgentinaEnglandCli({ args = process.argv.slice(2), fetchImpl = fetch, write = console.log, post = fetch, now = new Date() } = {}) {
  const sources = await fetchArgentinaEnglandRuntimeSources({ fetchImpl, now });
  const draft = buildArgentinaEnglandDraftFromRuntimeSources({ ...sources, now });
  const submission = buildArgentinaEnglandSubmission({ args, draft });
  if (!submission.apply) {
    write(JSON.stringify({ ok: true, preview: true, created: 0, draft }, null, 2));
    return { ok: true, preview: true, created: 0, draft };
  }
  const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
  const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
  if (!baseUrl || !secret) throw new Error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required for --apply.");
  const response = await post(`${baseUrl}/api/automation/tregu/argentina-england-draft`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify(submission.body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Argentina–England draft creation failed.");
  if (!result.skipped && result.created !== 1) throw new Error("--apply must create exactly one review-only draft.");
  write(JSON.stringify(result, null, 2));
  return result;
}
