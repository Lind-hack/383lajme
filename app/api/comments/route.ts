import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicProfileName } from "@/lib/profile-hub.mjs";
import { RATE_MAX, RATE_WINDOW_S, THREAD_LIMIT, bodyProblem, cleanBody, isArticleSlug, isCommentId } from "@/lib/article-comments.mjs";
import { isKnownVideoKey } from "@/lib/video-feed";


/**
 * Readers' comments under a story (lib/article-comments.mjs, table
 * article_comments, migration 0108).
 *
 *   GET    ?slug=…                    → { ok, comments, viewer: { signedIn, name } }
 *   POST   { slug, body, parentId? }  → { comment }      signed-in readers only
 *   DELETE { id }                     → { ok }           the reader's own comment
 *
 * The reader is whoever the session cookie says; every write then goes
 * through the service role, because the tables have RLS on and no policies.
 * Without the table (migration not applied) or a database, GET answers
 * ok: false and the comment buttons stay out of sight.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { id: number; parent_id: number | null; author_name: string; body: string; created_at: string; user_id: string };

const shape = (r: Row, viewer: string | null) => ({
  id: r.id,
  parentId: r.parent_id,
  name: r.author_name,
  body: r.body,
  createdAt: r.created_at,
  mine: viewer !== null && r.user_id === viewer,
});

async function viewer() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/** The name a comment goes out under: the reader's public profile name. */
async function authorName(client: NonNullable<ReturnType<typeof createAdminClient>>, user: { id: string; user_metadata?: Record<string, unknown> }) {
  const { data } = await client.from("profiles").select("display_name, is_anonymous").eq("id", user.id).maybeSingle();
  const meta = user.user_metadata ?? {};
  const fromMeta = [meta.full_name, meta.name, meta.first_name].find((v) => typeof v === "string" && v.trim());
  const name = publicProfileName(data, typeof fromMeta === "string" ? fromMeta : "Lexues");
  return String(name).replace(/\s+/g, " ").trim().slice(0, 48) || "Lexues";
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!isArticleSlug(slug)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const client = createAdminClient();
  const user = await viewer();
  const who = { signedIn: Boolean(user), name: null as string | null };
  if (!client) return NextResponse.json({ ok: false, comments: [], viewer: who });

  const { data, error } = await client
    .from("article_comments")
    .select("id, parent_id, author_name, body, created_at, user_id")
    .eq("article_slug", slug)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(THREAD_LIMIT);
  if (error) {
    console.warn("[comments] thread unavailable", error.message);
    return NextResponse.json({ ok: false, comments: [], viewer: who });
  }
  if (user) who.name = await authorName(client, user);
  return NextResponse.json(
    { ok: true, comments: (data as Row[]).map((r) => shape(r, user?.id ?? null)), viewer: who },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await viewer();
  if (!user) return NextResponse.json({ error: "Hyr në llogari për të komentuar." }, { status: 401 });

  let payload: { slug?: unknown; body?: unknown; parentId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  }
  const { slug, parentId } = payload ?? {};
  if (!isArticleSlug(slug)) return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  const problem = bodyProblem(payload?.body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (parentId != null && !isCommentId(parentId)) return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });

  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Komentet s'janë në punë tani." }, { status: 503 });

  // Only stories that exist, or a video the "Video" rows show.
  if (!(await isKnownVideoKey(slug))) {
    const { data: found } = await client.from("news_articles").select("slug").eq("slug", slug).maybeSingle();
    if (!found) return NextResponse.json({ error: "Ky lajm nuk u gjet." }, { status: 404 });
  }

  // A reply goes under a visible comment of the same story; a reply to a reply goes under its comment.
  let parent: number | null = null;
  if (parentId != null) {
    const { data: p } = await client.from("article_comments").select("id, parent_id, article_slug, status").eq("id", parentId).maybeSingle();
    if (!p || p.article_slug !== slug || p.status !== "visible") return NextResponse.json({ error: "Ky koment s'është më." }, { status: 404 });
    parent = p.parent_id ?? p.id;
  }

  // Slow down a flood: RATE_MAX comments a minute per reader.
  const since = new Date(Date.now() - RATE_WINDOW_S * 1000).toISOString();
  const { count } = await client.from("article_comments").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) return NextResponse.json({ error: "Shumë komente njëherësh — prit pak." }, { status: 429 });

  const { data, error } = await client
    .from("article_comments")
    .insert({ article_slug: slug, user_id: user.id, author_name: await authorName(client, user), body: cleanBody(payload.body), parent_id: parent })
    .select("id, parent_id, author_name, body, created_at, user_id")
    .single();
  if (error || !data) {
    console.warn("[comments] save failed", error?.message);
    return NextResponse.json({ error: "Nuk u ruajt — provo sërish." }, { status: 500 });
  }
  return NextResponse.json({ comment: shape(data as Row, user.id) });
}

export async function DELETE(request: Request) {
  const user = await viewer();
  if (!user) return NextResponse.json({ error: "Hyr në llogari." }, { status: 401 });
  let payload: { id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  }
  if (!isCommentId(payload?.id)) return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Komentet s'janë në punë tani." }, { status: 503 });
  const { data, error } = await client
    .from("article_comments")
    .update({ status: "deleted" })
    .eq("id", payload.id)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data?.length) return NextResponse.json({ error: "Nuk u fshi." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
