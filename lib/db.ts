import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { MOCK_ARTICLES, type Article } from "./mock-data";
import { remoteImageSrc } from "./remote-image.mjs";

/**
 * Sample copy is for an empty development database, never for readers.
 *
 * MOCK_ARTICLES are ten invented stories — an IMF growth figure for Kosovo, a
 * round of Kosovo–Serbia talks in Brussels, a national-team qualification —
 * written to look exactly like real reporting, because that is what makes them
 * useful locally. As the last link in the production fallback chain they were
 * published under the 383 masthead as current news on 2026-08-22: the Supabase
 * table read back empty, and the committed batches in data/auto-articles are
 * from 13 July and so are all older than MAX_AUTO_AGE_MS.
 *
 * An empty news site is a bad day. A news site confidently publishing invented
 * politics and economics is a different kind of problem, and not one a reader
 * can detect. Outside development the archive is therefore allowed to be
 * empty, and the surfaces render their empty state.
 *
 * ALLOW_MOCK_ARTICLES=1 restores the old behaviour for a preview deployment
 * that deliberately wants sample content.
 */
const ALLOW_MOCK_ARTICLES =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_ARTICLES === "1";

function mockArticles(): Article[] {
  return ALLOW_MOCK_ARTICLES ? MOCK_ARTICLES.map(sanitizeArticle) : [];
}

function mockArticle(slug: string): Article | null {
  if (!ALLOW_MOCK_ARTICLES) return null;
  const mock = MOCK_ARTICLES.find((a) => a.slug === slug);
  return mock ? sanitizeArticle(mock) : null;
}
import { fixMojibake } from "./encoding";
import { categoryQueryValues, normalizeCategory } from "./category-map";

const DB_PATH = path.join(process.cwd(), "data", "articles.db");

/**
 * Every article, from every source — Supabase, SQLite, the committed JSON
 * batches and the mock set — is mapped through here, which makes it the one
 * place that can guarantee a reader never sees a category that is not one of
 * the six live sections. Rows written before the sections were consolidated
 * still carry "Siguri" or "Shoqëri"; they now render under the section that
 * absorbed them instead of leaking a label with no page behind it.
 */
function sanitizeArticle(a: Article): Article {
  return {
    ...a,
    title: fixMojibake(a.title),
    excerpt: fixMojibake(a.excerpt),
    body: fixMojibake(a.body),
    source: fixMojibake(a.source),
    sourceFlag: fixMojibake(a.sourceFlag),
    category: normalizeCategory(fixMojibake(a.category)),
    // Imagery is hotlinked from other outlets, which serve whatever size they
    // uploaded — one Al Jazeera hero measured 11.8 MB. Ask the hosts that
    // honour it for something the width of the article column instead.
    imageUrl: remoteImageSrc(a.imageUrl, 1200),
  };
}

const SELECT_COLUMNS = `
  id, slug, url, dispatch, title, excerpt, body, source,
  source_flag AS sourceFlag, source_bias AS sourceBias, tone,
  category, published_at AS publishedAt,
  reading_time AS readingTime, featured, processed,
  image_url AS imageUrl, engagement_score AS engagementScore
`.trim();

type DbRow = Omit<Article, "featured"> & { featured: number };

function mapRow(row: DbRow): Article {
  return sanitizeArticle({ ...row, featured: row.featured === 1 });
}

function getDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  return new Database(DB_PATH, { readonly: true });
}

const AUTO_DIR = path.join(process.cwd(), "data", "auto-articles");
const MAX_AUTO_AGE_MS = 24 * 60 * 60 * 1000;

