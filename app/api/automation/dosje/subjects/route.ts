import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getArticles } from "@/lib/db";
import { matchTopic, isStandingSubject } from "@/lib/dosje-match.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Which of today's articles belong to a standing subject.
 *
 * This is the link that makes the dossier automatic. It runs on its own clock
 * rather than chained to the news pipeline — the established idiom here, and
 * the safer one: a research outage must never be able to hold up publishing,
 * and nothing this job produces is urgent.
 *
 * It decides two things and writes nothing else.
 *
 * First, does an article belong to a dossier at all. That is matchTopic: the
 * topic needs one of its own anchors, a signal like "nato" can never carry a
 * match alone, an exclude vetoes outright, and an even tie abstains rather than
 * guessing. This is what keeps a NATO exercise in Turkey out of the Kosovo
 * file.
 *
 * Second, whether the subject has earned a dossier. One busy day is one story;
 * a subject that keeps returning across days is a file. Only subjects over that
 * line are handed to the research job, which is the expensive half.
 *
 * No milestone is written here and nothing becomes public. The output is a
 * mapping and a list of candidates.
 */

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.TREGU_AUTOMATION_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return (
    header === `Bearer ${secret}` || new URL(req.url).searchParams.get("secret") === secret
  );
}

type TopicRow = {
  slug: string;
  title: string;
  anchors: string[] | null;
  signals: string[] | null;
  excludes: string[] | null;
};

async function run(req: Request, dryRun: boolean) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Every topic, not only the approved ones: a dossier still in review must
  // keep accumulating evidence, or it can never reach the point of publishing.
  const { data: topicRows, error: topicError } = await supabase
    .from("dosje_topics")
    .select("slug, title, anchors, signals, excludes")
    .neq("status", "retired");

  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 });
  }

  const topics = (topicRows ?? []).map((t) => ({
    ...(t as TopicRow),
    anchors: (t as TopicRow).anchors ?? [],
    signals: (t as TopicRow).signals ?? [],
    excludes: (t as TopicRow).excludes ?? [],
  }));
  if (!topics.length) {
    return NextResponse.json({ ok: true, reason: "no_topics", matched: 0 });
  }

  const articles = await getArticles(200);

  const matches: Array<{
    article_slug: string;
    topic_slug: string;
    score: number;
    method: "rule";
    reasons: Record<string, unknown>;
    publishedAt: string;
  }> = [];

  for (const a of articles) {
    const m = matchTopic(a, topics);
    if (!m) continue;
    matches.push({
      article_slug: a.slug,
      topic_slug: m.topic.slug,
      score: m.score,
      method: "rule",
      // Why this matched, kept so a decision can be argued with later rather
      // than taken on faith.
      reasons: m.reasons,
      publishedAt: a.publishedAt,
    });
  }

  // Which subjects are standing, not merely busy today.
  const byTopic = new Map<string, typeof matches>();
  for (const m of matches) {
    if (!byTopic.has(m.topic_slug)) byTopic.set(m.topic_slug, []);
    byTopic.get(m.topic_slug)!.push(m);
  }

  const candidates: Array<{ topic: string; title: string; articles: number; days: number }> = [];
  for (const [slug, rows] of byTopic) {
    const standing = isStandingSubject(
      rows.map((r) => ({ articleSlug: r.article_slug, publishedAt: r.publishedAt }))
    );
    if (!standing) continue;
    candidates.push({
      topic: slug,
      title: topics.find((t) => t.slug === slug)?.title ?? slug,
      articles: rows.length,
      days: new Set(rows.map((r) => String(r.publishedAt).slice(0, 10))).size,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      articlesScanned: articles.length,
      matched: matches.length,
      candidates,
    });
  }

  // Upsert so a re-run is idempotent: the same article keeps the same topic and
  // the decision is simply refreshed.
  let written = 0;
  if (matches.length) {
    const { error } = await supabase.from("dosje_article_topics").upsert(
      matches.map(({ publishedAt, ...row }) => ({
        ...row,
        // Keep the publication date. Whether a subject is standing is a fact
        // about the news, not about when this job happened to run — and
        // discarding it here is what made the selector count every mapping run
        // as a single day and never return a candidate.
        published_at: publishedAt ?? null,
        decided_at: new Date().toISOString(),
      })),
      { onConflict: "article_slug,topic_slug" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    written = matches.length;
  }

  return NextResponse.json({
    ok: true,
    articlesScanned: articles.length,
    matched: written,
    candidates,
  });
}

export async function POST(req: Request) {
  return run(req, false);
}

/** Read-only: what it would decide, writing nothing. */
export async function GET(req: Request) {
  return run(req, true);
}
