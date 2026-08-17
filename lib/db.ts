import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { MOCK_ARTICLES, type Article } from "./mock-data";
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

export async function getArticles(limit = 50, category?: string): Promise<Article[]> {
  // A section owns its retired aliases, so filtering on the label alone would
  // hide every row the pipeline filed under the old name.
  const wanted = category ? normalizeCategory(category) : undefined;
  const supabase = supabaseNewsClient();
  if (supabase) {
    try {
      let query = supabase
        .from("news_articles")
        .select("*")
        .order("featured", { ascending: false })
        .order("engagement_score", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(limit);
      if (wanted) query = query.in("category", categoryQueryValues(wanted));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (data?.length) return data.map((article) => mapAutoRow(article as Record<string, unknown>));
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
    return MOCK_ARTICLES.map(sanitizeArticle);
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
        .select("*")
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      if (data?.length) {
        return data.map((article) =>
          mapAutoRow(article as Record<string, unknown>)
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
      : MOCK_ARTICLES.map(sanitizeArticle);
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
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return mapAutoRow(data as Record<string, unknown>);
    } catch (error) {
      console.error("[news] Supabase article lookup unavailable; using committed fallback", error);
    }
  }

  const autoArticle = getAutoArticles().find((a) => a.slug === slug);
  if (autoArticle) return autoArticle;

  const db = getDb();
  if (!db) {
    const mock = MOCK_ARTICLES.find((a) => a.slug === slug);
    return mock ? sanitizeArticle(mock) : null;
  }
  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM articles WHERE slug = ? AND processed = 1`
    )
    .get(slug) as DbRow | undefined;
  db.close();
  if (row) return mapRow(row);
  const mock = MOCK_ARTICLES.find((a) => a.slug === slug);
  return mock ? sanitizeArticle(mock) : null;
}