function mapAutoRow(a: Record<string, unknown>): Article {
  return sanitizeArticle({
    id:            String(a.id ?? ""),
    slug:          String(a.slug ?? ""),
    url:           a.url ? String(a.url) : undefined,
    dispatch:      String(a.dispatch ?? "00"),
    title:         String(a.title ?? ""),
    excerpt:       String(a.excerpt ?? ""),
    body:          String(a.body ?? ""),
    source:        String(a.source ?? ""),
    sourceFlag:    String(a.source_flag ?? "🌍"),
    sourceBias:    (a.source_bias as Article["sourceBias"]) ?? "neutral",
    tone:          (a.tone as Article["tone"]) ?? "neutral",
    // Left raw on purpose: sanitizeArticle folds it onto a live section, and an
    // absent category resolves to the default there rather than to a label that
    // was never editorial in the first place.
    category:      String(a.category ?? ""),
    publishedAt:   String(a.published_at ?? ""),
    createdAt:     a.created_at ? String(a.created_at) : undefined,
    readingTime:   Number(a.reading_time ?? 3),
    featured:      Boolean(a.featured),
    imageUrl:      a.image_url ? String(a.image_url) : undefined,
    engagementScore: a.engagement_score ? Number(a.engagement_score) : undefined,
    videoClipUrl:  a.video_clip_url ? String(a.video_clip_url) : undefined,
  });
}

function getAutoArticles(): Article[] {
  if (!fs.existsSync(AUTO_DIR)) return [];
  const cutoff = new Date(Date.now() - MAX_AUTO_AGE_MS);
  const articles: Article[] = [];
  for (const file of fs.readdirSync(AUTO_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(AUTO_DIR, file), "utf-8")
      ) as Array<Record<string, unknown>>;
      for (const a of raw) {
        const ts = String(a.created_at ?? a.published_at ?? "");
        if (ts && new Date(ts) < cutoff) continue;
        articles.push(mapAutoRow(a));
      }
    } catch {
      // skip malformed files
    }
  }
  return articles;
}

// 0.05 pts/hour → a 9.5 article at 20h = 8.5 effective (tied with a fresh 8.5)
const DECAY_RATE = 0.05;

function effectiveScore(article: Article): number {
  const base = article.engagementScore ?? 0;
  const anchor = article.createdAt ?? article.publishedAt;
  const ageHours = (Date.now() - new Date(anchor).getTime()) / 3_600_000;
  return Math.max(0, base - ageHours * DECAY_RATE);
}

function supabaseNewsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * The columns the site actually renders.
 *
 * Every read here used to be `select("*")`, which drags back `raw_article` —
 * a complete JSON copy of the article kept for the ingest record and read by
 * nothing on the site — along with score_breakdown, the scoring prose and the
 * social metadata. On a call like getArticles(500) that is a few kilobytes of
 * dead weight per row, several megabytes per request, on pages that revalidate
 * every fifteen minutes. It is the reason the egress allowance kept running
 * out, and none of it ever reached a reader.
 *
 * mapAutoRow below is the authority on what is needed: if a field is added
 * there, add it here too, or it will silently arrive undefined.
 */
const ARTICLE_COLUMNS = [
  "id", "slug", "url", "dispatch", "title", "excerpt", "body",
  "source", "source_flag", "source_bias", "tone", "category",
  "published_at", "created_at", "reading_time", "featured",
  "image_url", "engagement_score", "video_clip_url",
].join(",");

/**
 * The same list without the article body, for callers that only render
 * headlines and cards. body is the largest remaining column and no list view
 * touches it.
 */
const ARTICLE_COLUMNS_LIGHT = ARTICLE_COLUMNS.replace(",body", "");

