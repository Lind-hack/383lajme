import { NextResponse } from "next/server";
import { authorised, CAPS, clustersToday, dueSubjects } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Step one of the daily dossier run: what to work on.
 *
 * Returns the clusters of recent coverage no dossier covers yet (for the model
 * to name as new topics) and the existing topics due for research. Nothing is
 * written. ?backfill=1 raises the caps for the one-off rebuild after a wipe.
 */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const backfill = new URL(req.url).searchParams.get("backfill") === "1";
  const caps = backfill ? CAPS.backfill : CAPS.daily;

  const { articles, topics, clusters } = await clustersToday(backfill);
  const due = await dueSubjects(caps.subjects, articles, topics);

  return NextResponse.json({
    ok: true,
    caps,
    topics: topics.map((t) => ({ slug: t.slug, title: t.title, status: t.status })),
    clusters: clusters.map((c) => ({
      id: c.id,
      size: c.size,
      days: c.days,
      shared: c.shared,
      articles: c.articles.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt ?? "", publishedAt: a.publishedAt ?? null })),
    })),
    due: due.map((d) => ({
      slug: d.topic.slug,
      title: d.topic.title,
      blurb: d.topic.blurb,
      status: d.topic.status,
      lastRun: d.lastRun,
      headlines: d.articles.slice(0, 8).map((a) => a.title),
    })),
  });
}
