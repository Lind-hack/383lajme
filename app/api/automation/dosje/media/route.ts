import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSource } from "@/lib/dosje-sources.mjs";
import { TOPICS } from "@/lib/topics.mjs";
import { checkVideo, admissible } from "@/lib/dosje-video.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Photographs for moments, and keeping videos honest.
 *
 * The archive cannot illustrate this history and never could: 383 begins in
 * 2026 and the moments run from 1990, so any archive photograph beside them is
 * a picture of something else. That is what produced a Bitcoin chart under the
 * 2013 NATO drawdown captioned as coverage of it.
 *
 * The only defensible photograph is the one on the page that proves the claim.
 * If Reuters reported the event, the image Reuters put on that report is of
 * that event, and it arrives with a publisher and a link a reader can follow to
 * check. So candidates are read from the citations a milestone already has —
 * never searched for separately, because a search would find something for
 * every moment and finding something is the failure mode.
 *
 * Nothing here publishes. Every candidate is written unapproved and appears in
 * /admin/dosje, because deciding a photograph depicts a historical event is an
 * editorial judgement and not one a fetch can make.
 *
 * The same route re-checks videos. A dead link renders a broken thumbnail
 * forever otherwise: the ids were verified by hand once and nothing has looked
 * at them since.
 */

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.TREGU_AUTOMATION_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}` || new URL(req.url).searchParams.get("secret") === secret;
}

/** Obvious non-photographs: logos, spacers, sharing badges. */
function looksLikeArticleImage(url: string): boolean {
  const u = url.toLowerCase();
  if (!/^https:\/\//.test(u)) return false;
  if (/\.svg(\?|$)/.test(u)) return false;
  return !/(logo|sprite|placeholder|avatar|icon|favicon|pixel|1x1|blank|default)/.test(u);
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 10);

  // ── photographs, from the citations a moment already rests on ──────────────
  const { data: milestones, error } = await supabase
    .from("dosje_milestones")
    .select("id, title, dosje_citations(url, publisher), dosje_media(id)")
    .in("status", ["approved", "draft"])
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let proposed = 0;
  let examined = 0;

  for (const m of milestones ?? []) {
    const row = m as unknown as {
      id: string;
      dosje_citations: { url: string; publisher: string | null }[] | null;
      dosje_media: { id: string }[] | null;
    };
    // A moment that already has a candidate is left alone; this job must not
    // re-propose the same photograph every night.
    if (row.dosje_media?.length) continue;

    for (const c of row.dosje_citations ?? []) {
      examined += 1;
      const page = await fetchSource(c.url);
      const img = page.image;
      if (!img || !looksLikeArticleImage(img)) continue;

      const { error: insertError } = await supabase.from("dosje_media").insert({
        milestone_id: row.id,
        kind: "image",
        url: img,
        credit: c.publisher,
        // The report that carries the claim and the photograph are the same
        // page, so the reader can check both at once.
        source_url: c.url,
        license: null,
        relation: "contemporaneous_coverage",
        checked_at: new Date().toISOString(),
        check_status: page.http_status,
        approved: false,
      });
      if (!insertError) proposed += 1;
      break; // one candidate per moment; the reviewer picks or rejects it
    }
  }

  // ── videos ─────────────────────────────────────────────────────────────────
  //
  // Explainers were the one part of the dossier nothing checked: written into
  // lib/topics.mjs by hand, rendered from there, never approved and never
  // re-examined. That is how an anonymous commentary channel came to be the
  // explainer for KFOR.
  //
  // They now enter the same queue as everything else. The channel must be a
  // newsroom and the video must still exist; both are conditions to be offered
  // for review, not to be published.
  let vetted = 0;
  const refused: Array<{ id: string; author: string | null; reason: string | null }> = [];

  // What is already in the queue, so a nightly run proposes each explainer once
  // rather than stacking a duplicate every night.
  const { data: existingVideos } = await supabase
    .from("dosje_media")
    .select("url")
    .eq("kind", "video");
  const known = new Set((existingVideos ?? []).map((r) => (r as { url: string }).url));

  for (const topic of TOPICS as { slug: string; videos?: { id: string }[] }[]) {
    for (const v of topic.videos ?? []) {
      if (known.has(`https://www.youtube.com/watch?v=${v.id}`)) continue;
      const check = await checkVideo(v.id);
      const verdict = admissible(check);
      if (!verdict.ok) {
        refused.push({ id: v.id, author: check.author, reason: verdict.reason });
        continue;
      }
      const { error: insertError } = await supabase.from("dosje_media").insert({
        topic_slug: topic.slug,
        kind: "video",
        url: check.url,
        // Who made it and how they are funded, so the reviewer weighs a
        // state broadcaster knowingly rather than by accident.
        credit: check.vetted?.funding
          ? `${check.author} (${check.vetted.funding})`
          : check.author,
        source_url: check.url,
        relation: "explainer",
        checked_at: new Date().toISOString(),
        check_status: check.http_status,
        approved: false,
      });
      if (!insertError) {
        known.add(check.url);
        vetted += 1;
      }
    }
  }

  // ── videos already in the queue: do they still exist? ──────────────────────
  const { data: videos } = await supabase
    .from("dosje_media")
    .select("id, url")
    .eq("kind", "video")
    .limit(50);

  let checked = 0;
  let retired = 0;
  for (const v of videos ?? []) {
    const row = v as { id: string; url: string };
    const id = (row.url.match(/[?&]v=([^&]+)/) || [])[1] ?? "";
    const check = id ? await checkVideo(id) : null;
    checked += 1;
    // Only a definite "gone" takes a video down. A check that could not run is
    // recorded and left alone, because a network failure is not evidence.
    const dead = check?.alive === false;
    await supabase
      .from("dosje_media")
      .update({
        checked_at: new Date().toISOString(),
        check_status: check?.http_status ?? null,
        ...(dead ? { approved: false } : {}),
      })
      .eq("id", row.id);
    if (dead) retired += 1;
  }

  return NextResponse.json({
    ok: true,
    images: { examined, proposed, awaiting_review: proposed },
    videos: { proposed: vetted, refused, rechecked: checked, retired },
  });
}

/** Read-only: what it would propose, writing nothing. */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data } = await supabase
    .from("dosje_milestones")
    .select("id, title, dosje_citations(url, publisher), dosje_media(id)")
    .in("status", ["approved", "draft"])
    .limit(10);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    dosje_citations: { url: string; publisher: string | null }[] | null;
    dosje_media: { id: string }[] | null;
  }[];

  return NextResponse.json({
    candidates: rows
      .filter((r) => !r.dosje_media?.length)
      .map((r) => ({
        title: r.title,
        citations: (r.dosje_citations ?? []).length,
        publishers: [...new Set((r.dosje_citations ?? []).map((c) => c.publisher))],
      })),
  });
}
