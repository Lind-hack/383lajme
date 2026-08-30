import { getArticles, getLatestArticles } from "./db";
import type { Article } from "./mock-data";
import { groqChat, parseJSON } from "./groq";
import { marketAiChat } from "./tregu-ai-provider.mjs";
import { selectDailySourceArticles } from "./tregu-daily-market-quality.mjs";

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
  evidence_level: "ordinary" | "decisive";
  resolution_action: "unresolved" | "settle_po" | "settle_jo";
  provider: string;
  fallback_index: number;
  fallback_reason: string | null;
}

/** Score open-market evidence with Groq first, then configured Gemini fallbacks only on provider failure. */
export async function scoreMarketWithAI(market: Market, suppliedArticles?: Article[]): Promise<AiScoreResult> {
  const articles = suppliedArticles ?? await articlesForMarket(market);
  const context = articles
    .map((a) => `[${a.slug}] published=${a.publishedAt} source=${a.source} url=${a.url ?? ""}\n${a.title}\n${a.excerpt}\n${String(a.body ?? "").slice(0, 2200)}`)
    .join("\n\n");

  const system =
    "Je analist lajmesh per 383, nje sajt lajmesh ne Kosove. Vleresoje probabilitetin qe nje treg parashikimi te zgjidhet 'PO', bazuar VETEM ne artikujt e dhene. evidence_level duhet te jete 'decisive' VETEM kur te pakten dy artikuj te cituar nga botues te pavarur e vertetojne qarte se rezultati PO eshte pothuajse i pamundur ose pothuajse i sigurt sipas pyetjes dhe kritereve te zgjidhjes. resolution_action duhet te jete 'settle_po' ose 'settle_jo' VETEM kur dy burime te pavarura te cituara konfirmojne nje fakt perfundimtar qe ploteson drejtperdrejt kriteret e zgjidhjes; ndryshe duhet te jete 'unresolved'. Numri i artikujve nuk vendos madhesine e levizjes; lidhja direkte me kriteret e zgjidhjes e vendos. Per cdo rast tjeter perdor 'ordinary' dhe 'unresolved'. Mos shpik fakte, transferime, rezultate ose kritere. Kthe VETEM JSON: " +
    `{"probability": 0.0-1.0, "evidence_level": "ordinary|decisive", "resolution_action": "unresolved|settle_po|settle_jo", "reasoning": "shpjegim i shkurter shqip, maksimumi 280 karaktere", "cited_slugs": ["slug1", "slug2"]}`;
  const criteria = String((market as Market & { resolution_criteria?: string; resolution_rules?: string }).resolution_criteria ?? (market as Market & { resolution_rules?: string }).resolution_rules ?? "").trim();
  const closesAt = Date.parse(String((market as Market & { closes_at?: string }).closes_at ?? ""));
  const remainingHours = Number.isFinite(closesAt) ? Math.max(0, (closesAt - Date.now()) / 3_600_000) : null;
  const user = `Koha aktuale UTC: ${new Date().toISOString()}\nAfati i tregut UTC: ${Number.isFinite(closesAt) ? new Date(closesAt).toISOString() : "i panjohur"}\nOrë të mbetura: ${remainingHours === null ? "e panjohur" : remainingHours.toFixed(2)}\nPyetja e tregut: "${market.question}"\n${market.description ? `Kontekst: ${market.description}\n` : ""}${criteria ? `Kriteret e zgjidhjes: ${criteria}\n` : ""}\nArtikuj të fundit, të plotë dhe të filtruar për këtë treg:\n\n${context || "(pa artikuj të lidhur)"}\n\nMos përdor tituj ose fakte nga kujtesa jote. Mos cito artikull që nuk e ke përdorur. Koha deri në afat duhet të ndikojë në probabilitet kur pyetja kërkon një veprim para një date të caktuar.`;

  const response = await marketAiChat(system, user, { json: true, maxTokens: 900 });
  const parsed = parseJSON<Omit<AiScoreResult, "provider" | "fallback_index" | "fallback_reason">>(response.content);
  return {
    probability: Math.min(1, Math.max(0, Number(parsed.probability))),
    reasoning: String(parsed.reasoning ?? ""),
    cited_slugs: Array.isArray(parsed.cited_slugs) ? parsed.cited_slugs.map(String) : [],
    evidence_level: parsed.evidence_level === "decisive" ? "decisive" : "ordinary",
    resolution_action: parsed.resolution_action === "settle_po" || parsed.resolution_action === "settle_jo" ? parsed.resolution_action : "unresolved",
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
  closes_in_hours: number;
  market_archetype: string;
  topic_key: string;
  decision_point: string;
  why_uncertain: string;
  trading_angle: string;
  resolution_source: string;
  deadline_basis: string;
  threshold_value?: string;
  source_slugs: string[];
}

/** Ask Groq to draft v2 market questions from recent verified news; the admin route still keeps them review-only. */
export async function draftMarketsFromNews(limit = 5): Promise<DraftedMarket[]> {
  const articles = selectDailySourceArticles(await getLatestArticles(60), 24);
  const context = articles.map((a) => JSON.stringify({ slug: a.slug, category: a.category, title: a.title, excerpt: a.excerpt, body: String(a.body ?? "").slice(0, 3500), source: a.source, url: a.url, publishedAt: a.publishedAt })).join("\n");

  const system =
    "Je editor i tregjeve parashikuese per 383. Krijo vetem tregje NON-SPORTS qe nje lexues i Kosoves do t'i debatoje dhe tretoje. Mos perserit titullin e artikullit dhe mos pyet nese nje ngjarje e perfunduar do te konfirmohet. Prefero nje vendim te hapur, prag numerik, publikim te dhenash, emerim/largim, marreveshje ose permbarim/pershkallezim ku PO dhe JO jane realisht te mundshme. Cdo treg duhet te kete market_archetype, topic_key, decision_point, why_uncertain, trading_angle, resolution_source, deadline_basis, closes_in_hours, kriteret eksplicite PO/JO dhe source_slugs. Afati normal eshte 8-96 ore; deri 168 ore vetem per vendim te planifikuar te dokumentuar. Mos perdor closes_in_days. Perdor vetem faktet dhe slug-et e artikujve te dhene. Kthe VETEM JSON.";
  const user = `Koha aktuale: ${new Date().toISOString()}\nArtikujt e verifikuar:\n${context}\n\nKthe deri ne ${limit} tregje me kete forme: {"markets":[{"question":"... deri me <dita> <muaji>?","description":"...","resolution_criteria":"PO: ... JO: ... Burimi i zgjidhjes: ... Afati: ... Edge cases: ...","category":"politike|ekonomi|bote|te-tjera","closes_in_hours":48,"market_archetype":"scheduled_decision|threshold|data_release|policy_action|appointment_or_selection|escalation_or_deescalation|corporate_decision|executive_action","topic_key":"topic-name","decision_point":"...","why_uncertain":"...","trading_angle":"...","resolution_source":"...","deadline_basis":"...","threshold_value":"...","source_slugs":["slug1","slug2"]}]}`;
  const raw = await groqChat(system, user, { json: true, maxTokens: 2400 });
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
