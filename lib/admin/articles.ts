import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryQueryValues, normalizeCategory, type NavCategory } from "@/lib/category-map";
import { orGroupFor, searchTokens } from "./search-terms";
import { adminTimestamp } from "./format";

/**
 * The admin panel's article store.
 *
 * The panel used to read `data/auto-articles/*.json` directly: all 130 files,
 * 1,228 articles, 3.75 MB with full bodies, handed to a client component as
 * props on every load. That was the lag. It was also the wrong store — those
 * batches are the outage fallback `lib/db.ts` reads only when Supabase fails,
 * and they share zero slugs with the 84 rows the site actually renders. Every
 * edit and delete made there was a no-op against production.
 *
 * This module reads and writes `news_articles`, the store the site renders,
 * and never returns a body to a list view.
 */

/** Rows per page. The list is a work queue, not an archive to scroll. */
export const PER_PAGE = 25;

/**
 * Columns the list needs. `body` is absent on purpose and `raw_article` doubly
 * so — it is a complete JSON copy of the article kept for the ingest record
 * and read by nothing, and selecting it is what exhausted the egress
 * allowance before (see the note above ARTICLE_COLUMNS in lib/db.ts).
 */
const LIST_COLUMNS =
  "id,slug,title,excerpt,source,source_flag,category,published_at,created_at,image_url,engagement_score,featured";

/** The editor additionally needs the text being edited. */
const EDIT_COLUMNS = `${LIST_COLUMNS},body,url,video_clip_url,reading_time`;

export type AdminArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  source: string;
  sourceFlag: string;
  /** As stored. May be a retired label the pipeline still writes. */
  category: string;
  /** The live section this actually appears under, after alias folding. */
  categoryLabel: string;
  publishedAt: string;
  /** Formatted on the server: a client Intl call mismatched on hydration. */
  publishedLabel: string;
  createdAt: string | null;
  imageUrl: string | null;
  score: number | null;
  featured: boolean;
};

export type AdminArticleFull = AdminArticleRow & {
  body: string;
  url: string | null;
  videoClipUrl: string | null;
  readingTime: number | null;
};

export type SortKey = "recent" | "oldest" | "score";

export type ListParams = {
  q?: string;
  category?: string;
  sort?: SortKey;
  page?: number;
};

export type ListResult = {
  rows: AdminArticleRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Non-null when the read failed, so the UI can say so instead of showing an empty list. */
  error: string | null;
};

function readClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Tokenising and escaping live in their own module because that is the subtle
// part of this file and the part worth testing on its own. See its tests.

function mapRow(r: Record<string, unknown>): AdminArticleRow {
  return {
    id: String(r.id ?? ""),
    slug: String(r.slug ?? ""),
    title: String(r.title ?? ""),
    excerpt: String(r.excerpt ?? ""),
    source: String(r.source ?? ""),
    sourceFlag: String(r.source_flag ?? ""),
    category: String(r.category ?? ""),
    categoryLabel: normalizeCategory(r.category as string | null),
    publishedAt: String(r.published_at ?? ""),
    publishedLabel: adminTimestamp(r.published_at as string | null),
    createdAt: r.created_at ? String(r.created_at) : null,
    imageUrl: r.image_url ? String(r.image_url) : null,
    score: r.engagement_score == null ? null : Number(r.engagement_score),
    featured: Boolean(r.featured),
  };
}

/**
 * One page of articles, filtered and searched in Postgres.
 *
 * Search covers the body even though the body is never returned: the operator
 * looking for the article that mentions a name should find it, and paying for
 * that scan server-side is far cheaper than shipping 1.5 MB of body text to
 * the browser so the client can filter it.
 */
export async function listArticles(params: ListParams = {}): Promise<ListResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const supabase = readClient();
  const empty: ListResult = { rows: [], total: 0, page, pageCount: 1, error: null };
  if (!supabase) return { ...empty, error: "Supabase nuk është konfiguruar." };

  let query = supabase
    .from("news_articles")
    .select(LIST_COLUMNS, { count: "exact" });

  // Each token becomes its own or() group. PostgREST ANDs separate or= groups,
  // so every token must appear somewhere in the row -- verified against the
  // live table: "kosov" 23 rows, "serbi" 6, together 2.
  for (const token of params.q ? searchTokens(params.q) : []) {
    query = query.or(orGroupFor(token));
  }

  if (params.category) {
    // A section owns its retired aliases, so filtering on the current label
    // alone would hide every row the pipeline filed under an older name.
    const wanted = normalizeCategory(params.category);
    query = query.in("category", categoryQueryValues(wanted));
  }

  if (params.sort === "score") {
    query = query.order("engagement_score", { ascending: false, nullsFirst: false });
  } else if (params.sort === "oldest") {
    query = query.order("published_at", { ascending: true });
  } else {
    query = query.order("published_at", { ascending: false });
  }

  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await query.range(from, from + PER_PAGE - 1);

  if (error) return { ...empty, error: error.message };

  const total = count ?? 0;
  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    error: null,
  };
}

/** One article with its body, for the editor. */
export async function getArticleForEdit(id: string): Promise<AdminArticleFull | null> {
  const supabase = readClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("news_articles")
    .select(EDIT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    ...mapRow(r),
    body: String(r.body ?? ""),
    url: r.url ? String(r.url) : null,
    videoClipUrl: r.video_clip_url ? String(r.video_clip_url) : null,
    readingTime: r.reading_time == null ? null : Number(r.reading_time),
  };
}

/** The distinct categories actually present, for the filter control. */
export async function articleCategoryCounts(): Promise<Array<{ category: NavCategory; count: number }>> {
  const supabase = readClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("news_articles").select("category").limit(2000);
  if (error || !data) return [];

  const tally = new Map<NavCategory, number>();
  for (const row of data as Array<{ category: string | null }>) {
    const label = normalizeCategory(row.category);
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export type WriteResult = { ok: true } | { ok: false; error: string };

/**
 * Writes need the service role: 0003 grants browser clients select and nothing
 * else, deliberately. The key is set on Vercel and absent locally, so a local
 * save fails loudly here rather than appearing to succeed.
 */
function writeClient() {
  return createAdminClient();
}

const MISSING_KEY =
  "SUPABASE_SERVICE_ROLE_KEY mungon në këtë mjedis, prandaj ndryshimi nuk u ruajt.";

export type ArticlePatch = {
  title?: string;
  excerpt?: string;
  body?: string;
  imageUrl?: string | null;
  category?: string;
  featured?: boolean;
};

export async function updateArticle(id: string, patch: ArticlePatch): Promise<WriteResult> {
  const supabase = writeClient();
  if (!supabase) return { ok: false, error: MISSING_KEY };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.excerpt !== undefined) row.excerpt = patch.excerpt;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.category !== undefined) row.category = normalizeCategory(patch.category);
  if (patch.featured !== undefined) row.featured = patch.featured;
  // Distinguish clearing the image from leaving it alone: undefined skips the
  // column, null writes SQL NULL.
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl || null;

  const { error } = await supabase.from("news_articles").update(row).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteArticle(id: string): Promise<WriteResult> {
  const supabase = writeClient();
  if (!supabase) return { ok: false, error: MISSING_KEY };
  const { error } = await supabase.from("news_articles").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
