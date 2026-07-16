import { getArticles } from "./db";
import type { Article } from "./mock-data";
import { llmJSON } from "./llm";

export type { MarketCategory, MarketStatus, Side, Market, MarketSnapshot } from "./tregu-client";
export { lmsrPriceYes, previewBet } from "./tregu-client";
import type { Market, MarketCategory } from "./tregu-client";

const CATEGORY_TO_ARTICLE_CATEGORY: Record<MarketCategory, string[]> = {
  politike: ["Politikë", "Siguri", "Shoqëri"],
  ekonomi: ["Ekonomi"],
  sport: ["Sport"],
  bote: ["Botë", "Diaspora"],
  "te-tjera": [],
};

/** Pull recent articles relevant to a market's category, for AI scoring + evidence. */
export function articlesForMarket(market: Pick<Market, "category" | "source_article_slugs">): Article[] {
  const wanted = CATEGORY_TO_ARTICLE_CATEGORY[market.category];
  const pool = getArticles(80);
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
}

/** Ask Groq to estimate P(market resolves PO) from recent article context. */
export async function scoreMarketWithAI(market: Market): Promise<AiScoreResult> {
  const articles = articlesForMarket(market);
  const context = articles
    .map((a) => `[${a.slug}] (${a.publishedAt}) ${a.title}\n${a.excerpt}`)
    .join("\n\n");

  const system =
    "Je analist lajmesh per 383, nje sajt lajmesh ne Kosove. Vleresoje probabilitetin qe nje treg parashikimi te zgjidhet 'PO', bazuar VETEM ne artikujt e dhene. Kthe VETEM JSON: " +
    `{"probability": 0.0-1.0, "reasoning": "shpjegim i shkurter shqip", "cited_slugs": ["slug1", "slug2"]}`;
  const user = `Pyetja e tregut: "${market.question}"\n${market.description ? `Kontekst: ${market.description}\n` : ""}\nArtikuj te fundit:\n\n${context || "(pa artikuj te lidhur)"}`;

  const parsed = await llmJSON<AiScoreResult>(system, user, { maxTokens: 600 });
  return {
    probability: Math.min(1, Math.max(0, Number(parsed.probability))),
    reasoning: String(parsed.reasoning ?? ""),
    cited_slugs: Array.isArray(parsed.cited_slugs) ? parsed.cited_slugs.map(String) : [],
  };
}

interface DraftedMarket {
  question: string;
  description: string;
  category: MarketCategory;
  closes_in_days: number;
  source_slugs: string[];
  resolution_rules?: string;
  resolution_source?: string;
}

/** Ask Groq to draft new market questions from today's top articles (admin approves before going live). */
export async function draftMarketsFromNews(limit = 5): Promise<DraftedMarket[]> {
  const articles = getArticles(30).slice(0, 20);
  const context = articles.map((a) => `[${a.slug}] (${a.category}) ${a.title} — ${a.excerpt}`).join("\n");

  const system =
    "Je editor per 383 Tregu, nje treg parashikimesh si Polymarket per lajme nga Kosova/rajoni. " +
    "Nga artikujt e dhene, propozo pyetje TREGU qarta, binare (PO/JO), te verifikueshme brenda javeve/muajve, interesante per publikun. " +
    "Per cdo treg shkruaj edhe rregullat e zgjidhjes: cfare sakteisht duhet te ndodhe (dhe deri kur) qe tregu te zgjidhet PO, dhe cili burim zyrtar e verifikon. " +
    `Kthe VETEM JSON: {"markets": [{"question": "...?", "description": "...", "category": "politike|ekonomi|sport|bote|te-tjera", "closes_in_days": 30, "source_slugs": ["slug1"], "resolution_rules": "Zgjidhet PO nese ... para dates ... Cdo rezultat tjeter zgjidhet JO.", "resolution_source": "p.sh. njoftimi zyrtar i institucionit + raportimi i 383"}]}`;
  const user = `Artikuj te fundit:\n${context}\n\nPropozo deri ne ${limit} tregje te reja.`;

  const parsed = await llmJSON<{ markets: DraftedMarket[] }>(system, user, { maxTokens: 1200 });
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
