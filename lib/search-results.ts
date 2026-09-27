import { getSearchData, type ArticleRecord } from "@/lib/search-sources";
import { search, closest } from "@/lib/search-match.mjs";
import { resolveEntity, surfaceForms, mentions } from "@/lib/entities.mjs";
import type { Article } from "@/lib/mock-data";

/**
 * Everything the /kerko page shows for a query, in reading order, computed in
 * one place so the page and the endless list behind it (/api/search/results)
 * agree on what comes next.
 *
 *   articles  stories about the subject the query names (if it names one),
 *             then stories matching every term; when nothing matches every
 *             term, the closest instead (`exact` false)
 *   related   the non-article matches — topics, places, sections — as chips
 *   market    the best matching Tregu market, for the sponsored slot
 */
export type SearchRelated = { kind: string; title: string; href: string };
export type SearchMarket = { title: string; href: string; meta?: string };

export type SearchResults = {
  query: string;
  articles: Article[];
  exact: boolean;
  entity: { name: string; role?: string } | null;
  related: SearchRelated[];
  market: SearchMarket | null;
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

export async function searchResults(rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim().slice(0, 120);
  const empty: SearchResults = { query, articles: [], exact: true, entity: null, related: [], market: null };
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

  const entity = resolveEntity(query, [...subjects, ...people]);
  if (entity) {
    const forms = surfaceForms(entity);
    for (const a of articles) if (mentions(a, forms)) add(a);
  }

  const articleEntries = entries.filter((e) => e.kind === "artikull");
  const [group] = search(articleEntries, query, { perGroup: MAX_RESULTS, total: MAX_RESULTS });
  for (const item of group?.items ?? []) add(bySlug.get(slugOf(item.href) ?? ""));

  let exact = true;
  if (out.length === 0) {
    exact = false;
    for (const item of closest(articleEntries, query, { limit: 120 })) add(bySlug.get(slugOf(item.href) ?? ""));
  }

  const others = search(
    entries.filter((e) => e.kind !== "artikull"),
    query,
    { perGroup: 6, total: 24 },
  );
  const related: SearchRelated[] = [];
  let market: SearchMarket | null = null;
  for (const g of others) {
    for (const item of g.items) {
      if (g.kind === "treg") {
        market ??= { title: item.title, href: item.href, meta: item.meta };
        continue;
      }
      if (entity && item.title === entity.name) continue;
      if (related.length < 10) related.push({ kind: g.kind, title: item.title, href: item.href });
    }
  }

  return {
    query,
    articles: out.slice(0, MAX_RESULTS).map(toArticle),
    exact,
    entity: entity ? { name: entity.name, role: entity.role } : null,
    related,
    market,
  };
}
