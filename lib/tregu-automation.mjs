import { kosovoLocalDate } from "./tregu-date-key.mjs";

const CATEGORY_TO_ARTICLE_CATEGORY = {
  politike: ["Politikë", "Siguri", "Shoqëri"],
  ekonomi: ["Ekonomi"],
  sport: ["Sport"],
  bote: ["Botë", "Diaspora"],
  "te-tjera": [],
};

function normalizedQuestion(question) {
  return String(question ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function draftViolation(candidate) {
  const question = String(candidate?.question ?? "").trim();
  const description = String(candidate?.description ?? "").trim();
  const resolutionCriteria = String(candidate?.resolution_criteria ?? "").trim();
  const sourceSlugs = Array.isArray(candidate?.source_slugs) ? candidate.source_slugs.filter(Boolean) : [];
  const liveEvent = candidate?.live_event;
  const closesInHours = Number(candidate?.closes_in_hours);
  const closesInDays = Number(candidate?.closes_in_days);
  if (question.length < 18 || question.length > 110 || !question.endsWith("?")) return "Çdo draft duhet të ketë titull të shkurtër, Polymarket-style.";
  if (/^a\s+do\s+t[ëe](?:\s|$)/i.test(question)) return "Titulli nuk mund të fillojë mekanikisht me 'A do të'.";
  if (!/deri\s+m[ëe]\s+\d{1,2}\s+\p{L}+/iu.test(question)) return "Çdo draft duhet të ketë afat konkret në titull.";
  if (description.length < 20) return "Çdo draft duhet të ketë përmbledhje të plotë.";
  if (resolutionCriteria.length < 40) return "Çdo draft duhet të ketë kritere konkrete zgjidhjeje dhe burim.";
  const isOfficialLiveEvent = liveEvent?.provider === "espn" && String(liveEvent?.event_id ?? "").trim() && String(liveEvent?.yes_team ?? "").trim() && String(liveEvent?.league ?? "").trim();
  if (sourceSlugs.length === 0 && !isOfficialLiveEvent) return "Çdo draft duhet të përdorë burime të cituara.";
  if (isOfficialLiveEvent) {
    if (!Number.isFinite(new Date(candidate?.closes_at).getTime())) return "Tregu live duhet të ketë kohë mbylljeje rezervë.";
  } else if (Number.isFinite(closesInHours)) {
    if (closesInHours < 2 || closesInHours > 48) return "Draftet e lajmeve të fundit duhet të mbyllen brenda 2 deri në 48 orë.";
  } else if (!Number.isFinite(closesInDays) || closesInDays < 2) return "Draftet e lajmeve të fundit duhet të mbyllen brenda 2 deri në 48 orë.";
  if (closesInDays > 48 && String(candidate?.long_duration_reason ?? "").trim().length < 20) return "Afatet mbi 48 orë kërkojnë arsye objektive të dokumentuar.";
  return null;
}

function isHighQualityCandidate(candidate) {
  return draftViolation(candidate) === null;
}

const TREGU_CATEGORIES = new Set(["politike", "ekonomi", "sport", "bote", "te-tjera"]);

export const TREGU_DRAFT_REVIEW_RECIPIENT = "lindsylqa@gmail.com";

/** Daily drafts must use the VPS OpenAI Codex OAuth profile, not an ambient provider. */
export function buildDailyCodexCommand(prompt) {
  return ["chat", "-Q", "--provider", "openai-codex", "--model", "gpt-5.6-terra", "--toolsets", "safe", "-q", prompt];
}

/** The root Codex OAuth caller generates candidates; the app accepts only this bounded payload. */
export function validateDailyDraftSubmission(candidates, knownSourceSlugs) {
  if (!Array.isArray(candidates) || candidates.length < 3 || candidates.length > 5) {
    return { ok: false, error: "Duhet të dorëzohen 3 deri në 5 tregje draft." };
  }
  const seen = new Set();
  for (const candidate of candidates) {
    const question = String(candidate?.question ?? "").trim();
    const sourceSlugs = Array.isArray(candidate?.source_slugs) ? candidate.source_slugs.filter(Boolean).map(String) : [];
    const violation = draftViolation(candidate);
    if (violation || !TREGU_CATEGORIES.has(candidate?.category)) return { ok: false, error: violation ?? "Çdo draft duhet të ketë kategori të vlefshme." };
    const key = normalizedQuestion(question);
    if (seen.has(key)) return { ok: false, error: "Draftet nuk mund të përsërisin të njëjtën pyetje." };
    seen.add(key);
    if (sourceSlugs.some((slug) => !knownSourceSlugs.has(slug))) return { ok: false, error: "Çdo draft duhet të përdorë vetëm burime të cituara e të verifikuara." };
  }
  return { ok: true, candidates };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Email has review links only: GET never carries an action or changes state. */
export function buildDraftReviewEmail({ appUrl, reviewPath, markets }) {
  const reviewUrl = `${String(appUrl).replace(/\/$/, "")}${reviewPath}`;
  const labels = { politike: "Politikë", ekonomi: "Ekonomi", sport: "Sport", bote: "Botë", "te-tjera": "Të tjera" };
  const cards = (markets ?? []).map((market) => {
    const evidence = (market.evidence ?? []).map((article) => escapeHtml(article.title || article.slug)).join(" · ") || (market.source_article_slugs ?? []).map(escapeHtml).join(" · ");
    const closesAt = new Date(market.closes_at).toLocaleDateString("sq-AL");
    return `<tr><td bgcolor="#FFFFFF" style="padding:0 0 18px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;border:1px solid #CBD5E1;border-collapse:separate;border-radius:12px;background-color:#FFFFFF"><tr><td style="padding:22px"><p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#334155">${escapeHtml(labels[market.category] ?? market.category)} &middot; Mbyllet ${escapeHtml(closesAt)}</p><h2 style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:29px;color:#111827">${escapeHtml(market.question)}</h2><p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#1F2937">${escapeHtml(market.description)}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#166534" style="padding:7px 14px;border-radius:999px;background-color:#166534"><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#FFFFFF">PO</span></td><td style="width:8px">&nbsp;</td><td bgcolor="#E2E8F0" style="padding:7px 14px;border-radius:999px;background-color:#E2E8F0"><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#111827">JO</span></td></tr></table><p style="margin:16px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#334155"><strong style="color:#111827">Burime / prova:</strong> ${evidence}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0F172A" style="border-radius:6px;background-color:#0F172A"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:11px 15px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:18px;color:#FFFFFF;text-decoration:none">Hap rishikimin</a></td></tr></table></td></tr></table></td></tr>`;
  }).join("");
  return `<!doctype html><html><body bgcolor="#E5E7EB" style="margin:0;padding:0;background-color:#E5E7EB"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E5E7EB" style="width:100%;background-color:#E5E7EB"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px"><tr><td bgcolor="#0F172A" style="padding:26px 24px;border-radius:12px 12px 0 0;background-color:#0F172A"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:34px;color:#FFFFFF">383 Tregu — draftet e reja</h1><p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#E2E8F0">Asnjë treg nuk hapet automatikisht. Hap rishikimin, kyçu si admin dhe konfirmo veprimin me POST.</p></td></tr><tr><td bgcolor="#FFFFFF" style="padding:18px 18px 0 18px;background-color:#FFFFFF">${cards}</td></tr></table></td></tr></table></body></html>`;
}

const ALBANIAN_MONTHS = { janar: 1, shkurt: 2, mars: 3, prill: 4, maj: 5, qershor: 6, korrik: 7, gusht: 8, shtator: 9, tetor: 10, nentor: 11, nëntor: 11, dhjetor: 12 };
function dateOnlyDeadline(question, criteria, now) {
  const text = `${String(question ?? "")} ${String(criteria ?? "")}`.toLowerCase();
  const match = text.match(/deri\s+m[eë]\s+(\d{1,2})\s+(janar|shkurt|mars|prill|maj|qershor|korrik|gusht|shtator|tetor|nentor|nëntor|dhjetor)(?:\s+(\d{4}))?/i);
  if (!match) return null;
  const year = Number(match[3] ?? now.getUTCFullYear());
  const month = ALBANIAN_MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  // Europe/Pristina is UTC+2 during the relevant summer deadline period.
  return new Date(Date.UTC(year, month - 1, Number(match[1]), 21, 59, 59, 999)).toISOString();
}

export function buildDailyDraftPlan({ candidates, existingQuestions, now }) {
  const seen = new Set((existingQuestions ?? []).map(normalizedQuestion));
  const rows = [];
  const rejected = [];

  for (const candidate of candidates ?? []) {
    const key = normalizedQuestion(candidate?.question);
    if (!isHighQualityCandidate(candidate)) {
      rejected.push({ question: candidate?.question ?? "", reason: "not_high_quality" });
      continue;
    }
    if (seen.has(key)) {
      rejected.push({ question: candidate.question, reason: "duplicate_question" });
      continue;
    }
    seen.add(key);
    rows.push({
      question: String(candidate.question).trim(),
      description: String(candidate.description).trim(),
      resolution_criteria: String(candidate.resolution_criteria).trim(),
      category: candidate.category,
      status: "draft",
      ai_generated: true,
      source_article_slugs: candidate.source_slugs.filter(Boolean),
      live_event: candidate.live_event ?? null,
      closes_at: candidate.live_event
        ? new Date(candidate.closes_at).toISOString()
        : dateOnlyDeadline(candidate.question, candidate.resolution_criteria, now)
          ?? new Date(now.getTime() + (Number.isFinite(Number(candidate.closes_in_hours)) ? Number(candidate.closes_in_hours) * 3_600_000 : Number(candidate.closes_in_days) * 86_400_000)).toISOString(),
    });
  }

  return { rows, rejected };
}

function isFinalStatus(status, detail) {
  return /(?:FINAL|POST|CANCELED|FULL_TIME)/i.test(String(status ?? ""))
    || String(detail ?? "").trim().toUpperCase() === "FT";
}

function eventStateKey(event) {
  return JSON.stringify({
    status: String(event?.status ?? ""), detail: String(event?.detail ?? ""),
    competitors: (event?.competitors ?? []).map((competitor) => ({ team: String(competitor.team), score: Number(competitor.score) })).sort((a, b) => a.team.localeCompare(b.team)),
  });
}

/** Only ESPN's official public scoreboard may produce this deterministic live signal. */
export function buildLiveScorePlan({ markets, events }) {
  const eventById = new Map((events ?? []).filter((event) => event?.provider === "espn").map((event) => [String(event.event_id), event]));
  return (markets ?? []).flatMap((market) => {
    const config = market?.live_event;
    if (market?.status !== "open" || config?.provider !== "espn") return [];
    const event = eventById.get(String(config.event_id));
    if (!event) return [];
    const state_key = eventStateKey(event);
    if (market?.live_score_state?.key === state_key) return [];
    const yes = (event.competitors ?? []).find((competitor) => String(competitor.team).toLowerCase() === String(config.yes_team).toLowerCase());
    const opponent = (event.competitors ?? []).find((competitor) => competitor !== yes);
    if (!yes || !opponent || !Number.isFinite(Number(yes.score)) || !Number.isFinite(Number(opponent.score))) return [];
    const before = lmsrProbability(market.q_yes, market.q_no, market.b);
    const goalDifference = Number(yes.score) - Number(opponent.score);
    const finalYesWins = yes.winner === true || (opponent.winner !== true && goalDifference > 0);
    const reference = isFinalStatus(event.status, event.detail) ? (finalYesWins ? 0.99 : 0.01) : Math.min(0.9, Math.max(0.1, 0.5 + Math.sign(goalDifference) * 0.15));
    const cap = 0.1;
    const marketProb = roundProbability(Math.min(before + cap, Math.max(before - cap, reference)));
    return [{
      market,
      event,
      state_key,
      close_market: isFinalStatus(event.status, event.detail),
      snapshot: {
        market_id: market.id, oracle_kind: "live_score", oracle_reasoning: `ESPN ${event.detail || event.status}: ${yes.team} ${yes.score}–${opponent.score} ${opponent.team}.`,
        reference_probability: reference, market_prob_before: roundProbability(before), market_prob: marketProb, oracle_cap: cap,
        evidence_sources: ["ESPN official scoreboard"], evidence_slugs: [`espn:${event.event_id}`],
        evidence: [{ title: `ESPN: ${yes.team} ${yes.score}–${opponent.score} ${opponent.team} (${event.detail || event.status})`, slug: `espn:${event.event_id}`, url: event.source_url }],
      },
    }];
  });
}

export function buildExactFourDraftPreview({ candidates, articles, event, now }) {
  if (!Array.isArray(candidates) || candidates.length !== 3) throw new Error("Exactly three verified-news candidates are required.");
  if (!event || String(event.event_id) !== "760514" || isFinalStatus(event.status, event.detail)) throw new Error("An active official ESPN Spain-France event is required.");
  const knownSourceSlugs = new Set((articles ?? []).map((article) => String(article.slug)));
  const validated = validateDailyDraftSubmission(candidates, knownSourceSlugs);
  if (!validated.ok) throw new Error(validated.error);
  const kickOff = new Date(event.date ?? now);
  const fallbackClose = new Date(kickOff.getTime() + 6 * 3_600_000).toISOString();
  const spainFrance = {
    question: "Franca në finale deri më 14 korrik?",
    description: "Treg live për ndeshjen France–Spain të Kupës së Botës, me sinjal vetëm nga scoreboard-i zyrtar i ESPN.",
    resolution_criteria: "PO: Franca arrin finalen vetëm nëse ESPN e shënon Francën fituese në rezultatin zyrtar përfundimtar të ndeshjes France–Spain. JO: Spanja arrin finalen ose ndeshja nuk jep fitoren e Francës. Tregu mbyllet automatikisht kur ESPN raporton FINAL.",
    category: "sport", closes_at: fallbackClose, source_slugs: [],
    live_event: { provider: "espn", event_id: "760514", yes_team: "France", league: "fifa.world" },
  };
  const allCandidates = [...candidates, spainFrance];
  const allValidated = validateDailyDraftSubmission(allCandidates, knownSourceSlugs);
  if (!allValidated.ok) throw new Error(allValidated.error);
  const plan = buildDailyDraftPlan({ candidates: allCandidates, existingQuestions: [], now });
  if (plan.rows.length !== 4) throw new Error("Exactly four unique draft cards are required.");
  return { ...plan, candidates: allCandidates };
}

/** The live-event runner has a separate idempotency key for its one official event. */
export function buildLiveEventDraftRunKey({ candidates, now = new Date() }) {
  if (!Array.isArray(candidates) || candidates.length !== 4) {
    throw new Error("Exactly four validated draft cards are required.");
  }
  const liveEvents = candidates.map((candidate) => candidate?.live_event).filter((event) => event?.provider === "espn");
  if (liveEvents.length !== 1) throw new Error("Exactly one official ESPN live event is required.");
  const eventId = String(liveEvents[0].event_id ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(eventId)) throw new Error("Live-event id must use only letters, numbers, hyphens, or underscores.");
  return `live-event-drafts:${kosovoLocalDate(now)}:${eventId}`;
}

/** The live-event runner never writes unless its caller explicitly opts in. */
export function buildLiveEventDraftSubmission({ candidates, args = [], now = new Date() }) {
  if (!Array.isArray(candidates) || candidates.length !== 4) {
    throw new Error("Exactly four validated draft cards are required.");
  }
  const apply = args.includes("--apply");
  return { apply, body: apply ? { candidates, dryRun: false, runKey: buildLiveEventDraftRunKey({ candidates, now }) } : { candidates, dryRun: true } };
}

const MARKET_STOPWORDS = new Set(["a", "do", "te", "të", "në", "ne", "e", "i", "dhe", "që", "qe", "me", "nga", "për", "per", "deri", "më", "nje", "një", "vetëm", "nëse", "gjatë", "afat", "afatit", "veror", "sipas", "will", "the", "and", "for", "with", "from", "before", "during", "only", "if", "by"]);

function researchTerms(market) {
  const raw = `${String(market?.question ?? "")} ${String(market?.resolution_criteria ?? market?.resolution_rules ?? "")}`;
  const terms = normalizedQuestion(raw).split(/\s+/).filter((term) => term.length >= 3 && !MARKET_STOPWORDS.has(term));
  return [...new Set(terms)];
}

function termStem(term) { return String(term).slice(0, Math.min(6, String(term).length)); }

function primaryEntityTokens(market) {
  const question = String(market?.question ?? "");
  // ASCII capitalized names cover club/player examples; non-ASCII-only markets
  // fail closed until an explicit profile is available.
  const phrases = question.match(/[A-Z][A-Za-z'-]{2,}(?:\s+[A-Z][A-Za-z'-]{2,})*/g) ?? [];
  const primary = phrases.sort((a, b) => b.length - a.length)[0] ?? "";
  return normalizedQuestion(primary).split(/\s+/).filter(Boolean);
}

function isMarketSpecificEvidence(market, article) {
  const terms = researchTerms(market);
  const textTerms = normalizedQuestion(`${String(article?.title ?? "")} ${String(article?.excerpt ?? "")}`).split(/\s+/);
  const textStems = new Set(textTerms.map(termStem));
  const materialNumbers = terms.filter((term) => /^\d+$/.test(term) && Number(term) >= 40 && !(Number(term) >= 1900 && Number(term) <= 2100));
  const semanticTerms = terms.filter((term) => !/^\d+$/.test(term));
  // A candidate must match at least two distinct market-specific semantic terms
  // and every material numeric constraint. Category alone is never evidence.
  const semanticMatches = new Set(semanticTerms.filter((term) => textStems.has(termStem(term))));
  const entityTokens = primaryEntityTokens(market);
  const entityMatch = entityTokens.length > 0 && entityTokens.every((term) => textStems.has(termStem(term)));
  return entityMatch && semanticMatches.size >= 2 && materialNumbers.every((term) => textTerms.includes(term));
}

function deadlineSignal(market, now) {
  const closesAt = new Date(market?.closes_at ?? "").getTime();
  if (!Number.isFinite(closesAt)) return null;
  const hoursRemaining = (closesAt - now.getTime()) / 3_600_000;
  if (hoursRemaining < 0) return { reference_probability: 0, outcome: "JO", hours_remaining: hoursRemaining, requires_deadline_oracle: true };
  // Without fresh, directly imminent evidence, a one-day action market must not
  // retain a large YES price merely because it has not closed yet.
  if (hoursRemaining <= 24) return { reference_probability: 0.05, outcome: null, hours_remaining: hoursRemaining };
  return null;
}

function relevantArticles(market, verifiedArticles) {
  const lastNewsAt = market.last_news_at ? new Date(market.last_news_at).getTime() : Number.NEGATIVE_INFINITY;
  return (verifiedArticles ?? []).filter((article) => {
    const publishedAt = new Date(article.publishedAt).getTime();
    return Number.isFinite(publishedAt) && publishedAt > lastNewsAt && !isSocialOnlyEvidence(article) && isMarketSpecificEvidence(market, article);
  });
}

function isSocialOnlyEvidence(article) {
  const source = String(article?.source ?? "").trim().toLowerCase();
  return article?.verification === "social_only" || /(^|\b)(x|twitter|facebook|instagram|tiktok|telegram|reddit)(\b|\/)/.test(source);
}

function lmsrProbability(qYes, qNo, b) {
  const yes = Math.exp(Number(qYes) / Number(b));
  const no = Math.exp(Number(qNo) / Number(b));
  return yes / (yes + no);
}

function roundProbability(probability) {
  return Number(probability.toFixed(12));
}

function sourceKey(article) {
  return String(article?.source ?? "").trim().toLocaleLowerCase() || `article:${String(article?.slug ?? "")}`;
}

/** A fresh database preflight prevents a stale open-market scan from reaching an AI provider or oracle. */
export function repriceMarketSkipReason(market, now = new Date()) {
  if (market?.status !== "open") return "skipped_closed";
  const closesAt = new Date(market?.closes_at ?? "").getTime();
  return Number.isFinite(closesAt) && closesAt <= now.getTime() ? "skipped_closed" : null;
}

export function buildRepricePlan({ markets, verifiedArticles, now = new Date() }) {
  return (markets ?? [])
    .filter((market) => market.status === "open")
    .map((market) => ({ market, evidence: relevantArticles(market, verifiedArticles), deadline: deadlineSignal(market, now) }))
    .map(({ market, evidence, deadline }) => {
      return {
        market,
        evidence,
        deadline,
        scoreFailure(error) {
          return {
            status: "open",
            snapshot: null,
            marketUpdate: { id: market.id, status: "open" },
            audit: { market_id: market.id, status: "failed", error: String(error?.message ?? error) },
          };
        },
        scoreSuccess(score) {
          const probability = Math.min(1, Math.max(0, Number(score.probability)));
          const citedFreshSlugs = (score.cited_slugs ?? []).map(String).filter((slug) => evidence.some((article) => article.slug === slug));
          const evidenceSlugs = citedFreshSlugs.length > 0 ? citedFreshSlugs : evidence.map((article) => article.slug);
          const citedEvidence = evidence.filter((article) => evidenceSlugs.includes(article.slug));
          const evidenceSources = [...new Set(citedEvidence.map(sourceKey))];
          const marketProbBefore = lmsrProbability(market.q_yes, market.q_no, market.b);
          const evidenceKind = score.evidence_level === "decisive" && evidenceSources.length >= 2 ? "decisive" : "ordinary";
          const settlementOutcome = evidenceKind === "decisive" && score.resolution_action === "settle_po"
            ? "PO"
            : evidenceKind === "decisive" && score.resolution_action === "settle_jo"
              ? "JO"
              : null;
          if (settlementOutcome) {
            return {
              status: "open",
              marketUpdate: { id: market.id, status: "open" },
              snapshot: null,
              settlement: { outcome: settlementOutcome, evidence_kind: "decisive", evidence_slugs: evidenceSlugs },
              audit: { market_id: market.id, status: "settlement_pending", error: null },
            };
          }

          // Ordinary evidence: 2pp with one publisher and 5pp with corroboration.
          // Decisive evidence: max 30pp, only with two independent cited publishers.
          const oracleCap = evidenceKind === "decisive" ? 0.30 : evidenceSources.length >= 2 ? 0.05 : 0.02;
          const marketProb = roundProbability(Math.min(marketProbBefore + oracleCap, Math.max(marketProbBefore - oracleCap, probability)));
          const targetLogOdds = Math.log(marketProb / (1 - marketProb));
          const currentLogOdds = Math.log(marketProbBefore / (1 - marketProbBefore));
          const oracleShareDelta = Number(market.b) * (targetLogOdds - currentLogOdds);
          return {
            status: "open",
            marketUpdate: {
              id: market.id,
              status: "open",
              q_yes: Number(market.q_yes) + oracleShareDelta / 2,
              q_no: Number(market.q_no) - oracleShareDelta / 2,
            },
            snapshot: {
              market_id: market.id,
              ai_prob: probability,
              reference_probability: probability,
              oracle_kind: "news_oracle",
              evidence_kind: evidenceKind,
              oracle_reasoning: String(score.reasoning ?? ""),
              evidence_slugs: evidenceSlugs,
              evidence_sources: evidenceSources,
              market_prob_before: roundProbability(marketProbBefore),
              market_prob: marketProb,
              oracle_cap: oracleCap,
            },
            audit: { market_id: market.id, status: "succeeded", error: null },
          };
        },
      };
    });
}

export function isAutomationAuthorized(authorization, secret) {
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export function automationSecret() {
  return process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET ?? "";
}
