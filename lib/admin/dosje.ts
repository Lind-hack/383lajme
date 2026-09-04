import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminTimestamp } from "./format";
import { decodeEntities } from "./text";

/**
 * Dossier review and cleanup.
 *
 * Two things the panel could not do. It could not say why a dossier was going
 * nowhere -- a topic with no anchors can never match an article at all (0051:
 * "An anchor is required for the topic to match"), and one with no approved
 * milestone renders nothing -- so unpublishable topics simply accumulated. And
 * it could not show a milestone's evidence together with the images and videos
 * attached to it, which is what an approver actually has to look at.
 *
 * Reads prefer the service role so drafts are visible. RLS hides them from the
 * anon key, and a 0 there means "hidden", not "empty" -- the trap that made
 * dosje_milestones look empty during the 2026-09-04 audit. When no service key
 * is present the caller is told, rather than being shown a confident zero.
 */

export type DosjeClientMode = "service" | "anon" | "none";

function dosjeClient(): {
  client: ReturnType<typeof createSupabaseClient> | null;
  mode: DosjeClientMode;
} {
  const admin = createAdminClient();
  if (admin) return { client: admin as ReturnType<typeof createSupabaseClient>, mode: "service" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { client: null, mode: "none" };
  return {
    client: createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    mode: "anon",
  };
}

/** Why a dossier cannot reach the public site. Ordered most fatal first. */
export type Blocker =
  | "no_anchors"
  | "no_articles"
  | "no_milestones"
  | "no_approved_milestones"
  | "not_approved";

export const BLOCKER_LABELS: Record<Blocker, string> = {
  no_anchors: "Pa fjalë-çelës",
  no_articles: "Asnjë artikull i lidhur",
  no_milestones: "Asnjë moment",
  no_approved_milestones: "Asnjë moment i miratuar",
  not_approved: "Dosja në draft",
};

export const BLOCKER_DETAIL: Record<Blocker, string> = {
  no_anchors:
    "Pa asnjë fjalë-çelës kryesore kjo dosje nuk mund të përputhet me asnjë artikull, sot ose kurrë.",
  no_articles: "Asnjë artikull i 383-shit nuk është klasifikuar ndonjëherë në këtë dosje.",
  no_milestones: "Asnjë moment nuk është hartuar për këtë dosje.",
  no_approved_milestones:
    "Ka momente, por asnjë i miratuar — dosja del bosh edhe nëse publikohet.",
  not_approved: "Statusi është draft, prandaj nuk shfaqet publikisht.",
};

export type DosjeTopicRow = {
  slug: string;
  title: string;
  blurb: string;
  status: string;
  anchors: string[];
  signals: string[];
  excludes: string[];
  articleCount: number;
  milestoneCount: number;
  approvedMilestoneCount: number;
  mediaCount: number;
  blockers: Blocker[];
  /** Nothing here will ever reach a reader without a change of substance. */
  isDeadWeight: boolean;
  updatedAtLabel: string;
};

export type TopicsResult = {
  topics: DosjeTopicRow[];
  mode: DosjeClientMode;
  error: string | null;
};

/** PostgREST answers at most 1,000 rows however large a `limit` asks for. */
const PAGE = 1000;

/**
 * Every row of a table, fetched a page at a time.
 *
 * These counts decide which dossiers are offered for deletion, so a short read
 * is not a cosmetic problem: a topic whose link rows fall outside a truncated
 * window counts zero articles, is marked dead weight, and is then selected by
 * "Zgjidh të bllokuarat" and cascade-deleted along with its milestones,
 * citations and media. A single `.limit(5000)` silently returned 1,000.
 *
 * The explicit order matters as much as the paging: without it PostgREST gives
 * no stable row order across requests, so pages could overlap or skip, and the
 * same dossier could look blocked on one load and healthy on the next.
 */
async function fetchAllRows<T>(
  client: NonNullable<ReturnType<typeof dosjeClient>["client"]>,
  table: string,
  columns: string,
  orderBy: string,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, error: null };
    // A pathological table must not spin forever.
    if (from > 200_000) return { rows, error: null };
  }
}

