import { NextResponse } from "next/server";
import { getArticleBySlug, getArticles, getArticlesBefore, getLatestArticles } from "@/lib/db";
import { freshNews } from "@/lib/fresh-news.mjs";
import { pickFrontPage } from "@/lib/front-page.mjs";

/**
 * The stories the video edition is made of: the front page's seven, picked
 * the way the homepage picks its front block (app/page.tsx), in its order.
 * The VPS edition job (scripts/video_edition.py) reads this, writes and
 * voices a clip for each, and publishes the edition to storage.
 */
export const revalidate = 300;

export async function GET() {
  const [ranked, latest, recent] = await Promise.all([getArticles(60), getLatestArticles(10), getArticlesBefore({ limit: 120 })]);
  const now = Date.now();
  const pool = freshNews([...ranked, ...recent, ...latest], { now, count: 200 });
  const picked = pickFrontPage(pool, 7, now);
  // The pool's lists carry no bodies or photo credits; the clip is written
  // from the whole story, and its photo is credited the way the story page credits it.
  const full = await Promise.all(picked.map((a) => getArticleBySlug(a.slug)));
  const stories = picked.map((a, i) => {
    const f = full[i] ?? a;
    return {
      slug: f.slug,
      title: f.title,
      excerpt: f.excerpt,
      body: (f.body ?? "").slice(0, 6000),
      category: f.category,
      publishedAt: f.publishedAt,
      imageUrl: f.imageUrl ?? "",
      imageCreator: f.imageCreator ?? "",
      imageLicense: f.imageLicense ?? "",
      imageSourcePage: f.imageSourcePage ?? "",
    };
  });
  return NextResponse.json({ generatedAt: new Date(now).toISOString(), stories }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
