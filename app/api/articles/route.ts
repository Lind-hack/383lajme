import { NextResponse, type NextRequest } from "next/server";
import { getArticlesBefore } from "@/lib/db";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";

export const dynamic = "force-dynamic";

/**
 * "Shfaq më shumë": the next page of news older than `before`.
 *
 * GET /api/articles?before=<iso>&limit=<1-24>&category=<slug>
 *
 * Only what a list row renders goes over the wire — no body, no scoring data —
 * and the response is shared at the edge for two minutes, since every reader
 * paging past the same cursor asks the same question.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(Number.parseInt(params.get("limit") ?? "12", 10) || 12, 24));
  const before = params.get("before");
  const slug = params.get("category");
  // Unknown slugs are ignored rather than echoed into the query.
  const category = slug ? SLUG_TO_CATEGORY[slug] ?? null : null;

  const articles = await getArticlesBefore({ before, limit, category });
  const items = articles.map((article) => ({
    id: article?.id,
    slug: article?.slug,
    title: article?.title,
    excerpt: article?.excerpt ?? "",
    source: article?.source ?? "",
    sourceFlag: article?.sourceFlag ?? "",
    sourceBias: article?.sourceBias ?? "neutral",
    category: article?.category ?? "",
    publishedAt: article?.publishedAt,
    imageUrl: article?.imageUrl ?? null,
  })).filter((item) => item.id && item.slug && item.title && item.publishedAt);

  return NextResponse.json(
    // Judged on the raw page, so one malformed row does not end the list early.
    { items, next: articles.length === limit ? articles[articles.length - 1]?.publishedAt ?? null : null },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
  );
}
