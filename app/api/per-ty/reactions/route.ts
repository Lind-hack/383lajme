import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReaction, isStorySlug, isVoter, parseSlugs, talliesFrom } from "@/lib/story-reactions.mjs";
import { isKnownVideoKey } from "@/lib/video-feed";


/**
 * Readers' reactions to Për ty stories (lib/story-reactions.mjs, table
 * story_reactions, migration 0105).
 *
 *   GET  ?slugs=a,b,c                → { ok, tallies: { slug: { reaction: n } } }
 *   POST { slug, reaction, voter }   → { tally } for that story, after saving
 *
 * One reaction per anonymous voter per story; reacting again changes it. The
 * voter id is the same device id the daily poll uses — no account, no PII.
 * Without the table (migration not applied) or a database, GET answers with
 * no tallies and POST with 503, and the reel simply shows no results.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function tallyFor(slugs: string[]) {
  const client = createAdminClient();
  if (!client || !slugs.length) return null;
  const { data, error } = await client.rpc("story_reaction_tallies", { slugs });
  if (error) {
    console.warn("[story-reactions] tallies unavailable", error.message);
    return null;
  }
  return talliesFrom(data);
}

export async function GET(request: Request) {
  const slugs = parseSlugs(new URL(request.url).searchParams.get("slugs"));
  const tallies = await tallyFor(slugs);
  // ok: false tells the reel to leave reactions out rather than show buttons that cannot save.
  return NextResponse.json({ ok: tallies !== null || !slugs.length, tallies: tallies ?? {} }, { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" } });
}

export async function POST(request: Request) {
  let body: { slug?: unknown; reaction?: unknown; voter?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { slug, reaction, voter } = body ?? {};
  if (!isStorySlug(slug) || !isReaction(reaction) || !isVoter(voter)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  // Only stories that exist, or a video the "Video" rows show: a reaction
  // cannot be parked on an invented slug.
  if (!(await isKnownVideoKey(slug))) {
    const { data: found, error: findError } = await client.from("news_articles").select("slug").eq("slug", slug).maybeSingle();
    if (findError || !found) return NextResponse.json({ error: "unknown story" }, { status: 404 });
  }

  const { error } = await client
    .from("story_reactions")
    .upsert({ article_slug: slug, reaction, voter_id: voter, updated_at: new Date().toISOString() }, { onConflict: "article_slug,voter_id" });
  if (error) {
    console.warn("[story-reactions] save failed", error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const tallies = await tallyFor([slug]);
  return NextResponse.json({ tally: tallies?.[slug] ?? { [reaction]: 1 } }, { headers: { "Cache-Control": "no-store" } });
}
