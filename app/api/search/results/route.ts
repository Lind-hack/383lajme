import { NextResponse, type NextRequest } from "next/server";
import { searchResults } from "@/lib/search-results";
import { RESOLVABLE_SLUGS } from "@/lib/category-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The endless list on /kerko: the next page of the same ranked results the
 * page rendered, by position.
 *
 * GET /api/search/results?q=<query>&offset=<n>&limit=<1-24>[&kat=<slug>][&rendit=te-rejat]
 *
 * `kat` and `rendit` are the page's own filter and sort, so the list keeps
 * paging through the same narrowed, ordered set the page started.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.max(1, Math.min(Number.parseInt(params.get("limit") ?? "12", 10) || 12, 24));

  const kat = params.get("kat");
  const category = kat ? (RESOLVABLE_SLUGS[kat] ?? null) : null;
  const sort = params.get("rendit") === "te-rejat" ? "new" : "rel";
  const { articles } = await searchResults(q, { category, sort });
  const items = articles.slice(offset, offset + limit).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    source: a.source,
    sourceFlag: a.sourceFlag,
    sourceBias: a.sourceBias,
    category: a.category,
    publishedAt: a.publishedAt,
    imageUrl: a.imageUrl ?? null,
  }));
  const next = offset + limit < articles.length ? String(offset + limit) : null;
  return NextResponse.json({ items, next }, { headers: { "Cache-Control": "no-store" } });
}
