import { NextResponse, type NextRequest } from "next/server";
import { getArticles } from "@/lib/db";
import { shortCode } from "@/lib/short-link.mjs";

/**
 * Short-link resolver: /a/<code> -> /article/<slug>.
 *
 * Codes are derived from the slug, never stored, so this walks the article
 * list and recomputes rather than looking anything up. That is the right
 * trade at this size — the archive is in the low hundreds — and it means a
 * code can never point at an article that has been renamed out from under it.
 *
 * Temporary rather than permanent on purpose: a permanent redirect is cached
 * by browsers forever, and an article that is re-slugged would strand it.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEARCH_LIMIT = 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const wanted = String(code ?? "").trim().toLowerCase();
  if (!wanted) return NextResponse.redirect(new URL("/", request.url), 307);

  const articles = await getArticles(SEARCH_LIMIT);
  const match = articles.find((article) => shortCode(article.slug) === wanted);

  // An unknown code is a stale or mistyped link, not an error worth a page:
  // send the reader to the homepage, which is where they wanted to end up.
  if (!match) return NextResponse.redirect(new URL("/", request.url), 307);

  return NextResponse.redirect(new URL(`/article/${match.slug}`, request.url), 307);
}
