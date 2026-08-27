const DAILY_MARKET_CONTRACT_VERSION = "daily-market-v2";

export { DAILY_MARKET_CONTRACT_VERSION };

export const DAILY_MARKET_ARCHETYPES = Object.freeze([
  "scheduled_decision",
  "threshold",
  "data_release",
  "policy_action",
  "appointment_or_selection",
  "escalation_or_deescalation",
  "corporate_decision",
  "executive_action",
]);

const ARCHETYPE_SET = new Set(DAILY_MARKET_ARCHETYPES);
const MAX_BREAKING_HOURS = 96;
const MAX_SCHEDULED_DECISION_HOURS = 168;

const STOPWORDS = new Set([
  "a", "do", "te", "të", "e", "i", "u", "në", "ne", "me", "per", "për", "nga", "deri", "brenda", "më", "me", "sot", "neser", "nesër",
  "do", "the", "will", "by", "within", "and", "or", "of", "to", "in", "on", "for", "from", "is", "be", "this", "that",
  "market", "treg", "tregu", "pyetje", "news", "lajm", "artikull", "article", "report", "raporton", "sipas", "burimi", "zyrtar", "official",
  "kosov", "kosove", "kosova", "shqiperi", "shqiperia", "bote", "world", "new", "ri", "re", "nje", "një", "një",
]);

const UNCERTAINTY_MARKERS = [
  "ende", "pasig", "mund", "nuk", "ose", "varet", "kundersht", "kundër", "marrëvesh", "marrevesh", "alternativ", "rrezik", "shtyr", "paqart", "kontradikt",
];

const GENERIC_RESOLUTION_SOURCES = new Set([
  "burimi zyrtar",
  "njoftimet zyrtare",
  "institucioni pergjegjes",
  "institucionet perkatese",
  "autoritetet perkatese",
  "sipas burimeve",
  "burime te verifikuara",
]);

const DEFINITIVE_SOURCE_PATTERNS = [
  /u nenshkrua/, /nenshkroi/, /ka nenshkruar/, /u konfirmua/, /konfirmoi/, /ka konfirmuar/, /u publikua/, /publikoi/, /ka publikuar/,
  /u mbajt/, /u zhvillua/, /ka ndodhur/, /ndodhi/, /hyri ne fuqi/, /u miratua/, /miratoi/, /u arrestua/, /arrestoi/, /vdiq/, /ka vdekur/,
  /fitoi/, /ka fituar/, /u emerua/, /emeroi/, /u zgjodh/, /zgjodhi/, /u shpall/, /shpalli/,
];

const MEETING_WORDS = ["takim", "takohen", "takohet", "takoi", "mbledhje", "mblidhen", "mblidhet", "meeting"];
const DECISION_WORDS = [
  "vot", "mirat", "vendim", "gjykat", "marrëvesh", "marrevesh", "ligj", "zbato", "sanksion", "emër", "emer", "zgjedh", "emëro", "emero", "kandid", "prano", "refuz", "heq", "vendos",
];
const THRESHOLD_WORDS = ["mbi", "nën", "nen", "kaloj", "tejkal", "arrij", "përqind", "perqind", "milion", "mije", "mijë", "numër", "numer", "çmim", "cmim", "$", "€", "%"];
const POLICY_WORDS = ["zbato", "vendos", "heq", "sanksion", "mbyll", "rihap", "hapet", "nis", "sulm", "shpall", "mirat", "nënshkr", "nenshkr"];
const ROLE_WORDS = ["president", "kryeminist", "minist", "drejtor", "kryetar", "kandidat", "emëro", "emero", "zgjedh", "post", "detyr"];

const MONTHS = new Map([
  ["janar", 1], ["shkurt", 2], ["mars", 3], ["prill", 4], ["maj", 5], ["qershor", 6],
  ["korrik", 7], ["gusht", 8], ["shtator", 9], ["tetor", 10], ["nentor", 11], ["dhjetor", 12],
]);

function fold(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9%€$]+/g, " ")
    .trim();
}

function tokens(value) {
  return [...new Set(fold(value).match(/[a-z0-9]{3,}/g) ?? [])]
    .filter((token) => !STOPWORDS.has(token));
}

