import { NextResponse } from "next/server";
import { checkProposedTopic } from "@/lib/dosje-discover.mjs";
import { admin, authorised, CAPS, clustersToday, matcherOf } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const englishPhrase = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s.length >= 4 && s.length <= 100 ? s : null;
};

/** Up to four groups of up to four short terms, or null to let the search derive its own. */
const englishGroups = (v: unknown): string[][] | null => {
  const groups = (Array.isArray(v) ? v : [])
    .map((g) => (Array.isArray(g) ? g : []).map((x) => String(x ?? "").trim().toLowerCase()).filter((x) => x.length >= 3 && x.length <= 40).slice(0, 4))
    .filter((g) => g.length)
    .slice(0, 4);
  return groups.length ? groups : null;
};

/**
 * Step two: the model has named some clusters as topics. Each proposal is
 * judged by what it would actually match (lib/dosje-discover.mjs
 * checkProposedTopic) — against its own cluster, against everything else from
 * the last three weeks, and against the topics that already exist — and saved
 * as a draft topic when it passes. A topic becomes public only when the
 * research step publishes its first verified moment.
 */
export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    proposals?: Array<Record<string, unknown>>;
    model?: string;
    backfill?: boolean;
  } | null;
  const proposals = Array.isArray(body?.proposals) ? body.proposals : [];
  const caps = body?.backfill ? CAPS.backfill : CAPS.daily;
  const model = String(body?.model ?? "unknown").slice(0, 40);

  const { articles, matchers, clusters } = await clustersToday(Boolean(body?.backfill));
  const known = [...matchers];
  const accepted: Array<Record<string, unknown>> = [];
  const rejected: Array<Record<string, unknown>> = [];

  for (const raw of proposals.slice(0, caps.topics * 2)) {
    const label = { slug: String(raw?.slug ?? ""), title: String(raw?.title ?? "") };
    if (accepted.length >= caps.topics) {
      rejected.push({ ...label, reasons: ["daily_cap_reached"] });
      continue;
    }
    const cluster = clusters.find((c) => c.id === raw?.cluster_id);
    if (!cluster) {
      rejected.push({ ...label, reasons: ["cluster_not_found"] });
      continue;
    }
    const inCluster = new Set(cluster.articles.map((a) => a.slug));
    const verdict = checkProposedTopic(raw, {
      cluster: cluster.articles,
      others: articles.filter((a) => !inCluster.has(a.slug)),
      topics: known,
    });
    if (!verdict.ok || !verdict.topic) {
      rejected.push({ ...label, reasons: verdict.reasons, ownMatches: verdict.ownMatches, falseRate: verdict.falseRate });
      continue;
    }

    const t = verdict.topic as ReturnType<typeof matcherOf> & { blurb: string };
    const { error } = await admin().from("dosje_topics").insert({
      slug: t.slug,
      title: t.title,
      blurb: t.blurb,
      status: "draft",
      anchors: t.anchors,
      signals: t.signals,
      excludes: t.excludes,
      match_groups: t.matchGroups,
      context: t.context,
      // Evidence comes from English reference lists (lib/dosje-sources.mjs),
      // so the search phrase and the relevance terms are English, not the
      // Albanian vocabulary the topic matches articles with.
      research_query: englishPhrase(raw?.researchQuery) ?? null,
      research_groups: englishGroups(raw?.researchGroups),
      created_by: `dosje-daily:${model}`,
    });
    if (error) {
      rejected.push({ ...label, reasons: [/duplicate|23505/i.test(error.message) ? "slug_taken" : "insert_failed"] });
      continue;
    }
    known.push(t);
    accepted.push({
      slug: t.slug,
      title: t.title,
      blurb: t.blurb,
      ownMatches: verdict.ownMatches,
      falseRate: Math.round(verdict.falseRate * 1000) / 1000,
      articles: cluster.articles.map((a) => ({ slug: a.slug, title: a.title })),
    });
  }

  return NextResponse.json({ ok: true, accepted, rejected });
}