export async function dosjeTopics(): Promise<TopicsResult> {
  const { client, mode } = dosjeClient();
  if (!client) return { topics: [], mode, error: "Supabase nuk është konfiguruar." };

  const [topicsRes, milestonesAll, articleTopicsAll, mediaAll] = await Promise.all([
    client.from("dosje_topics").select("*").order("title"),
    fetchAllRows<{ topic_slug: string; status: string; id: string }>(
      client,
      "dosje_milestones",
      "id,topic_slug,status",
      "id",
    ),
    fetchAllRows<{ topic_slug: string }>(
      client,
      "dosje_article_topics",
      "topic_slug,article_slug",
      "article_slug",
    ),
    fetchAllRows<{ topic_slug: string | null; milestone_id: string | null }>(
      client,
      "dosje_media",
      "id,topic_slug,milestone_id",
      "id",
    ),
  ]);

  if (topicsRes.error) return { topics: [], mode, error: topicsRes.error.message };

  // A failed count read must never be presented as a zero: zero is what marks a
  // dossier deletable. Surface the error and let the screen refuse to act.
  const countError = milestonesAll.error ?? articleTopicsAll.error ?? mediaAll.error;
  if (countError) return { topics: [], mode, error: countError };

  const milestones = milestonesAll.rows;
  const articleTopics = articleTopicsAll.rows;
  const media = mediaAll.rows;

  // Media attaches to either a milestone or a topic (0051 allows one of the two
  // to be null, not both), so a dossier whose pictures hang off milestones --
  // which is how the media job files images -- counted zero.
  const topicOfMilestone = new Map(milestones.map((m) => [m.id, m.topic_slug]));

  const count = <T,>(rows: T[], key: (r: T) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const articleCounts = count(articleTopics, (r) => r.topic_slug);
  const milestoneCounts = count(milestones, (r) => r.topic_slug);
  const approvedCounts = count(
    milestones.filter((m) => m.status === "approved"),
    (r) => r.topic_slug,
  );
  // Resolve each media row to its dossier through the milestone when it has no
  // topic_slug of its own: app/api/automation/dosje/media inserts images
  // against milestone_id alone and only videos carry topic_slug, so counting
  // topic_slug showed "Media 0" for a dossier full of approved photographs --
  // on the row the operator is deciding whether to delete.
  const mediaCounts = count(media, (r) =>
    r.topic_slug ?? (r.milestone_id ? topicOfMilestone.get(r.milestone_id) : null),
  );

  const topics = ((topicsRes.data ?? []) as Array<Record<string, unknown>>).map((t) => {
    const slug = String(t.slug ?? "");
    const anchors = Array.isArray(t.anchors) ? (t.anchors as string[]) : [];
    const articleCount = articleCounts.get(slug) ?? 0;
    const milestoneCount = milestoneCounts.get(slug) ?? 0;
    const approvedMilestoneCount = approvedCounts.get(slug) ?? 0;
    const status = String(t.status ?? "draft");

    const blockers: Blocker[] = [];
    if (anchors.length === 0) blockers.push("no_anchors");
    if (articleCount === 0) blockers.push("no_articles");
    if (milestoneCount === 0) blockers.push("no_milestones");
    else if (approvedMilestoneCount === 0) blockers.push("no_approved_milestones");
    if (status !== "approved") blockers.push("not_approved");

    return {
      slug,
      title: String(t.title ?? ""),
      blurb: String(t.blurb ?? ""),
      status,
      anchors,
      signals: Array.isArray(t.signals) ? (t.signals as string[]) : [],
      excludes: Array.isArray(t.excludes) ? (t.excludes as string[]) : [],
      articleCount,
      milestoneCount,
      approvedMilestoneCount,
      mediaCount: mediaCounts.get(slug) ?? 0,
      blockers,
      // Deliberately strict. A retired topic is a decision already taken; a
      // draft that simply has not been reviewed yet is not dead weight. What
      // is dead weight is a topic that cannot match an article or has nothing
      // approved to show even if it did.
      isDeadWeight:
        status !== "approved" &&
        (anchors.length === 0 || articleCount === 0 || approvedMilestoneCount === 0),
      updatedAtLabel: adminTimestamp(
        (t.updated_at as string | null) ?? (t.created_at as string | null),
      ),
    } satisfies DosjeTopicRow;
  });

  return { topics, mode, error: null };
}

// ── One dossier's timeline ──────────────────────────────────────────────────

export type Citation = {
  id: string;
  url: string;
  archiveUrl: string | null;
  publisher: string;
  sourceTitle: string | null;
  quote: string | null;
  supports: string | null;
  httpStatus: number | null;
  failCount: number;
  fetchedAtLabel: string | null;
  /** Live by 0057's rule, which is what the approval trigger actually counts. */
  verified: boolean;
};

export type MediaItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  credit: string | null;
  sourceUrl: string | null;
  relation: string | null;
  approved: boolean;
  checkStatus: number | null;
  checkedAtLabel: string | null;
};

