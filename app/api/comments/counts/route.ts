import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countsFrom, parseArticleSlugs } from "@/lib/article-comments.mjs";

/**
 * GET ?slugs=a,b,c → { ok, counts: { slug: n } } — visible comments per story,
 * for the count on each comment button (migration 0108).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const slugs = parseArticleSlugs(new URL(request.url).searchParams.get("slugs"));
  const client = createAdminClient();
  if (!client || !slugs.length) return NextResponse.json({ ok: Boolean(client), counts: {} });
  const { data, error } = await client.rpc("article_comment_counts", { slugs });
  if (error) {
    console.warn("[comments] counts unavailable", error.message);
    return NextResponse.json({ ok: false, counts: {} });
  }
  return NextResponse.json({ ok: true, counts: countsFrom(data) }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } });
}
