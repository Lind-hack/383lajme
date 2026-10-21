import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { fetchSource, isFetchableCitationUrl, publisherOf, timestampForQuery } from "@/lib/dosje-sources.mjs";
import { validateMilestoneDraft } from "@/lib/dosje-draft.mjs";
import { checkVideo, admissible } from "@/lib/dosje-video.mjs";
import { matchTopic } from "@/lib/dosje-match.mjs";
import { admin, authorised, dbTopics, isoDay, matcherOf, recentArticles } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Step four, per subject: verify and publish.
 *
 * The worker sends drafts that cite sources by index into a list of urls. None
 * of it is trusted. Every url is fetched again here; the publisher is derived
 * from the url (lib/dosje-sources.mjs publisherOf), never taken from the
 * worker, so two pages on one site can never count as two publishers; the
 * text the validator checks quotes and figures against is the text fetched
 * here. A source read only through the Wayback Machine is recorded without a
 * live 200, which the approval trigger does not count.
 *
 * Accepted moments go to dosje_publish_bundle (0115), which approves each one
 * only after its citations exist, so the database trigger judges the complete
 * row. The receipt reports what the database actually did — the daily email is
 * built from it, never from what the worker hoped.
 */

type Claim = { sentence?: string; source_indexes?: number[]; quote?: string };
type Draft = {
  title?: string;
  summary?: string;
  why?: string;
  tag?: string;
  event_date?: string;
  date_precision?: string;
  display_date?: string;
  claims?: Claim[];
};

