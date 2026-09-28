const MAX_RESEARCH_AGE_MS = 30 * 60 * 1000;
const MAX_ARTICLE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function hostname(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** Accept only recent, directly extracted original pages assigned to an open market. */
export function parseMarketResearchEvidence(payload, marketIds, now = new Date()) {
  const generatedAt = Date.parse(String(payload?.generated_at ?? ""));
  if (!Number.isFinite(generatedAt) || generatedAt > now.getTime() + FUTURE_SKEW_MS
    || now.getTime() - generatedAt > MAX_RESEARCH_AGE_MS) {
    throw new Error("Market research is missing or stale");
  }
  const rows = payload?.markets;
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) throw new Error("Market research has no per-market evidence");
  const result = new Map();
  for (const marketId of marketIds) {
    const seen = new Set();
    const accepted = [];
    for (const article of Array.isArray(rows[marketId]) ? rows[marketId] : []) {
      if (article?.verification !== "original_page_extracted" || article?.truncated === true) continue;
      const host = hostname(article.url);
      const discoveryHost = hostname(article.discovery_url);
      if (!host || !discoveryHost || host !== discoveryHost || host.includes("google.com")) continue;
      if (String(article.source ?? "").toLowerCase().replace(/^www\./, "") !== host) continue;
      const publishedAt = Date.parse(String(article.publishedAt ?? ""));
      const fetchedAt = Date.parse(String(article.fetchedAt ?? ""));
      if (!Number.isFinite(publishedAt) || publishedAt > now.getTime() + FUTURE_SKEW_MS
        || now.getTime() - publishedAt > MAX_ARTICLE_AGE_MS) continue;
      if (!Number.isFinite(fetchedAt) || fetchedAt > now.getTime() + FUTURE_SKEW_MS
        || now.getTime() - fetchedAt > MAX_RESEARCH_AGE_MS) continue;
      const body = String(article.body ?? "").trim();
      if (body.length < 240 || body.split(/\s+/).length < 80 || !String(article.title ?? "").trim()) continue;
      if (seen.has(article.url)) continue;
      seen.add(article.url);
      accepted.push({
        slug: String(article.slug ?? "research-" + seen.size),
        title: String(article.title), excerpt: String(article.excerpt ?? ""), body,
        source: host, url: String(article.url), publishedAt: String(article.publishedAt),
        category: String(article.category ?? ""), verification: "original_page_extracted",
      });
    }
    result.set(marketId, accepted);
  }
  return result;
}