function comparableTokens(value) {
  return new Set(tokens(value).map((token) => token.length >= 6 ? token.slice(0, 6) : token));
}

function tokenSimilarity(left, right) {
  const a = comparableTokens(left);
  const b = comparableTokens(right);
  if (a.size < 3 || b.size < 3) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function articleText(article) {
  return `${article?.title ?? ""} ${article?.excerpt ?? ""} ${article?.body ?? ""} ${article?.slug ?? ""}`.trim();
}

function sourceFamily(article) {
  const explicit = fold(article?.source ?? "");
  if (explicit) return explicit;
  const url = String(article?.url ?? "").trim();
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host) return host;
  } catch {
    // A source without a URL remains attributable by slug.
  }
  return fold(article?.slug ?? "") || "unknown";
}

function localDateParts(value, timeZone = "Europe/Pristina") {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  } catch (error) {
    if (timeZone !== "Europe/Pristina" || !(error instanceof RangeError)) return null;
    parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Belgrade", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  }
  const result = {};
  for (const part of parts) if (part.type === "year" || part.type === "month" || part.type === "day") result[part.type] = Number(part.value);
  return result.year && result.month && result.day ? result : null;
}

function deadlineFromQuestion(question) {
  const match = fold(question).match(/deri me (\d{1,2}) ([a-z]+)/);
  if (!match) return null;
  const month = MONTHS.get(match[2]);
  if (!month) return null;
  return { day: Number(match[1]), month };
}

function deadlineMatchesQuestion(question, closesAt) {
  const titleDeadline = deadlineFromQuestion(question);
  const closeParts = localDateParts(closesAt);
  return Boolean(titleDeadline && closeParts && titleDeadline.day === closeParts.day && titleDeadline.month === closeParts.month);
}