export async function getArticles(
  limit = 50,
  category?: string,
  opts: { withBody?: boolean } = {}
): Promise<Article[]> {
  // A section owns its retired aliases, so filtering on the label alone would
  // hide every row the pipeline filed under the old name.
  const wanted = category ? normalizeCategory(category) : undefined;
  const supabase = supabaseNewsClient();
  if (supabase) {
    try {
      let query = supabase
        .from("news_articles")
        // Body is opt-in: the handful of callers that render or summarise an
        // article ask for it, and the many that show a card do not pay for it.
        .select(opts.withBody === false ? ARTICLE_COLUMNS_LIGHT : ARTICLE_COLUMNS)
        .order("featured", { ascending: false })
        .order("engagement_score", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(limit);
      if (wanted) query = query.in("category", categoryQueryValues(wanted));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (data?.length) return data.map((article) => mapAutoRow(article as unknown as Record<string, unknown>));
    } catch (error) {
      // News batches are committed to data/auto-articles specifically so a
      // temporary Supabase/Cloudflare outage cannot block a production build.
      console.error("[news] Supabase article list unavailable; using committed fallback", error);
    }
  }

  const autoArticles = getAutoArticles();
  const db = getDb();

  let sqliteArticles: Article[] = [];
  if (db) {
    const rows = db
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM articles WHERE processed = 1 ORDER BY featured DESC, engagement_score DESC, published_at DESC LIMIT ?`
      )
      .all(limit) as DbRow[];
    db.close();
    sqliteArticles = rows.map(mapRow);
  }

  if (sqliteArticles.length === 0 && autoArticles.length === 0) {
    return mockArticles();
  }

  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const a of [...autoArticles, ...sqliteArticles]) {
    const key = a.url ?? a.slug;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(a);
    }
  }

  const sorted = merged.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return effectiveScore(b) - effectiveScore(a);
  });

  // Already normalized by sanitizeArticle, so a plain comparison is enough here.
  const filtered = wanted ? sorted.filter((a) => a.category === wanted) : sorted;
  return filtered.slice(0, limit);
}

/**
 * One article by id.
 *
 * There was no such function, so callers that had an id and not a slug fetched
 * five hundred rows and searched them in JavaScript. That is several megabytes
 * off the wire to find a single row the database could have returned by key.
 */
export async function getArticleById(id: string): Promise<Article | null> {
  if (!id) return null;
  const supabase = supabaseNewsClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select(ARTICLE_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return mapAutoRow(data as unknown as Record<string, unknown>);
    } catch (error) {
      console.error("[news] Supabase article-by-id unavailable; using fallback", error);
    }
  }
  // The fallback path is small and local, so scanning it is cheap.
  return (await getArticles(500)).find((a) => a.id === id) ?? null;
}

/**
 * A named set of articles, fetched as a set.
 *
 * Same reason as getArticleById: asking for the newest five hundred and
 * filtering in memory is the expensive way to answer a question Postgres
 * answers with an index.
 */
export async function getArticlesBySlugs(slugs: string[]): Promise<Article[]> {
  const wanted = [...new Set((slugs ?? []).filter(Boolean))];
  if (!wanted.length) return [];
  const supabase = supabaseNewsClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select(ARTICLE_COLUMNS)
        .in("slug", wanted);
      if (error) throw new Error(error.message);
      if (data) return data.map((a) => mapAutoRow(a as unknown as Record<string, unknown>));
    } catch (error) {
      console.error("[news] Supabase articles-by-slug unavailable; using fallback", error);
    }
  }
  const all = await getArticles(500);
  return all.filter((a) => wanted.includes(a.slug));
}

/**
 * Chronological feed for time-sensitive surfaces such as the homepage news
 * strip. This intentionally ignores featured and engagement ranking so a new
 * pipeline article can never be hidden behind older, higher-scored stories.
 */
export async function getLatestArticles(limit = 10): Promise<Article[]> {
  const supabase = supabaseNewsClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select(ARTICLE_COLUMNS)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      if (data?.length) {
        return data.map((article) =>
          mapAutoRow(article as unknown as Record<string, unknown>)
        );
      }
    } catch (error) {
      console.error(
        "[news] Supabase latest-article feed unavailable; using committed fallback",
        error
      );
    }
  }

  const autoArticles = getAutoArticles();
  const db = getDb();
  let sqliteArticles: Article[] = [];

  if (db) {
    const rows = db
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM articles WHERE processed = 1 ORDER BY published_at DESC LIMIT ?`
      )
      .all(limit) as DbRow[];
    db.close();
    sqliteArticles = rows.map(mapRow);
  }

  const candidates =
    autoArticles.length || sqliteArticles.length
      ? [...autoArticles, ...sqliteArticles]
      : mockArticles();
  const seen = new Set<string>();

  return candidates
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .filter((article) => {
      const key = article.url ?? article.slug;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = supabaseNewsClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select(ARTICLE_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return mapAutoRow(data as unknown as Record<string, unknown>);
    } catch (error) {
      console.error("[news] Supabase article lookup unavailable; using committed fallback", error);
    }
  }

  const autoArticle = getAutoArticles().find((a) => a.slug === slug);
  if (autoArticle) return autoArticle;

  const db = getDb();
  if (!db) return mockArticle(slug);
  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM articles WHERE slug = ? AND processed = 1`
    )
    .get(slug) as DbRow | undefined;
  db.close();
  if (row) return mapRow(row);
  return mockArticle(slug);
}
