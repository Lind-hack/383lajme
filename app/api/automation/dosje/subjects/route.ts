import { NextResponse, type NextRequest } from "next/server";
import { isAutomationRequest } from "@/lib/require-automation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getArticles, getArticlesBefore } from "@/lib/db";
import { TOPICS } from "@/lib/topics.mjs";
import { matchTopic, isStandingSubject } from "@/lib/dosje-match.mjs";
import { newestArticles } from "@/lib/dosje-article-scan.mjs";
import { linkJudgePrompt, readLinkJudgement } from "@/lib/dosje-judge.mjs";
import { llmJSON } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

// The shared gate: either automation secret, Bearer header only, constant
// time. The daily dossier run on the VPS holds TREGU_AUTOMATION_SECRET.
function authorised(req: Request): boolean {
  return isAutomationRequest(req as NextRequest);
}

type TopicRow = {
  slug: string;
  title: string;
  blurb?: string | null;
  status?: string | null;
  anchors: string[] | null;
  signals: string[] | null;
  excludes: string[] | null;
  match_groups?: string[][] | null;
  context?: string[] | null;
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
    .select("slug, title, blurb, status, anchors, signals, excludes, match_groups, context")
    .neq("status", "retired");

  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 });
  }

  const topics = (topicRows ?? []).map((t) => {
    const row = t as TopicRow;
    const canonical = TOPICS.find((candidate) => candidate.slug === row.slug);
    return {
      ...row,
      anchors: canonical?.anchors ?? row.anchors ?? [],
      signals: canonical?.signals ?? row.signals ?? [],
      excludes: canonical?.excludes ?? row.excludes ?? [],
      // Topics the daily run creates carry their own fingerprints (0115).
      matchGroups: canonical?.matchGroups ?? row.match_groups ?? [],
      context: canonical?.context ?? row.context ?? [],
    };
  });
  if (!topics.length) {
    return NextResponse.json({ ok: true, reason: "no_topics", matched: 0 });
  }

  // The newest stories as well as the most-read: getArticles orders by
  // engagement, so on its own it missed what was published today. Four pages
  // is about two weeks: a new dossier must reach the stories behind it.
  const [recent, popular] = await Promise.all([
    newestArticles(getArticlesBefore, { pageSize: 150, pages: 4 }),
    getArticles(200, undefined, { withBody: false }),
  ]);
  const articles = [...new Map([...recent, ...popular].map((a) => [a.slug, a])).values()];

  const matches: Array<{
    article_slug: string;
    topic_slug: string;
    score: number;
    method: "rule" | "llm";
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

  // ── a second reader for links to a public dossier ────────────────────────
  //
  // Words alone put a U21 match (scorer: Berisha) in the Sali Berisha dossier
  // and a Flydubai story quoting Netanyahu in his (3 Nov 2026). A link to a
  // public dossier is shown to readers only once a model has confirmed, in one
  // batch per dossier, that the article is about its subject (method "llm").
  // Rejected matches are dropped, so an existing bad link is pruned below and
  // the email says "Nuk shfaqet më te". If the judge cannot be reached, the
  // links stay unchecked ("rule") and pages do not show them.
  let linkJudge: { asked: number; accepted: number; refused: number; failed: number } | null = null;
  if (!dryRun) {
    const publicTopics = new Map(topics.filter((t) => t.status === "approved").map((t) => [t.slug, t]));
    const checked = new Set<string>();
    const candidateSlugs = [...new Set(matches.filter((m) => publicTopics.has(m.topic_slug)).map((m) => m.article_slug))];
    for (let i = 0; i < candidateSlugs.length; i += 50) {
      const { data } = await supabase
        .from("dosje_article_topics")
        .select("article_slug, topic_slug")
        .eq("method", "llm")
        .in("article_slug", candidateSlugs.slice(i, i + 50));
      for (const r of (data ?? []) as Array<{ article_slug: string; topic_slug: string }>) checked.add(`${r.article_slug}:${r.topic_slug}`);
    }
    const bySlug = new Map(articles.map((a) => [a.slug, a]));
    linkJudge = { asked: 0, accepted: 0, refused: 0, failed: 0 };
    const refused = new Set<string>();
    for (const [slug, topic] of publicTopics) {
      const pending = matches.filter((m) => m.topic_slug === slug && !checked.has(`${m.article_slug}:${slug}`)).slice(0, 40);
      if (!pending.length) continue;
      linkJudge.asked += pending.length;
      const { system, prompt } = linkJudgePrompt(
        { title: topic.title, blurb: topic.blurb ?? "" },
        pending.map((m) => ({ slug: m.article_slug, title: bySlug.get(m.article_slug)?.title, excerpt: bySlug.get(m.article_slug)?.excerpt }))
      );
      let accepted: Set<string>;
      try {
        accepted = readLinkJudgement(
          await llmJSON<unknown>(system, prompt, { prefer: "gemini", maxTokens: 2048, temperature: 0, timeoutMs: 60_000 }),
          pending.map((m) => m.article_slug)
        );
      } catch {
        linkJudge.failed += pending.length;
        continue;
      }
      for (const m of pending) {
        if (accepted.has(m.article_slug)) {
          checked.add(`${m.article_slug}:${slug}`);
          linkJudge.accepted += 1;
        } else {
          refused.add(`${m.article_slug}:${slug}`);
          linkJudge.refused += 1;
        }
      }
    }
    for (const m of matches) if (checked.has(`${m.article_slug}:${m.topic_slug}`)) m.method = "llm";
    for (let i = matches.length - 1; i >= 0; i--) {
      if (refused.has(`${matches[i].article_slug}:${matches[i].topic_slug}`)) matches.splice(i, 1);
    }
  }

  // Which subjects are standing, not merely busy today.
  const byTopic = new Map<string, typeof matches>();
  for (const m of matches) {
    if (!byTopic.has(m.topic_slug)) byTopic.set(m.topic_slug, []);
    byTopic.get(m.topic_slug)!.push(m);
  }

  // The standing test has to see the whole history, not one scan window.
  //
  // This scan reads the most recent 200 articles, and on the live archive
  // roughly one article in a hundred matches any dossier subject at all -- the
  // matcher is right to be that selective, since the six near-misses it refuses
  // are Serbia's own elections, Montenegro's EU path, North Macedonia, Albania
  // and Libya. But it means a scan yields about two matches, so a bar of three
  // articles across two days could never be met from one run's matches, and the
  // subject selector returned no candidate every time.
  //
  // The mappings were being persisted the whole time. Reading them back keeps
  // the editorial bar exactly where it was and lets a subject accumulate toward
  // it over weeks instead of starting from nothing on every run.
  const topicSlugs = [...byTopic.keys()];
  const history = new Map<string, Array<{ articleSlug: string; publishedAt: string }>>();
  if (topicSlugs.length) {
    const { data: priorRows, error: priorError } = await supabase
      .from("dosje_article_topics")
      .select("article_slug, topic_slug, published_at")
      .in("topic_slug", topicSlugs);
    // A missing published_at column means the migration has not landed yet;
    // that is survivable, it just leaves the run with this scan's matches only.
    if (!priorError) {
      for (const row of (priorRows ?? []) as Array<{
        article_slug: string;
        topic_slug: string;
        published_at: string | null;
      }>) {
        if (!row.published_at) continue;
        if (!history.has(row.topic_slug)) history.set(row.topic_slug, []);
        history.get(row.topic_slug)!.push({
          articleSlug: row.article_slug,
          publishedAt: row.published_at,
        });
      }
    }
  }

  const candidates: Array<{ topic: string; title: string; articles: number; days: number }> = [];
  for (const [slug, rows] of byTopic) {
    // This run's matches plus everything already recorded for the subject, one
    // entry per article: an article re-scanned on a later run is the same
    // article, and must not be able to count twice toward the bar.
    const byArticle = new Map<string, { articleSlug: string; publishedAt: string }>();
    for (const r of history.get(slug) ?? []) byArticle.set(r.articleSlug, r);
    for (const r of rows) {
      if (r.publishedAt) byArticle.set(r.article_slug, { articleSlug: r.article_slug, publishedAt: r.publishedAt });
    }
    const all = [...byArticle.values()];
    if (!isStandingSubject(all)) continue;
    candidates.push({
      topic: slug,
      title: topics.find((t) => t.slug === slug)?.title ?? slug,
      articles: all.length,
      days: new Set(all.map((r) => String(r.publishedAt).slice(0, 10))).size,
    });
  }

  const scannedSlugs = articles.map((article) => article.slug).filter(Boolean);
  const expectedKeys = new Set(matches.map((match) => `${match.article_slug}:${match.topic_slug}`));
  let pruned = 0;
  let staleMappings: Array<{ article_slug: string; topic_slug: string }> = [];
  if (scannedSlugs.length) {
    // In batches: ~300 slugs in one `in.(...)` filter made a request URL long
    // enough that the fetch itself failed ("TypeError: fetch failed"), and
    // every daily run since 21 Oct lost its article links to that.
    const existingMappings: Array<{ article_slug: string; topic_slug: string }> = [];
    for (let i = 0; i < scannedSlugs.length; i += 50) {
      const { data, error: existingError } = await supabase
        .from("dosje_article_topics")
        .select("article_slug, topic_slug")
        .in("article_slug", scannedSlugs.slice(i, i + 50));
      if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
      existingMappings.push(...((data ?? []) as Array<{ article_slug: string; topic_slug: string }>));
    }
    staleMappings = existingMappings.filter(
      (row) => !expectedKeys.has(`${row.article_slug}:${row.topic_slug}`)
    ) as Array<{ article_slug: string; topic_slug: string }>;
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      articlesScanned: articles.length,
      matched: matches.length,
      prunable: staleMappings.length,
      candidates,
    });
  }

  for (const stale of staleMappings) {
    const { error: deleteError } = await supabase
      .from("dosje_article_topics")
      .delete()
      .eq("article_slug", stale.article_slug)
      .eq("topic_slug", stale.topic_slug);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    pruned += 1;
  }

  // Upsert so a re-run is idempotent: the same article keeps the same topic and
  // the decision is simply refreshed.
  let written = 0;
  if (matches.length) {
    // Keep the publication date. Whether a subject is standing is a fact about
    // the news, not about when this job happened to run — discarding it is what
    // made the selector count every mapping run as a single day.
    const rows = matches.map(({ publishedAt, ...row }) => ({
      ...row,
      // "" is what lib/db.ts yields for a missing date, and Postgres will not
      // take it for a timestamptz.
      published_at: publishedAt || null,
      decided_at: new Date().toISOString(),
    }));

    let { error } = await supabase
      .from("dosje_article_topics")
      .upsert(rows, { onConflict: "article_slug,topic_slug" });

    // A deploy can land before its migration is applied. When that happens the
    // mapping is still worth writing without the new column — the selector
    // falls back to decided_at — rather than failing the whole run and leaving
    // the job erroring every two hours until someone notices.
    if (error && /published_at/.test(error.message)) {
      console.warn(
        "[dosje] published_at missing; writing mappings without it. Apply migration 0056."
      );
      const legacy = rows.map(({ published_at: _drop, ...rest }) => rest);
      ({ error } = await supabase
        .from("dosje_article_topics")
        .upsert(legacy, { onConflict: "article_slug,topic_slug" }));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    written = matches.length;
  }

  return NextResponse.json({
    ok: true,
    articlesScanned: articles.length,
    matched: written,
    pruned,
    candidates,
    linkJudge,
  });
}

export async function POST(req: Request) {
  return run(req, false);
}

/** Read-only: what it would decide, writing nothing. */
export async function GET(req: Request) {
  return run(req, true);
}