export type LinkedArticle = {
  slug: string;
  title: string;
  source: string | null;
  category: string | null;
  publishedLabel: string;
  score: number | null;
  method: string;
};

export type Milestone = {
  id: string;
  eventDate: string;
  displayDate: string;
  title: string;
  summary: string;
  why: string | null;
  tag: string | null;
  status: string;
  citations: Citation[];
  media: MediaItem[];
  /** Distinct publishers among verified citations: two is the publish bar. */
  verifiedPublishers: string[];
  meetsSourceBar: boolean;
};

export type TimelineResult = {
  topic: DosjeTopicRow | null;
  milestones: Milestone[];
  articles: LinkedArticle[];
  topicMedia: MediaItem[];
  mode: DosjeClientMode;
  error: string | null;
};

function toMedia(r: Record<string, unknown>): MediaItem {
  return {
    id: String(r.id ?? ""),
    kind: r.kind === "video" ? "video" : "image",
    url: String(r.url ?? ""),
    credit: r.credit ? decodeEntities(String(r.credit)) : null,
    sourceUrl: r.source_url ? String(r.source_url) : null,
    relation: r.relation ? String(r.relation) : null,
    approved: Boolean(r.approved),
    checkStatus: r.check_status == null ? null : Number(r.check_status),
    checkedAtLabel: r.checked_at ? adminTimestamp(String(r.checked_at)) : null,
  };
}

