import { NextResponse } from "next/server";
import { gatherEvidence } from "@/lib/dosje-sources.mjs";
import { admin, authorised, dbTopics } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Step three, per subject: the evidence pack.
 *
 * Claims the subject for today first — the unique (subject_key, run_date) in
 * dosje_research_runs makes a second fire a no-op instead of a second spend —
 * then fetches sources from publisher reference lists. A subject without two
 * distinct publishers stops here on a week's cooldown: nothing it could draft
 * would pass, so the model is never asked.
 *
 * The model receives excerpts and may cite only by index. The publish step
 * fetches every cited url again itself; nothing in this response is trusted
 * on the way back.
 */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = new URL(req.url).searchParams.get("topic") ?? "";
  const topic = (await dbTopics()).find((t) => t.slug === slug);
  if (!topic) return NextResponse.json({ ok: false, reason: "unknown_topic" }, { status: 404 });

  const db = admin();
  await db.rpc("dosje_sweep_stale_claims");
  const { data: claim, error: claimError } = await db
    .from("dosje_research_runs")
    .insert({ subject_key: slug, outcome: "in_progress" })
    .select("id")
    .single();
  if (claimError) {
    const duplicate = /duplicate key|already exists|23505/i.test(claimError.message);
    return NextResponse.json(
      duplicate ? { ok: false, reason: "already_ran_today" } : { ok: false, reason: "claim_failed", detail: claimError.message },
      { status: duplicate ? 200 : 500 }
    );
  }

  const query = topic.research_query || topic.title;
  const sources = await gatherEvidence(query, { max: 8, relevanceGroups: topic.research_groups ?? null });
  const publishers = new Set(sources.map((s) => String(s.publisher ?? "").toLowerCase()).filter(Boolean));
  if (publishers.size < 2) {
    await db
      .from("dosje_research_runs")
      .update({
        outcome: "no_sources",
        detail: { query, found: sources.length, publishers: publishers.size },
        cooldown_until: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      })
      .eq("id", claim.id);
    return NextResponse.json({ ok: false, reason: "no_sources", query, found: sources.length, publishers: publishers.size });
  }

  const { data: existing } = await db
    .from("dosje_milestones")
    .select("title, event_date")
    .eq("topic_slug", slug)
    .eq("status", "approved");

  return NextResponse.json({
    ok: true,
    run_id: claim.id,
    topic: { slug: topic.slug, title: topic.title, blurb: topic.blurb, primer: topic.primer },
    query,
    existing: existing ?? [],
    sources: sources.map((s, index) => ({
      index,
      url: s.url,
      publisher: s.publisher,
      title: s.title,
      published_date: s.published_date,
      text: String(s.text ?? "").slice(0, 2500),
    })),
  });
}
