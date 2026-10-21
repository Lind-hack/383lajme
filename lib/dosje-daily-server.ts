import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticlesBefore } from "@/lib/db";
import { discoverClusters } from "@/lib/dosje-discover.mjs";
import { matchTopic } from "@/lib/dosje-match.mjs";

/**
 * Shared ground for the daily dossier routes (app/api/automation/dosje/daily/*).
 *
 * The VPS worker (scripts/run-dosje-daily.mjs) only talks to models; every
 * fact, fetch, check and write happens here, on the site, where the validators
 * and the database already live. The worker is treated as untrusted input.
 */

/**
 * Bearer header only, compared in constant time. The older dosje routes also
 * accept ?secret= in the query string and compare with ===; a query string
 * ends up in access logs, and === leaks timing.
 */
export function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.TREGU_AUTOMATION_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type PoolArticle = {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  publishedAt?: string;
  imageUrl?: string | null;
};

/** Roughly three weeks of coverage: the newest 300, light columns. */
export async function recentArticles(): Promise<PoolArticle[]> {
  const first = await getArticlesBefore({ limit: 150 });
  const oldest = first.at(-1)?.publishedAt ?? null;
  const second = oldest ? await getArticlesBefore({ before: oldest, limit: 150 }) : [];
  const bySlug = new Map<string, PoolArticle>();
  for (const a of [...first, ...second]) bySlug.set(a.slug, a);
  return [...bySlug.values()];
}

export type TopicRow = {
  slug: string;
  title: string;
  blurb: string;
  status: string;
  anchors: string[] | null;
  signals: string[] | null;
  excludes: string[] | null;
  match_groups: string[][] | null;
  context: string[] | null;
  research_groups: string[][] | null;
  research_query: string | null;
  primer: string | null;
};

/** A topic row in the shape lib/dosje-match.mjs scores. */
export function matcherOf(row: TopicRow) {
  return {
    slug: row.slug,
    title: row.title,
    anchors: row.anchors ?? [],
    signals: row.signals ?? [],
    excludes: row.excludes ?? [],
    matchGroups: row.match_groups ?? [],
    context: row.context ?? [],
  };
}

export function admin() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase admin client not configured");
  return client;
}

/** Every live topic the daily run knows: the database only, by design (the file is being retired). */
export async function dbTopics(): Promise<TopicRow[]> {
  const { data, error } = await admin()
    .from("dosje_topics")
    .select("slug, title, blurb, status, anchors, signals, excludes, match_groups, context, research_groups, research_query, primer")
    .neq("status", "retired");
  if (error) throw new Error(error.message);
  return (data ?? []) as TopicRow[];
}

export const CAPS = {
  daily: { topics: 3, subjects: 5, clusters: 6 },
  backfill: { topics: 20, subjects: 20, clusters: 24 },
};

/** Clusters for today's discovery, with the context each proposal is judged against. */
export async function clustersToday(backfill: boolean) {
  const [articles, topics] = await Promise.all([recentArticles(), dbTopics()]);
  const matchers = topics.map(matcherOf);
  const clusters = discoverClusters(articles, matchers, {
    limit: backfill ? CAPS.backfill.clusters : CAPS.daily.clusters,
  });
  return { articles, topics, matchers, clusters };
}

/**
 * Which topics to research today: never researched first, then the longest
 * waiting, skipping any on cooldown or researched in the last week; among
 * equals, the one the news mentions most.
 */
export async function dueSubjects(limit: number, articles: PoolArticle[], topics: TopicRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: runs } = await admin()
    .from("dosje_research_runs")
    .select("subject_key, run_date, cooldown_until")
    .gte("run_date", new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10));
  const last = new Map<string, { run: string; cooldown: string | null }>();
  for (const r of (runs ?? []) as { subject_key: string; run_date: string; cooldown_until: string | null }[]) {
    const prev = last.get(r.subject_key);
    if (!prev || r.run_date > prev.run) last.set(r.subject_key, { run: r.run_date, cooldown: r.cooldown_until });
  }

  const matchers = topics.map(matcherOf);
  const mentions = new Map<string, PoolArticle[]>();
  for (const a of articles) {
    const m = matchTopic(a, matchers);
    if (!m) continue;
    const slug = (m.topic as { slug: string }).slug;
    mentions.set(slug, [...(mentions.get(slug) ?? []), a]);
  }

  return topics
    .filter((t) => {
      const l = last.get(t.slug);
      if (!l) return true;
      if (l.cooldown && l.cooldown > today) return false;
      return l.run <= weekAgo;
    })
    .map((t) => ({ topic: t, articles: mentions.get(t.slug) ?? [], lastRun: last.get(t.slug)?.run ?? null }))
    .sort((a, b) => {
      if ((a.lastRun === null) !== (b.lastRun === null)) return a.lastRun === null ? -1 : 1;
      const waited = (a.lastRun ?? "").localeCompare(b.lastRun ?? "");
      return waited || b.articles.length - a.articles.length;
    })
    .slice(0, limit);
}

/** YYYY-MM-DD or null: a malformed date must never reach a ::date cast in SQL. */
export function isoDay(value: unknown): string | null {
  const m = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? m[1] : null;
}