function normalizeTopic(value) {
  return fold(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function deriveDailyTopicKey(value) {
  if (typeof value === "string") return normalizeTopic(value);
  const explicit = normalizeTopic(value?.topic_key ?? value?.pre_match_analysis?.topic_key ?? value?.pre_match_analysis?.market_topic_key ?? "");
  if (explicit) return explicit;
  const sourceSlugs = Array.isArray(value?.source_article_slugs)
    ? value.source_article_slugs
    : Array.isArray(value?.source_slugs) ? value.source_slugs : [];
  if (sourceSlugs.length) return normalizeTopic(sourceSlugs.slice(0, 2).join("-"));
  return normalizeTopic(tokens(value?.question ?? "").slice(0, 6).join("-"));
}

function closeHours(candidate) {
  const value = Number(candidate?.closes_in_hours);
  return Number.isFinite(value) && Number.isInteger(value) ? value : null;
}

function sourceArticlesForCandidate(candidate, sourceArticles) {
  const bySlug = new Map((sourceArticles ?? []).map((article) => [String(article?.slug ?? ""), article]));
  const slugs = Array.isArray(candidate?.source_slugs) ? [...new Set(candidate.source_slugs.map(String).filter(Boolean))] : [];
  return { slugs, articles: slugs.map((slug) => bySlug.get(slug)).filter(Boolean) };
}

function criteriaNamesSource(criteria, resolutionSource) {
  const sourceTokens = comparableTokens(resolutionSource);
  const criteriaTokens = comparableTokens(criteria);
  const matches = [...sourceTokens].filter((token) => criteriaTokens.has(token)).length;
  return sourceTokens.size > 1 ? matches >= 2 : matches >= 1;
}

function existingTopicCollision(candidate, existingMarkets) {
  const candidateTopic = deriveDailyTopicKey(candidate);
  const candidateSlugs = new Set(Array.isArray(candidate?.source_slugs) ? candidate.source_slugs.map(String) : []);
  for (const existing of existingMarkets ?? []) {
    const existingTopic = deriveDailyTopicKey(existing);
    if (candidateTopic && existingTopic && candidateTopic === existingTopic) return "duplicate_topic";
    const existingSlugs = Array.isArray(existing?.source_article_slugs) ? existing.source_article_slugs.map(String) : [];
    if (existingSlugs.some((slug) => candidateSlugs.has(slug))) return "repeated_source_topic";
    if (tokenSimilarity(candidate?.question, existing?.question) >= 0.65) return "repeated_subject";
  }
  return null;
}

function sourceRestatesOutcome(candidate, articles) {
  const questionCore = candidate?.question ?? "";
  if (!questionCore || !articles.length) return false;
  const questionHasNumber = /\d|%|[$€]/.test(questionCore);
  return articles.some((article) => {
    const text = articleText(article);
    return DEFINITIVE_SOURCE_PATTERNS.some((pattern) => pattern.test(fold(text)))
      && tokenSimilarity(questionCore, article?.title ?? text) >= (questionHasNumber ? 0.82 : 0.62);
  });
}

function hasAny(text, values) {
  const folded = fold(text);
  return values.some((value) => folded.includes(fold(value)));
}

function validTopicKey(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(String(value ?? ""));
}

function scoreCandidate(candidate, { sourceCount, familyCount, archetype, audienceTier }) {
  let score = 0;
  if (ARCHETYPE_SET.has(archetype)) score += 2;
  if (sourceCount >= 2) score += 2;
  else if (sourceCount === 1) score += 1;
  if (familyCount >= 2) score += 1;
  if (String(candidate?.decision_point ?? "").trim().length >= 55) score += 1;
  if (String(candidate?.why_uncertain ?? "").trim().length >= 70) score += 1;
  if (String(candidate?.trading_angle ?? "").trim().length >= 55) score += 1;
  if (audienceTier && audienceTier !== "niche") score += 1;
  const hours = closeHours(candidate);
  if (hours != null && hours >= 12 && hours <= 72) score += 1;
  return score;
}

/**
 * Deterministic contract gate for the non-sports daily market lane.
 * The model supplies editorial fields; this function decides whether they are
 * specific, uncertain, sourceable, time-bounded, and distinct from live topics.
 */
export function evaluateDailyMarketCandidate(candidate, options = {}) {
  const nonSportOnly = options.nonSportOnly !== false;
  const sourceArticles = Array.isArray(options.sourceArticles) ? options.sourceArticles : [];
  const existingMarkets = Array.isArray(options.existingMarkets) ? options.existingMarkets : [];
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const reasons = [];
  const question = String(candidate?.question ?? "").trim();
  const description = String(candidate?.description ?? "").trim();
  const criteria = String(candidate?.resolution_criteria ?? "").trim();
  const archetype = String(candidate?.market_archetype ?? "").trim();
  const topicKey = deriveDailyTopicKey(candidate);
  const resolutionSource = String(candidate?.resolution_source ?? "").trim();
  const source = sourceArticlesForCandidate(candidate, sourceArticles);

  if (question.length < 28 || question.length > 125 || !question.endsWith("?")) reasons.push("invalid_question_shape");
  if (/^a\s+do\s+t[ëe]\b/i.test(question)) reasons.push("mechanical_question_style");
  if (!deadlineFromQuestion(question)) reasons.push("missing_concrete_deadline");
  if (nonSportOnly && String(candidate?.category ?? "").toLowerCase() === "sport") reasons.push("sports_are_separate_lane");
  if (!ARCHETYPE_SET.has(archetype)) reasons.push("missing_or_unsupported_archetype");
  if (!validTopicKey(candidate?.topic_key)) reasons.push("missing_stable_topic_key");
  if (description.length < 80) reasons.push("thin_description");
  if (criteria.length < 120 || !/\bPO\b/i.test(criteria) || !/\bJO\b/i.test(criteria)) reasons.push("weak_resolution_contract");
  if (resolutionSource.length < 6 || GENERIC_RESOLUTION_SOURCES.has(fold(resolutionSource))) reasons.push("generic_resolution_source");
  if (resolutionSource.length >= 6 && !criteriaNamesSource(criteria, resolutionSource)) reasons.push("resolution_source_not_in_criteria");
  if (source.slugs.length < 1) reasons.push("missing_source_evidence");
  if (sourceArticles.length && source.articles.length !== source.slugs.length) reasons.push("unknown_source_slug");

  const hours = closeHours(candidate);
  if (hours == null) reasons.push("closes_in_hours_required");
  else {
    const maxHours = archetype === "scheduled_decision" ? MAX_SCHEDULED_DECISION_HOURS : MAX_BREAKING_HOURS;
    if (hours < 8 || hours > maxHours) reasons.push("deadline_outside_trading_window");
    const closesAt = new Date(now.getTime() + hours * 3_600_000);
    if (!deadlineMatchesQuestion(question, closesAt)) reasons.push("title_deadline_does_not_match_close");
    if (hours > MAX_BREAKING_HOURS && String(candidate?.deadline_basis ?? "").trim().length < 35) reasons.push("long_deadline_without_scheduled_basis");
  }
  if (String(candidate?.closes_in_days ?? "").trim() && nonSportOnly) reasons.push("days_deadline_not_allowed");

  const decisionPoint = String(candidate?.decision_point ?? "").trim();
  const whyUncertain = String(candidate?.why_uncertain ?? "").trim();
  const tradingAngle = String(candidate?.trading_angle ?? "").trim();
  if (decisionPoint.length < 35) reasons.push("missing_decision_point");
  if (whyUncertain.length < 45 || !hasAny(whyUncertain, UNCERTAINTY_MARKERS)) reasons.push("missing_uncertainty");
  if (tradingAngle.length < 35) reasons.push("missing_trading_angle");

  const combinedQuestionContext = `${question} ${decisionPoint} ${criteria}`;
  if (archetype === "threshold" || archetype === "data_release") {
    if (!hasAny(combinedQuestionContext, THRESHOLD_WORDS) || !/\d|%|[$€]/.test(combinedQuestionContext)) reasons.push("threshold_without_measure");
    if (String(candidate?.threshold_value ?? "").trim().length < 1) reasons.push("threshold_value_required");
  }
  if (archetype === "scheduled_decision") {
    const hasDecision = hasAny(combinedQuestionContext, DECISION_WORDS);
    const meetingOnly = hasAny(question, MEETING_WORDS) && !hasAny(combinedQuestionContext, DECISION_WORDS);
    if (!hasDecision) reasons.push("scheduled_question_without_decision");
    if (meetingOnly) reasons.push("meeting_without_decision");
  }
  if (archetype === "policy_action" && !hasAny(combinedQuestionContext, POLICY_WORDS)) reasons.push("policy_action_not_concrete");
  if (archetype === "appointment_or_selection" && !hasAny(combinedQuestionContext, ROLE_WORDS)) reasons.push("selection_without_named_role");

  if (sourceRestatesOutcome(candidate, source.articles)) reasons.push("headline_restatement_already_known");
  const collision = existingTopicCollision(candidate, existingMarkets);
  if (collision) reasons.push(collision);

  const families = new Set(source.articles.map(sourceFamily));
  const audienceTier = options.audienceTier ?? null;
  const score = scoreCandidate(candidate, { sourceCount: source.articles.length, familyCount: families.size, archetype, audienceTier });
  if (score < 7) reasons.push("low_tradability_score");

  return {
    ok: reasons.length === 0,
    reasons,
    score,
    contract_version: DAILY_MARKET_CONTRACT_VERSION,
    topic_key: topicKey,
    source_slugs: source.slugs,
    source_families: [...families],
    closes_at: hours == null ? null : new Date(now.getTime() + hours * 3_600_000).toISOString(),
  };
}

/** Select a recent source packet while collapsing near-identical wire stories. */
export function selectDailySourceArticles(articles, limit = 24) {
  const sorted = [...(articles ?? [])]
    .filter((article) => article && article.slug)
    .sort((a, b) => new Date(b.publishedAt ?? b.published_at ?? 0).getTime() - new Date(a.publishedAt ?? a.published_at ?? 0).getTime());
  const selected = [];
  const seenIdentity = new Set();
  for (const article of sorted) {
    const identity = String(article.url ?? article.slug);
    if (seenIdentity.has(identity)) continue;
    if (selected.some((other) => tokenSimilarity(articleText(article), articleText(other)) >= 0.58)) continue;
    seenIdentity.add(identity);
    selected.push(article);
    if (selected.length >= limit) break;
  }
  return selected;
}
