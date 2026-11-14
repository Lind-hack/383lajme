import { getSearchData, type ArticleRecord } from "@/lib/search-sources";
import { search, closest } from "@/lib/search-match.mjs";
import { resolveEntity, nameForms, mentions } from "@/lib/entities.mjs";
import type { Article } from "@/lib/mock-data";
import type { SectionMarket } from "@/lib/kategori-market";

/**
 * Everything the /kerko page shows for a query, in reading order, computed in
 * one place so the page and the endless list behind it (/api/search/results)
 * agree on what comes next.
 *
 *   articles  stories about the subject the query names (if it names one),
 *             then stories matching every term; when nothing matches every
 *             term, the closest instead (`exact` false)
 *   related   the non-article matches — topics, places, sections — as chips
 *   market    the best matching open Tregu market, for the feed's market card
 *   categories how many of the matches fall in each section, for the filter
 *
 * `category` narrows the articles to one section; `sort: "new"` orders them
 * newest first instead of by relevance. Counts are taken before the filter,
 * so every chip keeps its number while one is selected.
 */
export type SearchRelated = { kind: string; title: string; href: string };
export type SearchSort = "rel" | "new";
export type SearchOptions = { category?: string | null; sort?: SearchSort };

export type SearchResults = {
  query: string;
  articles: Article[];
  exact: boolean;
  entity: { name: string; role?: string } | null;
  related: SearchRelated[];
  market: SectionMarket | null;
  categories: { name: string; count: number }[];
};

const MAX_RESULTS = 600;

/** A results card needs an Article; the index carries only what cards show. */
export function toArticle(r: ArticleRecord): Article {
  return {
    id: r.id ?? r.slug,
    slug: r.slug,
    dispatch: "",
    title: r.title,
    excerpt: r.body,
    body: "",
    source: r.source ?? "",
    sourceFlag: r.sourceFlag ?? "",
    sourceBias: "neutral",
    tone: "neutral",
    category: r.category ?? "",
    publishedAt: r.publishedAt ?? "",
    readingTime: 1,
    featured: false,
    imageUrl: r.imageUrl,
  };
}

export async function searchResults(rawQuery: string, options: SearchOptions = {}): Promise<SearchResults> {
  const query = rawQuery.trim().slice(0, 120);
  const empty: SearchResults = {
    query,
    articles: [],
    exact: true,
    entity: null,
    related: [],
    market: null,
    categories: [],
  };
  if (query.length < 2) return empty;

  const { entries, articles, people, subjects } = await getSearchData();
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const slugOf = (href: string) => (href.startsWith("/article/") ? href.slice("/article/".length) : null);

  const out: ArticleRecord[] = [];
  const seen = new Set<string>();
  const add = (r: ArticleRecord | undefined) => {
    if (!r || seen.has(r.slug)) return;
    seen.add(r.slug);
    out.push(r);
  };

  // Only a real subject — a person, country, city or organisation — becomes
  // the page's heading and leads the list. A news topic that merely contains
  // the word ("kosova" -> a match report about Kosovë) is a chip, not the
  // subject of the search.
  const named = resolveEntity(query, [...subjects, ...people]);
  const entity = named && !["tema", "teme"].includes(named.kind) ? named : null;
  const forms = entity ? nameForms(entity) : [];
  if (entity) for (const a of articles) if (mentions(a, forms)) add(a);
  // When the query names someone or somewhere, every story listed has to be
  // about them. The word search alone reads "kane" in "kanë" (they have), so
  // "Harry Kane" listed Trump and Zelensky under his own stories.
  const about = (r: ArticleRecord | undefined) => (!entity || (r && mentions(r, forms)) ? r : undefined);

  const articleEntries = entries.filter((e) => e.kind === "artikull");
  const [group] = search(articleEntries, query, { perGroup: MAX_RESULTS, total: MAX_RESULTS });
  for (const item of group?.items ?? []) add(about(bySlug.get(slugOf(item.href) ?? "")));

  let exact = true;
  if (out.length === 0) {
    exact = false;
    for (const item of closest(articleEntries, query, { limit: 120 })) add(about(bySlug.get(slugOf(item.href) ?? "")));
  }

  const others = search(
    entries.filter((e) => e.kind !== "artikull"),
    query,
    { perGroup: 6, total: 24 },
  );
  const related: SearchRelated[] = [];
  let market: SectionMarket | null = null;
  for (const g of others) {
    for (const item of g.items) {
      if (g.kind === "treg") {
        // Only a market the reader can still pick on; a settled one is not an ask.
        // search() keeps every field of the entry; its JSDoc type names only some.
        const m = item as typeof item & { open?: boolean; prob?: number | null; closesAt?: string };
        if (!market && m.open && m.href.startsWith("/tregu/")) {
          market = {
            slug: m.href.slice("/tregu/".length),
            question: m.title,
            prob: typeof m.prob === "number" ? m.prob : null,
            closesAt: m.closesAt ?? "",
          };
        }
        continue;
      }
      if (entity && item.title === entity.name) continue;
      if (related.length < 10) related.push({ kind: g.kind, title: item.title, href: item.href });
    }
  }

  const matched = out.slice(0, MAX_RESULTS);
  const tally = new Map<string, number>();
  for (const r of matched) if (r.category) tally.set(r.category, (tally.get(r.category) ?? 0) + 1);
  const categories = [...tally]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  let shown = options.category ? matched.filter((r) => r.category === options.category) : matched;
  if (options.sort === "new") {
    shown = [...shown].sort((a, b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0));
  }

  return {
    query,
    articles: shown.map(toArticle),
    exact,
    entity: entity ? { name: entity.name, role: entity.role } : null,
    related,
    market,
    categories,
  };
}
