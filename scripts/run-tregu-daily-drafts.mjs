import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dailySourcePacket, shortlistedSourceSlugs } from "../lib/tregu-daily-source-packet.mjs";
import {
  buildDailyCodexCommand,
  buildDraftReviewEmail,
  TREGU_DRAFT_REVIEW_RECIPIENT,
} from "../lib/tregu-automation.mjs";

const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
if (!baseUrl || !secret) {
  console.error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");
  process.exit(1);
}

const headers = { authorization: `Bearer ${secret}` };
const dryRun = process.argv.includes("--dry-run");
const notify = !dryRun && !process.argv.includes("--no-notify");
const manualRun = process.argv.includes("--manual");
if (dryRun && manualRun) throw new Error("Choose either --manual or --dry-run.");
const manualRunKey = manualRun
  ? `daily-drafts:manual:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}:${randomUUID().replace(/-/g, "").slice(0, 12)}`
  : null;
// Sports discovery runs independently in the two-minute sports worker.
const contextResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers });
if (!contextResponse.ok) throw new Error(`Could not load Codex draft context: ${await contextResponse.text()}`);
const { articles, activeMarkets = [], futureTemplates = [] } = await contextResponse.json();
const now = new Date();

function runDailyCodex(prompt, key, maximum, timeoutMs = 330_000) {
  const hermesBin = process.env.HERMES_BIN ?? "/opt/hermes/.venv/bin/hermes";
  const hermesHome = process.env.TREGU_DAILY_HERMES_HOME ?? "/opt/data/profiles/tregudaily";
  const configPath = join(hermesHome, "config.yaml");
  if (!existsSync(configPath) || !/^\s*reasoning_effort:\s*["']?xhigh["']?\s*(?:#.*)?$/m.test(readFileSync(configPath, "utf8"))) {
    throw new Error(`Daily Tregu Hermes profile must configure agent.reasoning_effort: xhigh at ${configPath}`);
  }
  let output;
  try {
    output = execFileSync(hermesBin, buildDailyCodexCommand(prompt, "gpt-6-luna"), {
      cwd: process.cwd(), env: { ...process.env, HERMES_HOME: hermesHome },
      encoding: "utf8", timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    // execFileSync's default error includes the entire news prompt in `spawnargs`.
    throw new Error(`Daily GPT-6 Luna xhigh request failed: ${error?.code ?? error?.signal ?? error?.status ?? "unknown"}`);
  }
  const parsed = JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!Array.isArray(parsed?.[key]) || parsed[key].length > maximum) throw new Error(`Daily GPT-6 Luna returned an invalid ${key} set`);
  return { [key === "topics" ? "topics" : "candidates"]: parsed[key], provider: "openai-codex-oauth", model: "gpt-6-luna", reasoning_effort: "xhigh", fallback_reason: null };
}

// Stage one of two. Asking for discovery, filtering and the full ten-field contract in
// a single reply made gpt-oss-120b return an empty markets array on every run from
// 2026-08-28 onward. Naming candidate topics is a task it can complete; stage two then
// only has to write contracts for topics that are already vetted. No quality gate moves.
const shortlistPrompt = `You are scanning Kosovo, Albania and world news for prediction-market topics.

From the verified articles below, name up to 10 topics whose outcome is genuinely still UNDECIDED and can be resolved by a named authority between 8 hours and 90 days from now. Search for three useful market shapes: (1) scheduled decisions and releases; (2) measurable thresholds from a named official dataset; (3) consequential actions that may or may not happen by a clearly labelled editorial cutoff of at most 14 days. An editorial cutoff is our market rule, not a claim that an authority scheduled a decision then.

A topic qualifies only if:
- the article reports a live dispute, upcoming vote, ruling, appointment, threshold or decision — not something already settled;
- an informed person could reasonably disagree today about how it ends;
- it matters to many people (public affairs, household economy, energy, prices, courts, elections, major geopolitics or technology policy);
- at least two DIFFERENT publishers cover it, counting vetted corroboratingSources attached to a newsroom article, OR one article is the named authority's own official publication on its official domain. Cite the newsroom article slug once; corroboratingSources do not have separate slugs.

Reject: sport of any kind, routine meetings with no decision, generic announcements, minor crime, celebrity gossip, niche corporate notices, and anything whose outcome the article already establishes.

Rank promising topics by public reach, newsroom relevance score, recency, real uncertainty, and how objectively PO and JO can be verified. A Kosovo or Albania story with clear public consequences can outrank a niche world story. Do not force a fixed geography mix. Topic keys must be stable identities without dates. Do not write market questions. Do not invent facts. Name topics only.
Skip any topic already listed as active below.

Current time: ${now.toISOString()}

Already-active topics to skip:
${JSON.stringify(activeMarkets)}

Verified source articles:
${JSON.stringify(dailySourcePacket(articles))}

Return ONLY compact JSON, no markdown:
{"topics":[{"topic_key":"kebab-case-stable-identity","decision":"the concrete fork in one sentence","yes_path":"...","no_path":"...","resolution_source":"named authority","why_undecided":"...","source_slugs":["slug1","slug2"]}]}`;

const shortlist = runDailyCodex(shortlistPrompt, "topics", 10);
console.log(JSON.stringify({
  stage: "shortlist",
  provider: shortlist.provider,
  fallback_reason: shortlist.fallback_reason,
  topic_count: shortlist.topics.length,
  topic_keys: shortlist.topics.map((topic) => topic?.topic_key ?? null),
}));

const prompt = `You are the 383 Tregu daily market editor for NON-SPORTS markets. Official football and F1 templates are created by a separate verified sports lane; never propose sport markets here.

Stage one already shortlisted the topics listed below from these same verified articles. You are no longer searching for topics: your job is to write the full market contract for those that genuinely qualify. Drop any shortlisted topic that fails a quality rule, and return at most 6. Prefer major Kosovo, Albania and world developments that people widely discuss, with a verifiable outcome within 8 hours to 90 days.

SHORTLISTED TOPICS (write contracts for these):
${JSON.stringify(shortlist.topics)}

MANDATORY MARKET CONTRACT (all fields are required):
- market_archetype: one of scheduled_decision, threshold, data_release, policy_action, appointment_or_selection, escalation_or_deescalation, corporate_decision, executive_action.
- topic_key: a stable lowercase kebab-case identity for the underlying topic, not the date and not a sentence. It must not match any active topic below.
- decision_point: the concrete fork traders are pricing, including the two plausible paths.
- why_uncertain: the current evidence for both paths and what new information could move the price. Do not write generic filler.
- trading_angle: why an informed trader could reasonably disagree today.
- resolution_source: the named institution, official dataset, court, election authority, or other authoritative source that determines the result.
- deadline_basis: identify either a documented event/release/decision date or a plainly labelled editorial cutoff. For an editorial cutoff explain why 2-14 days is a meaningful window for this live story; never present it as an officially scheduled date.
- resolution_criteria: explicit PO and JO rules, named source, exact deadline, and edge cases such as postponement, partial action, revised data, or no decision.

QUALITY RULES:
1. Use ONLY the supplied verified articles and never invent facts, sources, dates, thresholds, meetings, or outcomes.
2. Prefer high-interest Kosovo/region public affairs, household economy/energy/prices, major geopolitics, major technology policy, courts, elections, or decisions affecting many people. Reject niche corporate news, routine notices, minor crime, obscure logistics, and ordinary celebrity gossip.
3. Do not create a headline restatement. Reject any topic whose supplied source has already established the proposed PO outcome. Do not ask whether an already-reported arrest, signing, meeting, arrival, death, victory, or announcement will be confirmed.
4. Never create meeting-only, generic announcement, generic “will X happen?”, or “will institution confirm what the article says?” markets. A meeting is eligible only when it contains a consequential decision, vote, ruling, appointment, agreement, or measurable outcome.
5. Prefer a real threshold or decision: a named vote/ruling, a measurable public number, a policy taking effect, a selection/appointment, or a clearly defined escalation/de-escalation condition. For threshold/data_release, include the numeric threshold in the question and threshold_value.
6. Write a concise Albanian question ending with ?. Do not mechanically start with A do të. Set closes_in_hours between 8 and 2160 (8 hours–90 days). For scheduled events use the documented time. For an unscheduled but consequential action, choose a 2-14 day editorial cutoff, state its exact date/time and timezone in the resolution criteria, and use deadline_occurrence. Do not imply the editorial cutoff is an official deadline. Do not use closes_in_days.
7. Prefer explicit competing events such as approval versus rejection. For event_pair markets, the date is a review date, not an automatic JO outcome. Neither event verified means pause_for_review. If JO means no signed agreement or no occurrence by a deadline (including "Mungesa ... brenda afatit"), use deadline_occurrence instead. Never label that contract event_pair. An editorial cutoff works only for a concrete occurrence that can be checked by a named authority; no occurrence by that cutoff is JO after review.
8. Require two independent publishers, including vetted corroboratingSources attached to one newsroom article, or a direct article on the named authority's official domain. Copy newsroom article slugs exactly; corroboratingSources have no slugs. Name the authoritative resolution source and explain why the topic is widely discussed.
9. Never repeat an active topic or near-identical question. Return fewer than three markets, including zero, when only fewer pass all quality gates.
10. Every market requires contract_version: news-event-v3 and proposition: {entities: [named entities], geography: Kosovo|Albania|World, decision: concrete fork, yes_condition: explicit winning event, no_condition: explicit losing event, resolution_source: named authority, resolution_mode: event_pair|deadline_occurrence, review_policy: pause_for_review}. Event-pair JO must be a real event, not absence of PO by a date.
11. Assign two independent labels: proposition.geography is Kosovo, Albania, or World; news_topic is politike, ekonomi, shoqeri, siguri, or teknologji. Kosovo/Albania/World describe where the outcome is decided, while topic describes the subject. A Kosovo economy story is Kosovo + ekonomi. Do not force an equal number of markets into each label; publish only candidates with strong evidence.

Good shapes (illustrative only; never copy facts):
- a named parliament/court/central bank decision with two plausible outcomes;
- a public count, price, rate, or threshold that can cross a stated number before the deadline;
- a formal appointment, removal, acquisition, agreement, or escalation whose outcome is still disputed.
Bad shapes: “will the article’s event be confirmed?”, a routine meeting, a generic announcement, or a result that the source has already established.

Current time: ${now.toISOString()}
Active non-sports markets to avoid:
${JSON.stringify(activeMarkets)}

Verified source articles (each includes source, URL, excerpt, and bounded body):
${JSON.stringify(dailySourcePacket(articles, { citedSlugs: shortlistedSourceSlugs(shortlist.topics) }))}

Return ONLY compact JSON, with no markdown:
{"markets":[{"question":"...","description":"current state plus the unresolved fork","resolution_criteria":"PO: ... JO: ... Burimi i zgjidhjes: ... Afati: ... Edge cases: ...","category":"kosove|shqiperi|ekonomi|bote|te-tjera","news_topic":"politike|ekonomi|shoqeri|siguri|teknologji","contract_version":"news-event-v3","closes_in_hours":48,"proposition":{"entities":["..."],"geography":"Kosovo","decision":"...","yes_condition":"...","no_condition":"...","resolution_source":"...","resolution_mode":"event_pair","review_policy":"pause_for_review"},"market_archetype":"scheduled_decision|threshold|data_release|policy_action|appointment_or_selection|escalation_or_deescalation|corporate_decision|executive_action","topic_key":"topic-name","decision_point":"...","why_uncertain":"...","trading_angle":"...","resolution_source":"...","deadline_basis":"...","threshold_value":"...","source_slugs":["slug1","slug2"]}]}`;


// An empty shortlist means stage one found nothing undecided worth pricing. That is a
// legitimate outcome, and spending a second provider call to confirm it is waste.
const generation = shortlist.topics.length
  ? runDailyCodex(prompt, "markets", 6, 720_000)
  : { candidates: [], provider: shortlist.provider, fallback_reason: "empty_shortlist" };
const candidates = generation.candidates;
console.log(JSON.stringify({ stage: "generation", provider: generation.provider, fallback_reason: generation.fallback_reason, shortlisted: shortlist.topics.length, candidate_count: candidates.length }));
const submitResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, {
  method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ candidates, ...(dryRun ? { dryRun: true } : {}), ...(manualRunKey ? { runKey: manualRunKey } : {}) }),
});
const result = await submitResponse.json();
if (!submitResponse.ok) throw new Error(result.error ?? "Daily draft submission failed.");
if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    created: 0,
    model_candidate_count: Array.isArray(candidates) ? candidates.length : 0,
    model_candidates: Array.isArray(candidates) ? candidates.map((candidate) => ({
      question: candidate?.question ?? "",
      market_archetype: candidate?.market_archetype ?? null,
      topic_key: candidate?.topic_key ?? null,
      closes_in_hours: candidate?.closes_in_hours ?? null,
    })) : [],
    accepted_count: result.accepted_count ?? (result.markets ?? []).length,
    rejected_count: result.rejected_count ?? (result.rejected ?? []).length,
    no_publish_reason: result.no_publish_reason ?? null,
    accepted: result.markets ?? [],
    rejected: result.rejected ?? [],
  }, null, 2));
  process.exit(0);
}
const receiptMarkerDir = process.env.TREGU_RECEIPT_MARKER_DIR ?? "/opt/data/linear-hermes-bridge/state/tregu-receipts";
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
const sendReceipt = ({ subject, html, markerKey }) => {
  if (!notify) return;
  mkdirSync(receiptMarkerDir, { recursive: true, mode: 0o700 });
  const safeKey = String(markerKey).replace(/[^A-Za-z0-9_.-]/g, "_");
  const marker = join(receiptMarkerDir, `${safeKey}.sent`);
  if (existsSync(marker)) {
    console.log(`TREGU RECEIPT ALREADY SENT runKey=${result.runKey}`);
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), "tregu-drafts-"));
  const htmlFile = join(directory, "receipt.html");
  try {
    writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 });
    execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", subject, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" });
    writeFileSync(marker, `${new Date().toISOString()}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(`TREGU RECEIPT SENT runKey=${result.runKey} recipient=${TREGU_DRAFT_REVIEW_RECIPIENT}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
};