export async function dosjeTimeline(slug: string): Promise<TimelineResult> {
  const { client, mode } = dosjeClient();
  const empty: TimelineResult = {
    topic: null,
    milestones: [],
    articles: [],
    topicMedia: [],
    mode,
    error: null,
  };
  if (!client) return { ...empty, error: "Supabase nuk është konfiguruar." };

  const [{ topics }, milestonesRes, mediaRes, linkRes] = await Promise.all([
    dosjeTopics(),
    client
      .from("dosje_milestones")
      .select("*, dosje_citations(*)")
      .eq("topic_slug", slug)
      .order("event_date", { ascending: true }),
    client.from("dosje_media").select("*").eq("topic_slug", slug),
    client
      .from("dosje_article_topics")
      .select("article_slug,score,method,decided_at")
      .eq("topic_slug", slug)
      .order("decided_at", { ascending: false })
      .limit(200),
  ]);

  const topic = topics.find((t) => t.slug === slug) ?? null;
  // Every read is checked, not just the milestones. An unreported failure on
  // the article-links read renders as "no article was ever classified into this
  // dossier" -- which is the evidence the operator purges on. Zero here has to
  // mean zero.
  const readError = milestonesRes.error ?? mediaRes.error ?? linkRes.error;
  if (readError) return { ...empty, topic, error: readError.message };

  const milestoneRows = (milestonesRes.data ?? []) as Array<Record<string, unknown>>;
  const milestoneIds = milestoneRows.map((m) => String(m.id));

  // Media attaches to either a milestone or the topic, so both are fetched and
  // then split; the schema allows one of the two to be null but not both.
  const milestoneMediaRes = milestoneIds.length
    ? await client.from("dosje_media").select("*").in("milestone_id", milestoneIds)
    : { data: [], error: null };
  if (milestoneMediaRes.error) {
    return { ...empty, topic, error: milestoneMediaRes.error.message };
  }

  const mediaByMilestone = new Map<string, MediaItem[]>();
  for (const row of (milestoneMediaRes.data ?? []) as Array<Record<string, unknown>>) {
    const key = String(row.milestone_id ?? "");
    if (!key) continue;
    const list = mediaByMilestone.get(key) ?? [];
    list.push(toMedia(row));
    mediaByMilestone.set(key, list);
  }

  const milestones: Milestone[] = milestoneRows.map((m) => {
    const rawCites = Array.isArray(m.dosje_citations)
      ? (m.dosje_citations as Array<Record<string, unknown>>)
      : [];
    const citations: Citation[] = rawCites.map((c) => ({
      id: String(c.id ?? ""),
      url: String(c.url ?? ""),
      // 0063 added the Wayback snapshot beside the canonical url rather than
      // replacing it, so publisher and tier logic still read the original.
      archiveUrl: c.archive_url ? String(c.archive_url) : null,
      publisher: String(c.publisher ?? ""),
      // Scraped straight from the source page, entities intact.
      sourceTitle: c.source_title ? decodeEntities(String(c.source_title)) : null,
      quote: c.quote ? decodeEntities(String(c.quote)) : null,
      supports: c.supports ? String(c.supports) : null,
      httpStatus: c.http_status == null ? null : Number(c.http_status),
      failCount: c.fail_count == null ? 0 : Number(c.fail_count),
      fetchedAtLabel: c.fetched_at ? adminTimestamp(String(c.fetched_at)) : null,
      // 0057 exists to end exactly this disagreement -- its header lists "the
      // admin queue -- http_status === 200" as one of four rules that had
      // drifted apart. dosje_citation_is_live is `http_status = 200 and
      // coalesce(fail_count, 0) < 3`, and that is what the approval trigger
      // counts, so a citation that has rotted must not show as verified here.
      verified: Number(c.http_status) === 200 && (c.fail_count == null ? 0 : Number(c.fail_count)) < 3,
    }));

    // Folded the way dosje_require_sources folds it -- distinct lower(btrim(
    // publisher)) -- so "Koha" and "koha " cannot read as two publishers here
    // and then be refused as one by the trigger.
    const verifiedPublishers = [
      ...new Map(
        citations
          .filter((c) => c.verified && c.publisher.trim())
          .map((c) => [c.publisher.trim().toLowerCase(), c.publisher.trim()]),
      ).values(),
    ];

    return {
      id: String(m.id ?? ""),
      eventDate: String(m.event_date ?? ""),
      displayDate: String(m.display_date ?? ""),
      title: String(m.title ?? ""),
      summary: String(m.summary ?? ""),
      why: m.why ? String(m.why) : null,
      tag: m.tag ? String(m.tag) : null,
      status: String(m.status ?? "draft"),
      citations,
      media: mediaByMilestone.get(String(m.id)) ?? [],
      verifiedPublishers,
      // The rule 0051 enforces with a trigger: two verified citations from
      // distinct publishers, or the milestone cannot be approved.
      meetsSourceBar: verifiedPublishers.length >= 2,
    };
  });

  // Which 383 articles put this dossier on the site, resolved to real titles.
  const slugs = ((linkRes.data ?? []) as Array<{ article_slug: string }>).map((r) => r.article_slug);
  let articles: LinkedArticle[] = [];
  if (slugs.length) {
    const { data: articleRows } = await client
      .from("news_articles")
      .select("slug,title,source,category,published_at")
      .in("slug", slugs.slice(0, 200));

    const byslug = new Map(
      ((articleRows ?? []) as Array<Record<string, unknown>>).map((a) => [String(a.slug), a]),
    );
    articles = ((linkRes.data ?? []) as Array<Record<string, unknown>>).map((link) => {
      const s = String(link.article_slug ?? "");
      const a = byslug.get(s);
      return {
        slug: s,
        // A link can outlive its article: the row is kept so the match history
        // survives, and the operator is told rather than shown a blank.
        title: a ? decodeEntities(String(a.title ?? "")) : "(artikulli nuk gjendet më)",
        source: a?.source ? String(a.source) : null,
        category: a?.category ? String(a.category) : null,
        publishedLabel: a?.published_at ? adminTimestamp(String(a.published_at)) : "—",
        score: link.score == null ? null : Number(link.score),
        method: String(link.method ?? "rule"),
      };
    });
  }

  return {
    topic,
    milestones,
    articles,
    topicMedia: ((mediaRes.data ?? []) as Array<Record<string, unknown>>).map(toMedia),
    mode,
    error: null,
  };
}

// ── Deletion ────────────────────────────────────────────────────────────────

export type DeleteResult = { ok: true; deleted: string[] } | { ok: false; error: string };

const NEED_SERVICE =
  "SUPABASE_SERVICE_ROLE_KEY mungon në këtë mjedis, prandaj fshirja nuk u krye.";

/**
 * Delete dossiers by slug.
 *
 * dosje_topics cascades to milestones, citations, media and article links
 * (0051 declares `on delete cascade` on each), so one delete per topic is the
 * whole removal and there is no orphan to sweep up afterwards.
 */
export async function deleteDosjeTopics(slugs: string[]): Promise<DeleteResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: NEED_SERVICE };

  const wanted = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
  if (wanted.length === 0) return { ok: false, error: "Asnjë dosje e zgjedhur." };

  const { error } = await admin.from("dosje_topics").delete().in("slug", wanted);
  if (error) return { ok: false, error: error.message };
  return { ok: true, deleted: wanted };
}

/** Remove a single milestone, leaving the dossier in place. */
export async function deleteMilestone(id: string): Promise<DeleteResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: NEED_SERVICE };
  const { error } = await admin.from("dosje_milestones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, deleted: [id] };
}
