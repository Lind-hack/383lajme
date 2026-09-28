const GEOGRAPHIES = new Set(["kosove", "shqiperi", "bote"]);
const TOPICS = new Set(["politike", "ekonomi", "shoqeri", "siguri", "teknologji", "tjeter"]);

function fold(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function newsGeography(value) {
  const normalized = fold(value);
  const aliases = { kosovo: "kosove", albania: "shqiperi", world: "bote", global: "bote" };
  const geography = aliases[normalized] ?? normalized;
  return GEOGRAPHIES.has(geography) ? geography : null;
}

export function newsTopic(value) {
  const normalized = fold(value);
  const aliases = { politics: "politike", economy: "ekonomi", society: "shoqeri", security: "siguri", technology: "teknologji", "te-tjera": "tjeter" };
  const topic = aliases[normalized] ?? normalized;
  return TOPICS.has(topic) ? topic : null;
}

export function candidateNewsTaxonomy(candidate) {
  const geography = newsGeography(candidate?.news_geography ?? candidate?.proposition?.geography);
  const topic = newsTopic(candidate?.news_topic ?? candidate?.category);
  return { geography, topic };
}

export function marketNewsTaxonomy(market) {
  const analysis = market?.pre_match_analysis && typeof market.pre_match_analysis === "object" ? market.pre_match_analysis : {};
  return {
    geography: newsGeography(analysis.news_geography ?? analysis.proposition?.geography ?? (market?.category === "bote" ? "bote" : null)),
    topic: newsTopic(analysis.news_topic ?? market?.category),
  };
}

export function matchesNewsFilter(market, filter) {
  if (!filter) return true;
  if (filter === "sport") return String(market?.category ?? "").toLowerCase() === "sport";
  const { geography, topic } = marketNewsTaxonomy(market);
  if (filter === "ekonomi") return topic === "ekonomi";
  if (GEOGRAPHIES.has(filter)) return geography === filter;
  return String(market?.category ?? "") === filter;
}