const MAX_SOURCES = 10;
const MAX_MOMENTS = 8;

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    topic_slug?: string;
    run_id?: number;
    model?: string;
    sources?: string[];
    milestones?: Draft[];
    primer?: { text?: string; claims?: Claim[] } | null;
    videos?: Array<{ id?: string }>;
  } | null;

  const topic = (await dbTopics()).find((t) => t.slug === body?.topic_slug);
  if (!topic) return NextResponse.json({ ok: false, reason: "unknown_topic" }, { status: 404 });
  const model = String(body?.model ?? "unknown").slice(0, 40);
  const db = admin();

  // ── re-fetch every cited source ──────────────────────────────────────────
  const urls = (Array.isArray(body?.sources) ? body.sources : []).slice(0, MAX_SOURCES).map((u) => String(u ?? ""));
  const timestamp = timestampForQuery(topic.research_query ?? topic.title);
  const sources = await Promise.all(
    urls.map(async (url) => {
      if (!/^https:\/\//.test(url) || !isFetchableCitationUrl(url)) {
        return { url, publisher: publisherOf(url), title: null, text: "", published_date: null, archive_url: null, live: false };
      }
      const s = await fetchSource(url, { timestamp });
      const live = s.http_status === 200 && !s.via_archive && Boolean(s.text);
      return {
        url,
        publisher: publisherOf(url),
        title: s.title,
        text: s.text ?? "",
        published_date: s.published_date,
        archive_url: s.archive_url,
        live,
        fetched_at: s.fetched_at,
        http_status: live ? 200 : s.http_status,
      };
    })
  );

  // ── validate each moment against what was fetched here ───────────────────
  const drafts = (Array.isArray(body?.milestones) ? body.milestones : []).slice(0, MAX_MOMENTS);
  const rejected: Array<{ title: string; reasons: string[] }> = [];
  const bundle: Array<Record<string, unknown>> = [];
  for (const raw of drafts) {
    const verdict = validateMilestoneDraft(raw, { sources });
    if (!verdict.ok || !verdict.milestone) {
      rejected.push({ title: String(raw?.title ?? "(pa titull)"), reasons: (verdict.reasons ?? []) as string[] });
      continue;
    }
    const eventDate = isoDay(verdict.milestone.event_date);
    if (!eventDate) {
      rejected.push({ title: String(raw?.title ?? ""), reasons: ["event_date_invalid"] });
      continue;
    }
    const citations = (verdict.citations ?? [])
      .filter((c) => /^https:\/\//.test(String(c.url)))
      .map((c) => {
        const src = sources.find((s) => s.url === c.url);
        return {
          url: c.url,
          publisher: publisherOf(c.url),
          source_title: c.source_title,
          source_date: isoDay(c.source_date),
          quote: c.quote,
          archive_url: c.archive_url,
          fetched_at: src?.fetched_at ?? new Date().toISOString(),
          http_status: src?.http_status ?? null,
        };
      });
    bundle.push({ ...verdict.milestone, event_date: eventDate, model, drafted_by: "dosje-daily", citations });
  }

  // ── the primer is held to the same rule as a moment ──────────────────────
  let primer: string | null = null;
  let primerReasons: string[] = [];
  const primerText = String(body?.primer?.text ?? "").trim();
  if (primerText) {
    const anchorDate = (bundle.map((m) => String(m.event_date)).sort()[0]) ?? isoDay(new Date(Date.now() - 86_400_000).toISOString());
    const verdict = validateMilestoneDraft(
      { title: topic.title, summary: primerText, claims: body?.primer?.claims ?? [], event_date: anchorDate },
      { sources }
    );
    if (verdict.ok) primer = primerText;
    else primerReasons = (verdict.reasons ?? []) as string[];
  }

  // ── publish ──────────────────────────────────────────────────────────────
  let receipt: { topic_status?: string; topic_was?: string; approved?: number; results?: Array<Record<string, unknown>> } = {};
  if (bundle.length || primer) {
    const { data, error } = await db.rpc("dosje_publish_bundle", {
      p: {
        topic: {
          slug: topic.slug,
          title: topic.title,
          blurb: topic.blurb,
          primer,
          anchors: topic.anchors ?? [],
          signals: topic.signals ?? [],
          excludes: topic.excludes ?? [],
          match_groups: topic.match_groups ?? [],
          context: topic.context ?? [],
          research_groups: topic.research_groups,
        },
        milestones: bundle,
      },
    });
    if (error) {
      await finishRun(body?.run_id, "verify_failed", { error: error.message, rejected });
      return NextResponse.json({ ok: false, reason: "publish_failed", detail: error.message }, { status: 500 });
    }
    receipt = data as typeof receipt;
  }
  const topicLive = receipt.topic_status === "approved" || topic.status === "approved";

  // ── explainer videos: real, alive, from a vetted newsroom ────────────────
  const videos: Array<Record<string, unknown>> = [];
  const ids = [...new Set((body?.videos ?? []).map((v) => String(v?.id ?? "").trim()).filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)))].slice(0, 3);
  for (const id of ids) {
    const check = await checkVideo(id);
    const gate = admissible(check);
    if (!gate.ok || !topicLive) {
      videos.push({ id, status: "refused", reason: gate.ok ? "dossier_not_live" : gate.reason, channel: check?.author ?? null, title: check?.title ?? null });
      continue;
    }
    const url = `https://www.youtube.com/watch?v=${id}`;
    const { data: had } = await db.from("dosje_media").select("id").eq("topic_slug", topic.slug).eq("url", url).maybeSingle();
    if (!had) {
      await db.from("dosje_media").insert({
        topic_slug: topic.slug,
        kind: "video",
        url,
        credit: check?.author ?? null,
        source_url: url,
        relation: "explainer",
        checked_at: new Date().toISOString(),
        check_status: check?.http_status ?? 200,
        approved: true,
        approved_by: "dosje-daily",
      });
    }
    videos.push({ id, status: had ? "already_present" : "added", channel: check?.author ?? null, title: check?.title ?? null });
  }

  // ── where it now shows, and make that true ───────────────────────────────
  const approvedKeys = new Set(
    (receipt.results ?? []).filter((r) => r.outcome === "approved").map((r) => String(r.dedupe_key))
  );
  const published = bundle.filter((m) => approvedKeys.has(String(m.dedupe_key)));
  const refusedByDb = (receipt.results ?? []).filter((r) => r.outcome !== "approved");
  let showingOn: Array<{ slug: string; title: string }> = [];
  if (topicLive && (published.length || primer || videos.some((v) => v.status === "added"))) {
    const all = (await dbTopics()).filter((t) => t.status === "approved").map(matcherOf);
    showingOn = (await recentArticles())
      .filter((a) => (matchTopic(a, all)?.topic as { slug?: string } | undefined)?.slug === topic.slug)
      .slice(0, 40)
      .map((a) => ({ slug: a.slug, title: a.title }));
    revalidatePath(`/dosje/${topic.slug}`);
    revalidatePath("/dosje");
    for (const a of showingOn) revalidatePath(`/article/${a.slug}`);
  }

  await finishRun(
    body?.run_id,
    published.length ? "published" : "verify_failed",
    { model, published: published.length, rejected, refusedByDb, primerReasons },
    published.length ? 0 : 7
  );

  return NextResponse.json({
    ok: true,
    topic: { slug: topic.slug, title: topic.title, was: receipt.topic_was ?? topic.status, now: receipt.topic_status ?? topic.status },
    model,
    published: published.map((m) => ({
      title: m.title,
      display_date: m.display_date,
      event_date: m.event_date,
      summary: m.summary,
      why: m.why,
      citations: (m.citations as Array<{ url: string; publisher: string | null; http_status: number | null }>).map((c) => ({
        url: c.url,
        publisher: c.publisher,
        live: c.http_status === 200,
      })),
    })),
    refused: [...rejected, ...refusedByDb.map((r) => ({ title: String(r.title ?? ""), reasons: [String(r.reason ?? r.outcome)] }))],
    primer: primer ? { text: primer } : primerText ? { refused: primerReasons } : null,
    videos,
    photos: [],
    showingOn,
  });
}

async function finishRun(runId: unknown, outcome: string, detail: Record<string, unknown>, cooldownDays = 0) {
  const id = Number(runId);
  if (!Number.isFinite(id)) return;
  await admin()
    .from("dosje_research_runs")
    .update({
      outcome,
      detail,
      cooldown_until: cooldownDays ? new Date(Date.now() + cooldownDays * 86_400_000).toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
}
