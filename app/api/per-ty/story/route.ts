import { NextResponse, type NextRequest } from "next/server";
import { getArticleBySlug } from "@/lib/db";
import { toParagraphs } from "@/lib/article-body.mjs";
import { keyPoints } from "@/lib/key-points.mjs";
import { countWords } from "@/lib/reading-engagement.mjs";
import { isArticleSlug } from "@/lib/article-comments.mjs";

export const dynamic = "force-dynamic";

/**
 * One story for the Për ty reel: its key points for the card and its text for
 * reading it without leaving the reel (app/per-ty/paper/reader-sheet.tsx).
 *
 * GET /api/per-ty/story?slug=<slug>
 *
 * The same for every reader, so it is shared at the edge.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!isArticleSlug(slug)) return NextResponse.json({ ok: false }, { status: 400 });

  const article = await getArticleBySlug(slug).catch(() => null);
  if (!article) return NextResponse.json({ ok: false }, { status: 404 });

  const paragraphs = toParagraphs(article.body);
  return NextResponse.json(
    {
      ok: true,
      points: keyPoints({ title: article.title, excerpt: article.excerpt, paragraphs }),
      paragraphs,
      words: countWords(article.body),
      city: article.city ?? null,
      caption: article.imageCaption ?? null,
      credit: article.imageCreator ?? null,
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