if (!result.skipped && result.created > 0) {
  const html = buildDraftReviewEmail({ appUrl: baseUrl, reviewPath: `/admin/tregu/review?drafts=${encodeURIComponent(result.runKey)}`, markets: result.markets });
  sendReceipt({ subject: `383 Tregu — ${result.created} draftet e reja — PASSED`, html, markerKey: `${result.runKey}-drafts` });
} else {
  const state = result.reason === "already_processed" ? "SUCCEEDED — already processed safely" : "SUCCEEDED — no qualifying news market";
  const reviewUrl = `${baseUrl}/admin/tregu/review?drafts=${encodeURIComponent(result.runKey ?? "")}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a"><main style="max-width:680px;margin:auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:24px"><h1 style="margin-top:0">383 Tregu — execution receipt</h1><p><strong>Status:</strong> ${escapeHtml(state)}</p><p><strong>Run key:</strong> <code>${escapeHtml(result.runKey)}</code></p><p><strong>Created:</strong> ${escapeHtml(result.created)}</p><p><strong>Topics shortlisted:</strong> ${escapeHtml(shortlist.topics.length)}</p><p><strong>Contracts proposed:</strong> ${escapeHtml(candidates.length)}</p><p><strong>Reason:</strong> ${escapeHtml(result.no_publish_reason ?? result.reason ?? "none")}</p><p>This confirms that the Tregu creation endpoint ran successfully and did not create duplicates.</p><p><a href="${escapeHtml(reviewUrl)}">Open Tregu review</a></p></main></body></html>`;
  sendReceipt({ subject: `383 Tregu — PASSED — ${result.reason === "already_processed" ? "already processed" : "no eligible markets"}`, html, markerKey: `${result.runKey}-receipt` });
}
if (notify && Array.isArray(futureTemplates) && futureTemplates.length) {
  const cards = futureTemplates.map((market) => `<article style="border:1px solid #fed7aa;border-radius:12px;padding:18px;margin:0 0 14px"><p style="margin:0 0 8px;color:#c2410c;font-weight:700;letter-spacing:1px">${String(market.market_classification ?? "LIVE SPORT").toUpperCase()} · REVIEW-ONLY TEMPLATE</p><h2 style="margin:0 0 8px">${String(market.question ?? "F1 race")}</h2><p>${String(market.description ?? "")}</p><p><b>${Array.isArray(market.sport_outcomes) ? market.sport_outcomes.length : 0} drivers</b> · review roster and grid before approval.</p><a href="${baseUrl}/admin/tregu" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:7px;text-decoration:none">Open Admin review</a></article>`).join("");
  const html = `<!doctype html><html><body style="font-family:Arial;background:#fff7ed;padding:24px"><h1>383 Tregu — F1 race awaiting approval</h1>${cards}</body></html>`;
  const directory = mkdtempSync(join(tmpdir(), "tregu-f1-")); const htmlFile = join(directory, "review.html");
  try { writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 }); execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", `383 Tregu — ${futureTemplates.length} F1 template awaiting approval`, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" }); const mark = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { method:"POST", headers:{...headers,"content-type":"application/json"}, body:JSON.stringify({ markTemplateIds:futureTemplates.map((m)=>m.id) }) }); if(!mark.ok) throw new Error(`Could not mark F1 template email: ${await mark.text()}`); } finally { rmSync(directory,{recursive:true,force:true}); }
}
console.log(JSON.stringify({ ok: true, skipped: result.skipped, created: result.created, runKey: result.runKey, no_publish_reason: result.no_publish_reason ?? null, receipt_notification: notify }));
