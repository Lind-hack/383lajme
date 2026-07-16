import { getArticles } from "./db";
import type { Article } from "./mock-data";
import { groqChat, parseJSON } from "./groq";
import { marketAiChat } from "./tregu-ai-provider.mjs";

export type { MarketCategory, MarketStatus, Side, Market, MarketSnapshot } from "./tregu-client";
export { lmsrPriceYes, lmsrThreeOutcomePrices, previewBet } from "./tregu-client";
import type { Market, MarketCategory } from "./tregu-client";

const CATEGORY_TO_ARTICLE_CATEGORY: Record<MarketCategory, string[]> = {
  politike: ["Politikë", "Siguri", "Shoqëri"],
  ekonomi: ["Ekonomi"],
  sport: ["Sport"],
  bote: ["Botë", "Diaspora"],
  "te-tjera": [],
};

/** Pull recent articles relevant to a market's category, for AI scoring + evidence. */
export async function articlesForMarket(market: Pick<Market, "category" | "source_article_slugs">): Promise<Article[]> {
  const wanted = CATEGORY_TO_ARTICLE_CATEGORY[market.category];
  const pool = await getArticles(80);
  const pinned = pool.filter((a) => market.source_article_slugs.includes(a.slug));
  const byCategory = wanted.length ? pool.filter((a) => wanted.includes(a.category)) : pool;
  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const a of [...pinned, ...byCategory]) {
    if (seen.has(a.slug)) continue;
    seen.add(a.slug);
    merged.push(a);
    if (merged.length >= 12) break;
  }
  return merged;
}

interface AiScoreResult {
  probability: number; // 0..1
  reasoning: string;
  cited_slugs: string[];
  provider: string;
  fallback_index: number;
  fallback_reason: string | null;
}

/** Score open-market evidence with Groq first, then configured Gemini fallbacks only on provider failure. */
export async function scoreMarketWithAI(market: Market, suppliedArticles?: Article[]): Promise<AiScoreResult> {
  const articles = suppliedArticles ?? await articlesForMarket(market);
  const context = articles
    .map((a) => `[${a.slug}] (${a.publishedAt}) ${a.title}\n${a.excerpt}`)
    .join("\n\n");

  const system =
    "Je analist lajmesh per 383, nje sajt lajmesh ne Kosove. Vleresoje probabilitetin qe nje treg parashikimi te zgjidhet 'PO', bazuar VETEM ne artikujt e dhene. Kthe VETEM JSON: " +
    `{"probability": 0.0-1.0, "reasoning": "shpjegim i shkurter shqip", "cited_slugs": ["slug1", "slug2"]}`;
  const user = `Pyetja e tregut: "${market.question}"\n${market.description ? `Kontekst: ${market.description}\n` : ""}\nArtikuj te fundit:\n\n${context || "(pa artikuj te lidhur)"}`;

  const response = await marketAiChat(system, user, { json: true, maxTokens: 600 });
  const parsed = parseJSON<Omit<AiScoreResult, "provider" | "fallback_index" | "fallback_reason">>(response.content);
  return {
    probability: Math.min(1, Math.max(0, Number(parsed.probability))),
    reasoning: String(parsed.reasoning ?? ""),
    cited_slugs: Array.isArray(parsed.cited_slugs) ? parsed.cited_slugs.map(String) : [],
    provider: response.provider,
    fallback_index: response.fallback_index,
    fallback_reason: response.fallback_reason,
  };
}

interface DraftedMarket {
  question: string;
  description: string;
  resolution_criteria: string;
  category: MarketCategory;
  closes_in_days: number;
  long_duration_reason?: string;
  resolution_rules?: string;
  resolution_source?: string;
  source_slugs: string[];
}

/** Ask Groq to draft new market questions from today's top articles (admin approves before going live). */
export async function draftMarketsFromNews(limit = 5): Promise<DraftedMarket[]> {
  const articles = (await getArticles(30)).slice(0, 20);
  const context = articles.map((a) => `[${a.slug}] (${a.category}) ${a.title} — ${a.excerpt}`).join("\n");

  const system =
    "Je editor per 383 Tregu, nje treg parashikimesh si Polymarket per lajme nga Kosova/rajoni. " +
    "Nga artikujt e dhene, propozo vetem zhvillime unike, polemika ose lajme live nga Kosova, bota dhe sporti. Titujt duhet te jene te shkurter, Polymarket-style, pa filluar mekanikisht me 'A do te', me afat konkret dhe kriter zgjidhjeje nga burim autoritativ. Per lajme te fundit perdor 2-48 ore; afat me te gjate vetem kur arsyeja objektive e kerkon. " +
    `Kthe VETEM JSON: {"markets": [{"question": "...?", "description": "...", "resolution_criteria": "Zgjidhet sipas ... deri me ...", "category": "politike|ekonomi|sport|bote|te-tjera", "closes_in_days": 7, "long_duration_reason": "...", "source_slugs": ["slug1"]}]}`;
  const user = `Artikuj te fundit:\n${context}\n\nPropozo deri ne ${limit} tregje te reja.`;

  const raw = await groqChat(system, user, { json: true, maxTokens: 1200 });
  const parsed = parseJSON<{ markets: DraftedMarket[] }>(raw);
  return Array.isArray(parsed.markets) ? parsed.markets.slice(0, limit) : [];
}

export function slugifyQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (NFD split, e.g. ë -> e + combining mark)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
