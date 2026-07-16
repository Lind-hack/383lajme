const MARKET_SLUG = "england-argentina-full-time-result-20260715";
const EVENT_ID = "760515";
const TRUSTED_HOSTS = [
  "espn.com", "fifa.com", "reuters.com", "apnews.com", "bbc.com", "theathletic.com", "skysports.com",
];
const SOCIAL_HOSTS = ["x.com", "twitter.com", "instagram.com", "facebook.com", "tiktok.com", "reddit.com", "youtube.com"];

function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
function hostname(value) {
  try { return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}
function isHostIn(host, list) { return list.some((entry) => host === entry || host.endsWith(`.${entry}`)); }
function normalized(values) {
  const entries = Object.entries(values).map(([key, value]) => [key, Number(value)]);
  if (entries.length !== 3 || entries.some(([, value]) => !Number.isFinite(value) || value <= 0)) throw new Error("Pre-match probabilities must be positive finite values.");
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

export function isTrustedPreMatchSource(source) {
  const host = hostname(source?.url);
  return Boolean(source?.url && source?.title && source?.summary && isHostIn(host, TRUSTED_HOSTS) && !isHostIn(host, SOCIAL_HOSTS));
}

/** Discovery is a lead-only channel. Only trusted, non-social, snippet-backed links are sent to Groq. */
export function selectCorroboratedPreMatchSources(discovery) {
  const candidates = Array.isArray(discovery?.results) ? discovery.results : [];
  const unique = new Map();
  for (const candidate of candidates) {
    const source = {
      title: String(candidate?.title ?? "").trim(),
      summary: String(candidate?.summary ?? "").trim(),
      url: String(candidate?.url ?? "").trim(),
      publisher: hostname(candidate?.url),
      published_at: typeof candidate?.published_at === "string" ? candidate.published_at : null,
    };
    if (!isTrustedPreMatchSource(source)) continue;
    if (!/england/i.test(`${source.title} ${source.summary}`) || !/argentina/i.test(`${source.title} ${source.summary}`)) continue;
    unique.set(source.url, source);
  }
  return [...unique.values()].slice(0, 6);
}

export function lineupStatusFromEspn(event) {
  const lineups = event?.starting_lineups && typeof event.starting_lineups === "object" ? event.starting_lineups : {};
  const england = Array.isArray(lineups.England) ? [...new Set(lineups.England.map(String).filter(Boolean))] : [];
  const argentina = Array.isArray(lineups.Argentina) ? [...new Set(lineups.Argentina.map(String).filter(Boolean))] : [];
  if (england.length === 11 && argentina.length === 11) return { status: "confirmed", source: "ESPN", England: england, Argentina: argentina };
  return { status: "predicted_or_unknown", source: "ESPN", England: england, Argentina: argentina };
}

export function validateGroqPreMatchDecision(raw, sources) {
  const probabilities = normalized(raw?.probabilities ?? raw);
  const citedUrls = Array.isArray(raw?.cited_urls) ? [...new Set(raw.cited_urls.map(String))] : [];
  const allowed = new Set((sources ?? []).map((source) => source.url));
  const citations = citedUrls.filter((url) => allowed.has(url));
  if (citations.length < 2) throw new Error("Groq pre-match decision requires two cited, trusted corroborating sources.");
  if (raw?.material_evidence !== true) return { apply: false, reason: "Groq found no cited material pre-match evidence.", probabilities, citations };
  const reasoning = String(raw?.reasoning ?? "").trim();
  if (reasoning.length < 20 || reasoning.length > 800) throw new Error("Groq pre-match reasoning must be a concise audited explanation.");
  return { apply: true, probabilities, citations, reasoning };
}

/** Bounded per-outcome movement. Two independent publishers permit at most five points. */
export function buildPreMatchReference({ current, decision, sources, scannedAt, lineup }) {
  const before = normalized(current);
  if (!decision.apply) return { applied: false, before, after: before, cap: 0, health: { status: "active", last_successful_scan_at: scannedAt, evidence_status: "insufficient", lineup_status: lineup.status } };
  const citedSources = sources.filter((source) => decision.citations.includes(source.url)).map((source) => ({ ...source, publisher: source.publisher || hostname(source.url) }));
  const independentPublishers = new Set(citedSources.map((source) => source.publisher)).size;
  if (independentPublishers < 2) throw new Error("A pre-match movement requires independent publisher corroboration.");
  const cap = 0.05;
  const keys = Object.keys(before);
  const after = Object.fromEntries(keys.map((key) => [key, clamp(decision.probabilities[key], before[key] - cap, before[key] + cap)]));
  // Both vectors sum to one, but independent clipping can introduce a small
  // residual. Rebalance only within each outcome's remaining cap headroom.
  let residual = 1 - Object.values(after).reduce((sum, value) => sum + value, 0);
  for (let pass = 0; pass < 3 && Math.abs(residual) > 1e-12; pass += 1) {
    const candidates = keys.filter((key) => residual > 0 ? after[key] < before[key] + cap - 1e-12 : after[key] > before[key] - cap + 1e-12);
    if (!candidates.length) throw new Error("Could not normalize bounded pre-match probabilities.");
    const share = residual / candidates.length;
    for (const key of candidates) after[key] = clamp(after[key] + share, before[key] - cap, before[key] + cap);
    residual = 1 - Object.values(after).reduce((sum, value) => sum + value, 0);
  }
  if (Math.abs(residual) > 1e-9) throw new Error("Could not normalize bounded pre-match probabilities.");
  return {
    applied: true,
    before,
    after,
    cap,
    reasoning: decision.reasoning,
    evidence: citedSources.map((source) => ({ title: source.title, url: source.url, publisher: source.publisher, published_at: source.published_at })),
    health: { status: "active", last_successful_scan_at: scannedAt, evidence_status: "material", lineup_status: lineup.status },
  };
}

export function staleRefreshHealth(health, now = new Date()) {
  const timestamp = Date.parse(String(health?.last_successful_scan_at ?? ""));
  const ageMs = Number.isFinite(timestamp) ? now.getTime() - timestamp : Number.POSITIVE_INFINITY;
  return { ...health, status: ageMs <= 4 * 60_000 ? "healthy" : "stale" };
}

export { EVENT_ID, MARKET_SLUG };
