import { kosovoLocalDate } from "./tregu-date-key.mjs";
import {
  DAILY_MARKET_CONTRACT_VERSION,
  deriveDailyTopicKey,
  evaluateDailyMarketCandidate,
} from "./tregu-daily-market-quality.mjs";

const CATEGORY_TO_ARTICLE_CATEGORY = {
  politike: ["Politikë", "Siguri", "Shoqëri"],
  ekonomi: ["Ekonomi"],
  sport: ["Sport"],
  bote: ["Botë", "Diaspora"],
  "te-tjera": [],
};

export const NEWS_EVIDENCE_LOOKBACK_DAYS = 14;
export const NEWS_EVIDENCE_LOOKBACK_MS = NEWS_EVIDENCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
export const NEWS_EVIDENCE_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const NEWS_DEADLINE_DECAY_INTERVAL_MS = 90 * 1000;

function normalizedQuestion(question) {
  return String(question ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HOME_AUDIENCE_TERMS = [
  "kosov", "prisht", "prizren", "gjakov", "gjilan", "pej", "mitrov", "zvecan", "kfor", "kurti", "vucic", "serbi", "beograd", "tiran", "alban", "shqip", "saran", "vlore", "rama", "qever", "kuvend", "polic", "zgjedh", "naft", "rrym", "energ", "cmim", "paga", "visa",
];
const WORLD_AUDIENCE_TERMS = [
  "gaza", "hamas", "izrael", "iran", "oman", "hormuz", "ukrain", "rusi", "mosk", "putin", "trump", "biden", "shba", "shtetet e bashkuara", "nato", "europ", "kina", "kine", "tajvan", "luft", "sanksion", "tarif", "naft", "elon musk", "openai", "nvidia", "hugging face", "federal reserve", "rezerva federale", "fed", "apple", "google", "microsoft", "meta", "artific", "chip", "teknolog",
];
const PUBLIC_DRAMA_TERMS = [
  "arrest", "protest", "sulm", "zjar", "vras", "viktim", "vdekur", "evaku", "luft", "kriz", "skandal", "gjykat", "shperth", "shperthim", "konflikt", "bisedim", "marrëvesh", "marrevesh", "sanksion", "tarif", "korrups", "bler", "acquisition", "shkark", "larg", "padi", "negociat", "konfirm",
];
const PUBLIC_AFFAIRS_TERMS = [
  "qever", "kuvend", "president", "kryemin", "ministr", "polic", "kfor", "zgjedh", "naft", "rrym", "energ", "cmim", "visa", "gaza", "ukrain", "iran", "rusi", "nato",
];

function normalizedAudienceText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function hasAudienceTerm(text, terms) {
  return terms.some((term) => text.includes(normalizedAudienceText(term)));
}

/** Classify only broad, recognizable public-interest stories for the daily non-sports lane. */
export function classifyDailyAudience(candidate, sourceArticles = []) {
  if (String(candidate?.category ?? "").trim().toLowerCase() === "sport") return "sport";
  const sourceBySlug = new Map((sourceArticles ?? []).map((article) => [String(article?.slug ?? ""), article]));
  const sourceText = (Array.isArray(candidate?.source_slugs) ? candidate.source_slugs : [])
    .map((slug) => sourceBySlug.get(String(slug)))
    .filter(Boolean)
    .map((article) => `${article.title ?? ""} ${article.excerpt ?? ""} ${article.category ?? ""} ${article.slug ?? ""}`)
    .join(" ");
  const text = normalizedAudienceText(`${candidate?.question ?? ""} ${candidate?.description ?? ""} ${candidate?.resolution_criteria ?? ""} ${sourceText}`);
  const homeSignal = hasAudienceTerm(text, HOME_AUDIENCE_TERMS);
  const worldSignal = hasAudienceTerm(text, WORLD_AUDIENCE_TERMS);
  const dramaSignal = hasAudienceTerm(text, PUBLIC_DRAMA_TERMS);
  const publicAffairsSignal = hasAudienceTerm(text, PUBLIC_AFFAIRS_TERMS);
  if (homeSignal && (dramaSignal || publicAffairsSignal)) return "home_mass";
  if (worldSignal && (dramaSignal || publicAffairsSignal)) return "world_mass";
  return "niche";
}

function draftViolation(candidate, context = {}) {
  const question = String(candidate?.question ?? "").trim();
  const description = String(candidate?.description ?? "").trim();
  const resolutionCriteria = String(candidate?.resolution_criteria ?? "").trim();
  const sourceSlugs = Array.isArray(candidate?.source_slugs) ? candidate.source_slugs.filter(Boolean) : [];
  const liveEvent = candidate?.live_event;
  const closesInHours = Number(candidate?.closes_in_hours);
  const closesInDays = Number(candidate?.closes_in_days);
  if (question.length < 18 || question.length > 125 || !question.endsWith("?")) return "Çdo draft duhet të ketë titull të shkurtër, Polymarket-style.";
  if (/^a\s+do\s+t[ëe](?:\s|$)/i.test(question)) return "Titulli nuk mund të fillojë mekanikisht me 'A do të'.";
  if (!/deri\s+m[ëe]\s+\d{1,2}\s+\p{L}+/iu.test(question)) return "Çdo draft duhet të ketë afat konkret në titull.";
  if (description.length < 20) return "Çdo draft duhet të ketë përmbledhje të plotë.";
  if (resolutionCriteria.length < 40) return "Çdo draft duhet të ketë kritere konkrete zgjidhjeje dhe burim.";
  const isOfficialLiveEvent = liveEvent?.provider === "espn" && String(liveEvent?.event_id ?? "").trim() && String(liveEvent?.yes_team ?? "").trim() && String(liveEvent?.league ?? "").trim();
  if (sourceSlugs.length === 0 && !isOfficialLiveEvent) return "Çdo draft duhet të përdorë burime të cituara.";
  if (isOfficialLiveEvent) {
    if (!Number.isFinite(new Date(candidate?.closes_at).getTime())) return "Tregu live duhet të ketë kohë mbylljeje rezervë.";
  } else if (Number.isFinite(closesInHours)) {
    if (closesInHours < 6 || closesInHours > 168) return "Tregjet e lajmeve të fundit duhet të mbyllen brenda 6 orësh deri në 7 ditë.";
  } else if (!Number.isFinite(closesInDays) || closesInDays < 2 || closesInDays > 7) return "Tregjet e eventeve duhet të mbyllen brenda 2 deri në 7 ditë.";
  if (closesInDays > 7 && String(candidate?.long_duration_reason ?? "").trim().length < 20) return "Afatet mbi 7 ditë kërkojnë arsye objektive të dokumentuar.";
  if (context.nonSportOnly) {
    const quality = evaluateDailyMarketCandidate(candidate, context);
    if (!quality.ok) return quality.reasons[0] ?? "Tregu nuk kalon portën e cilësisë së tregut.";
  }
  return null;
}

const TREGU_CATEGORIES = new Set(["politike", "ekonomi", "sport", "bote", "te-tjera"]);

export const TREGU_DRAFT_REVIEW_RECIPIENT = "lindsylqa@gmail.com";

/** Daily drafts must use the VPS OpenAI Codex OAuth profile, not an ambient provider. */
export function buildDailyCodexCommand(prompt) {
  return ["chat", "-Q", "--provider", "openai-codex", "--model", "gpt-5.6-terra", "--toolsets", "safe", "-q", prompt];
}

/** The root Codex OAuth caller generates candidates; the app accepts only this bounded payload. */
export function validateDailyDraftSubmission(candidates, knownSourceSlugs, options = {}) {
  const minimum = Number.isInteger(options?.minimum) ? Math.max(0, options.minimum) : 3;
  if (!Array.isArray(candidates) || candidates.length < minimum || candidates.length > 5) {
    return { ok: false, error: `Duhet të dorëzohen ${minimum === 0 ? "0 deri në" : `${minimum} deri në`} 5 tregje draft.` };
  }
  const seen = new Set();
  for (const candidate of candidates) {
    const question = String(candidate?.question ?? "").trim();
    const sourceSlugs = Array.isArray(candidate?.source_slugs) ? candidate.source_slugs.filter(Boolean).map(String) : [];
    const violation = draftViolation(candidate, {
      nonSportOnly: options.nonSportOnly === true,
      sourceArticles: options.sourceArticles ?? [],
      existingMarkets: options.existingMarkets ?? [],
      now: options.now ?? new Date(),
    });
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
    const analysis = market.pre_match_analysis && typeof market.pre_match_analysis === "object" ? market.pre_match_analysis : {};
    const archetype = escapeHtml(analysis.market_archetype ?? "");
    const decisionPoint = escapeHtml(analysis.decision_point ?? "");
    const whyUncertain = escapeHtml(analysis.why_uncertain ?? "");
    const tradingAngle = escapeHtml(analysis.trading_angle ?? "");
    const resolutionSource = escapeHtml(analysis.resolution_source ?? "");
    const closesAt = new Date(market.closes_at).toLocaleDateString("sq-AL");
    return `<tr><td bgcolor="#FFFFFF" style="padding:0 0 18px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;border:1px solid #CBD5E1;border-collapse:separate;border-radius:12px;background-color:#FFFFFF"><tr><td style="padding:22px"><p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#334155">${escapeHtml(labels[market.category] ?? market.category)} &middot; Mbyllet ${escapeHtml(closesAt)}</p><h2 style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:29px;color:#111827">${escapeHtml(market.question)}</h2><p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#1F2937">${escapeHtml(market.description)}</p><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#334155"><strong style="color:#111827">Tipi:</strong> ${archetype}<br><strong style="color:#111827">Pika e vendimit:</strong> ${decisionPoint}<br><strong style="color:#111827">Pse është e hapur:</strong> ${whyUncertain}<br><strong style="color:#111827">Këndvështrimi:</strong> ${tradingAngle}<br><strong style="color:#111827">Burimi i zgjidhjes:</strong> ${resolutionSource}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#166534" style="padding:7px 14px;border-radius:999px;background-color:#166534"><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#FFFFFF">PO</span></td><td style="width:8px">&nbsp;</td><td bgcolor="#E2E8F0" style="padding:7px 14px;border-radius:999px;background-color:#E2E8F0"><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#111827">JO</span></td></tr></table><p style="margin:16px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#334155"><strong style="color:#111827">Burime / prova:</strong> ${evidence}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0F172A" style="border-radius:6px;background-color:#0F172A"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:11px 15px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:18px;color:#FFFFFF;text-decoration:none">Hap rishikimin</a></td></tr></table></td></tr></table></td></tr>`;
  }).join("");
  return `<!doctype html><html><body bgcolor="#E5E7EB" style="margin:0;padding:0;background-color:#E5E7EB"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E5E7EB" style="width:100%;background-color:#E5E7EB"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px"><tr><td bgcolor="#0F172A" style="padding:26px 24px;border-radius:12px 12px 0 0;background-color:#0F172A"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:34px;color:#FFFFFF">383 Tregu — draftet e reja</h1><p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#E2E8F0">Asnjë treg nuk hapet automatikisht. Hap rishikimin, kyçu si admin dhe konfirmo veprimin me POST.</p></td></tr><tr><td bgcolor="#FFFFFF" style="padding:18px 18px 0 18px;background-color:#FFFFFF">${cards}</td></tr></table></td></tr></table></body></html>`;
}

/**
 * @param {{ candidates?: any[], existingQuestions?: string[], existingMarkets?: any[], now: Date, audienceArticles?: any[], requireMassAudience?: boolean, nonSportOnly?: boolean }} options
 */
export function buildDailyDraftPlan({ candidates, existingQuestions, existingMarkets = [], now, audienceArticles = [], requireMassAudience = false, nonSportOnly = false }) {
  const priorMarkets = existingMarkets.length
    ? [...existingMarkets]
    : (existingQuestions ?? []).map((question) => ({ question }));
  const seen = new Set(priorMarkets.map((market) => normalizedQuestion(market?.question)));
  const seenTopics = new Set(priorMarkets.map(deriveDailyTopicKey).filter(Boolean));
  const rows = [];
  const rejected = [];
  const audienceTiers = [];

  for (const candidate of candidates ?? []) {
    const audienceTier = requireMassAudience ? classifyDailyAudience(candidate, audienceArticles) : null;
    const quality = nonSportOnly
      ? evaluateDailyMarketCandidate(candidate, {
        sourceArticles: audienceArticles,
        existingMarkets: priorMarkets,
        now,
        nonSportOnly: true,
        audienceTier,
      })
      : null;
    const violation = quality ? (quality.ok ? null : quality.reasons[0]) : draftViolation(candidate);
    if (violation) {
      rejected.push({ question: candidate?.question ?? "", reason: violation, ...(quality?.reasons ? { reasons: quality.reasons } : {}) });
      continue;
    }
    if (requireMassAudience && audienceTier === "sport") {
      rejected.push({ question: candidate?.question ?? "", reason: "sports_are_separate_lane" });
      continue;
    }
    if (requireMassAudience && audienceTier === "niche") {
      rejected.push({ question: candidate?.question ?? "", reason: "not_mass_audience" });
      continue;
    }
    const key = normalizedQuestion(candidate?.question);
    if (seen.has(key)) {
      rejected.push({ question: candidate.question, reason: "duplicate_question" });
      continue;
    }
    const topicKey = quality?.topic_key ?? deriveDailyTopicKey(candidate);
    if (nonSportOnly && topicKey && seenTopics.has(topicKey)) {
      rejected.push({ question: candidate.question, reason: "duplicate_topic" });
      continue;
    }
    seen.add(key);
    if (topicKey) seenTopics.add(topicKey);
    const closesAt = candidate.live_event
      ? new Date(candidate.closes_at).toISOString()
      : new Date(now.getTime() + (Number.isFinite(Number(candidate.closes_in_hours)) ? Number(candidate.closes_in_hours) * 3_600_000 : Number(candidate.closes_in_days) * 86_400_000)).toISOString();
    const preMatchAnalysis = quality ? {
      contract_version: DAILY_MARKET_CONTRACT_VERSION,
      market_archetype: String(candidate.market_archetype),
      topic_key: topicKey,
      decision_point: String(candidate.decision_point).trim(),
      why_uncertain: String(candidate.why_uncertain).trim(),
      trading_angle: String(candidate.trading_angle).trim(),
      resolution_source: String(candidate.resolution_source).trim(),
      deadline_basis: String(candidate.deadline_basis).trim(),
      ...(candidate.threshold_value ? { threshold_value: String(candidate.threshold_value).trim() } : {}),
      source_families: quality.source_families,
      quality_score: quality.score,
      generated_at: now.toISOString(),
    } : (candidate.pre_match_analysis ?? null);
    rows.push({
      question: String(candidate.question).trim(),
      description: String(candidate.description).trim(),
      resolution_criteria: String(candidate.resolution_criteria).trim(),
      category: candidate.category,
      ...(nonSportOnly ? { market_type: "binary", market_classification: "general_news" } : {}),
      status: "draft",
      ai_generated: true,
      source_article_slugs: candidate.source_slugs.filter(Boolean),
      pre_match_analysis: preMatchAnalysis,
      live_event: candidate.live_event ?? null,
      closes_at: closesAt,
    });
    priorMarkets.push({ question: candidate.question, source_article_slugs: candidate.source_slugs, pre_match_analysis: preMatchAnalysis });
    if (audienceTier) audienceTiers.push({ question: String(candidate.question).trim(), tier: audienceTier });
  }

  return { rows, rejected, audienceTiers };
}

export function dailyDraftPublicationReason(plan) {
  const hasMassAudience = plan.audienceTiers.some(({ tier }) => tier === "home_mass" || tier === "world_mass");
  if (plan.rows.length < 2) return "insufficient_tradable_market_inventory";
  if (!hasMassAudience) return "missing_mass_audience";
  return null;
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

/** Deadline RPCs are exclusively for ordinary PO/JO news markets, never live or multi-outcome lanes. */
export function isEligibleNewsDeadlineMarket(market) {
  const category = String(market?.category ?? "").trim().toLowerCase();
  return market?.status === "open"
    && market?.market_type === "binary"
    && market?.market_classification === "general_news"
    && !["sport", "f1", "football"].includes(category);
}

export function newsDeadlineAction(market, now = new Date()) {
  if (!isEligibleNewsDeadlineMarket(market)) return null;
  const closesAt = new Date(market?.closes_at ?? "").getTime();
  if (!Number.isFinite(closesAt)) return null;
  if (closesAt <= now.getTime()) return "settle";
  // Discrete-action markets start a gentle, rate-limited countdown three days
  // before expiry. The database RPC remains the authority for the actual move.
  if (closesAt <= now.getTime() + 72 * 60 * 60 * 1000) return "decay";
  return null;
}

/** Deterministic no-evidence countdown cap for each two-minute tick. */
export function newsDeadlineDecayCap(remainingHours) {
  const hours = Number(remainingHours);
  if (!Number.isFinite(hours) || hours > 72 || hours <= 0) return null;
  // These are per-tick caps, not hourly caps. The worker runs every two minutes,
  // so markets react immediately while the floor prevents a probability cliff.
  if (hours <= 6) return 0.004;
  if (hours <= 24) return 0.002;
  return 0.001;
}

export function canonicalEvidenceUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|oc$|ved$|gclid$|fbclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function evidenceIdentity(article) {
  const url = canonicalEvidenceUrl(article?.url);
  if (url) return `url:${url.toLocaleLowerCase()}`;
  return `slug:${String(article?.slug ?? "").trim().toLocaleLowerCase()}`;
}

export function evidenceFingerprint(articles) {
  return [...new Set((articles ?? []).map(evidenceIdentity).filter((value) => !value.endsWith("slug:")))]
    .sort()
    .join("|");
}

function isUsableVerifiedEvidence(article) {
  if (isSocialOnlyEvidence(article) || article?.verification === "external_google_news") return false;
  if (!String(article?.source ?? "").trim()) return false;
  const canonicalUrl = canonicalEvidenceUrl(article?.url);
  if (!canonicalUrl) return false;
  try {
    const host = new URL(canonicalUrl).hostname.toLocaleLowerCase();
    if (host === "news.google.com" || host === "google.com" || host.endsWith(".google.com")) return false;
  } catch {
    return false;
  }
  const body = String(article?.body ?? "").trim();
  return body.length >= 240 && body.split(/\s+/).filter(Boolean).length >= 35;
}

function relevantArticles(market, verifiedArticles, now = new Date(), usedEvidence = new Set()) {
  const lastNewsAt = market.last_news_at ? new Date(market.last_news_at).getTime() : Number.NEGATIVE_INFINITY;
  const categories = CATEGORY_TO_ARTICLE_CATEGORY[market.category] ?? [];
  const sourceSlugs = new Set(market.source_article_slugs ?? []);
  const lowerBound = now.getTime() - NEWS_EVIDENCE_LOOKBACK_MS;
  const upperBound = now.getTime() + NEWS_EVIDENCE_FUTURE_SKEW_MS;
  const seenEvidence = new Set();
  return (verifiedArticles ?? []).filter((article) => {
    const publishedAt = new Date(article.publishedAt).getTime();
    if (!Number.isFinite(publishedAt) || publishedAt < lowerBound || publishedAt > upperBound || publishedAt <= lastNewsAt) return false;
    if (!isUsableVerifiedEvidence(article)) return false;
    const identity = evidenceIdentity(article);
    if (usedEvidence.has(identity) || usedEvidence.has(String(article?.slug ?? "").toLocaleLowerCase())) return false;
    if (seenEvidence.has(identity)) return false;
    seenEvidence.add(identity);
    const categoryMatches = categories.includes(article.category);
    const pinned = sourceSlugs.has(article.slug);
    // Pinned sources are hints, not an allow-list. They must pass the same
    // entity/action test as discovered articles, otherwise an old Putin story
    // can move a Kurti-Abdixhiku or Ibar bridge market.
    return (pinned || categoryMatches) && hasStrictSubjectMatch(market, article);
  });
}

function isSocialOnlyEvidence(article) {
  const source = String(article?.source ?? "").trim().toLowerCase();
  return article?.verification === "social_only" || /(^|\b)(x|twitter|facebook|instagram|tiktok|telegram|reddit)(\b|\/)/.test(source);
}

const MATCH_STOPWORDS = new Set([
  "a", "do", "e", "i", "në", "ne", "te", "të", "me", "per", "për", "nga", "deri", "gjate", "gjatë", "sot", "neser", "nesër", "will", "the", "and", "for", "with", "from", "that", "this", "news", "market", "trade", "tregu", "artikull", "article", "report", "raportohet", "konfirmohet", "official", "zyrtar", "sport", "politike", "ekonomi", "bote"
]);

const SUBJECT_ALIASES = [
  ["ngushtic", "strait"], ["hormuz", "hormuz"], ["rihap", "reopen"],
  ["ure", "bridge"], ["iber", "ibar"], ["ibrit", "ibar"],
  ["armepush", "ceasefire"], ["rus", "russia"], ["ukrain", "ukraine"],
  ["viz", "visa"], ["emigru", "immigrant"], ["amerikan", "america"], ["kosovar", "kosovo"],
  ["shqiper", "albania"], ["paris", "paris"], ["kapituj", "chapters"], ["negociat", "negotiations"],
  ["bised", "talks"], ["marrevesh", "deal"], ["bler", "acquisition"],
  ["nenshkru", "signed"], ["shkark", "removal"], ["larg", "removal"],
];

// Action words can overlap across unrelated stories. They are never enough to
// establish that an article concerns the market's named person, place, company,
// institution, or conflict.
const GENERIC_SUBJECT_TOKENS = new Set([
  "reopen", "bridge", "ceasefire", "talks", "deal", "acquisition", "signed", "removal",
  "meeting", "meet", "open", "opening", "decision", "agreement", "negotiation", "negotiations",
  "confirm", "confirmed", "appeal", "appeals", "visit", "visits", "announcement", "announced",
  "war", "conflict", "within", "next", "month", "months", "year", "years", "day", "days", "week", "weeks", "full", "fully", "new", "one", "two", "three", "four", "five",
  "dhe", "midis", "lufte", "luft", "luften", "shpall", "shpallet", "brenda", "muaj", "muajve", "shtator", "gusht", "viti",
]);

// A named entity alone is not enough for a market-specific claim. For example,
// an article can mention Ukraine while discussing a ship attack, not a ceasefire.
// These groups bind the article to the event/action asked by the market.
const SUBJECT_ACTION_GROUPS = [
  { key: "ceasefire", terms: ["armepush", "ceasefire", "truce", "armistice", "peace talk", "peace deal", "peace agreement", "halt fighting", "stop fighting", "stop hostilities"] },
  { key: "reopening", terms: ["rihap", "reopen", "hapet", "hapjen", "open for vehicles", "open to vehicles"] },
  { key: "negotiation", terms: ["negociat", "negotiation", "talks", "bised", "kapituj", "chapters"] },
  { key: "appointment", terms: ["emëro", "emer", "appoint", "nominate", "drejtim", "marrë drejtimin", "take over"] },
  { key: "visa-processing", terms: ["viz", "visa", "emigrant", "immigrant", "processing"] },
  { key: "meeting", terms: ["takohen", "takim", "meet", "meeting", "consult", "konsult"] },
  { key: "fire-intentionality", terms: ["qellim", "intentional", "deliberate", "arson", "incendiar", "set fire", "investigat", "investigation"] },
  { key: "price-threshold", terms: ["bitcoin", "cmimi", "price", "dollar", "dollare", "mije", "exceed", "above", "kaloj"] },
  { key: "transfer", terms: ["transfer", "transfero", "nenshkru", "signing"] },
];

function normalizedSubjectText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function subjectActionGroups(value) {
  const text = normalizedSubjectText(value);
  return new Set(SUBJECT_ACTION_GROUPS.filter((group) => group.terms.some((term) => text.includes(normalizedSubjectText(term)))).map((group) => group.key));
}

function canonicalSubjectToken(token) {
  const folded = String(token ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return SUBJECT_ALIASES.find(([prefix]) => folded.startsWith(prefix))?.[1] ?? folded;
}

/** Normalize Albanian inflections and approved English aliases before strict relevance matching. */
function subjectTokens(value) {
  const raw = String(value ?? "").toLocaleLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(raw.flatMap((token) => [token, canonicalSubjectToken(token)]))]
    .filter((token) => !MATCH_STOPWORDS.has(token));
}

function isActionToken(token) {
  const normalized = normalizedSubjectText(token);
  return SUBJECT_ACTION_GROUPS.some((group) => group.terms.some((term) => {
    const normalizedTerm = normalizedSubjectText(term);
    return !normalizedTerm.includes(" ") && normalized.startsWith(normalizedTerm);
  }));
}

function subjectEntityTokens(value) {
  return [...new Set(subjectTokens(value).map(canonicalSubjectToken))]
    .filter((token) => token.length >= 4 && !GENERIC_SUBJECT_TOKENS.has(token) && !isActionToken(token));
}

/** Prevent a broad category label from moving an unrelated market. */
function hasStrictSubjectMatch(market, article) {
  const marketText = `${market?.question ?? ""} ${market?.slug ?? ""}`.trim();
  if (!marketText) return true;
  const marketEntities = subjectEntityTokens(marketText);
  // Keep entity matching anchored to the headline/slug metadata. Body text can
  // mention many unrelated actors and must not turn a broad article into proof.
  const articleIdentityText = `${article?.title ?? ""} ${article?.excerpt ?? ""} ${article?.slug ?? ""}`;
  const articleEntities = subjectEntityTokens(articleIdentityText);
  const entityOverlap = articleEntities.filter((token) => marketEntities.includes(token));
  const normalizedMarketText = normalizedSubjectText(marketText);
  const bilateral = marketEntities.length >= 2 && /\b(?:dhe|and|midis|between)\b/.test(normalizedMarketText);
  if (bilateral ? !marketEntities.every((token) => articleEntities.includes(token)) : entityOverlap.length === 0) return false;

  const marketActions = subjectActionGroups(marketText);
  // An unclassified market action is not a license to use entity-only news.
  // Add an explicit action group before allowing that market to reprice.
  if (!marketActions.size) return false;
  const articleText = `${articleIdentityText} ${article?.body ?? ""}`;
  const articleActions = subjectActionGroups(articleText);
  // The article must discuss the same event/action family as the market. This
  // blocks Ukraine military/tension stories from moving a ceasefire market and
  // blocks generic meetings/deals from moving a named negotiation market.
  return [...marketActions].some((action) => articleActions.has(action));
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
  const canonical = canonicalEvidenceUrl(article?.url);
  if (canonical) {
    try {
      return new URL(canonical).hostname.replace(/^www\./i, "").toLocaleLowerCase();
    } catch {
      // Fall through to the publisher label when the URL was malformed.
    }
  }
  return String(article?.source ?? "").trim().toLocaleLowerCase() || `article:${String(article?.slug ?? "")}`;
}

/** A fresh database preflight prevents a stale open-market scan from reaching an AI provider or oracle. */
export function repriceMarketSkipReason(market, now = new Date()) {
  if (market?.status !== "open") return "skipped_closed";
  const closesAt = new Date(market?.closes_at ?? "").getTime();
  return Number.isFinite(closesAt) && closesAt <= now.getTime() ? "skipped_closed" : null;
}

export function buildRepricePlan({ markets, verifiedArticles, now = new Date(), usedEvidenceByMarket = new Map() }) {
  return (markets ?? [])
    .filter((market) => market.status === "open")
    .map((market) => ({ market, evidence: relevantArticles(market, verifiedArticles, now, usedEvidenceByMarket.get(market.id) ?? new Set()) }))
    .map(({ market, evidence }) => {
      return {
        market,
        evidence,
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
          // A single verified publisher may move odds at most two points. A five-point
          // move is possible only when two independent publishers corroborate the score.
          const oracleCap = evidenceSources.length >= 2 ? 0.05 : 0.02;
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
              oracle_reasoning: String(score.reasoning ?? ""),
              evidence_slugs: evidenceSlugs,
              evidence_sources: evidenceSources,
               evidence_fingerprint: evidenceFingerprint(citedEvidence),
              evidence_kind: score.evidence_level === "decisive" ? "decisive" : "ordinary",
              deadline_remaining_hours: Number.isFinite(new Date(market.closes_at ?? "").getTime())
                ? Math.max(0, (new Date(market.closes_at).getTime() - now.getTime()) / 3_600_000)
                : null,
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
