import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { MOCK_ARTICLES, type Article } from "./mock-data";

const DB_PATH = path.join(process.cwd(), "data", "articles.db");

const SELECT_COLUMNS = `
  id, slug, url, dispatch, title, excerpt, body, source,
  source_flag AS sourceFlag, source_bias AS sourceBias, tone,
  category, published_at AS publishedAt,
  reading_time AS readingTime, featured, processed,
  image_url AS imageUrl, engagement_score AS engagementScore
`.trim();

type DbRow = Omit<Article, "featured"> & { featured: number };

function mapRow(row: DbRow): Article {
  return { ...row, featured: row.featured === 1 };
}

function getDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  return new Database(DB_PATH, { readonly: true });
}

const AUTO_DIR = path.join(process.cwd(), "data", "auto-articles");
const MAX_AUTO_AGE_MS = 48 * 60 * 60 * 1000;

function mapAutoRow(a: Record<string, unknown>): Article {
  return {
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
    category:      String(a.category ?? "Shoqëri"),
    publishedAt:   String(a.published_at ?? ""),
    readingTime:   Number(a.reading_time ?? 3),
    featured:      Boolean(a.featured),
    imageUrl:      a.image_url ? String(a.image_url) : undefined,
    engagementScore: a.engagement_score ? Number(a.engagement_score) : undefined,
  };
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
        const pub = String(a.published_at ?? "");
        if (pub && new Date(pub) < cutoff) continue;
        articles.push(mapAutoRow(a));
      }
    } catch {
      // skip malformed files
    }
  }
  return articles;
}

export function getArticles(limit = 50): Article[] {
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
    return MOCK_ARTICLES;
  }

  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const a of [...sqliteArticles, ...autoArticles]) {
    const key = a.url ?? a.slug;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(a);
    }
  }

  return merged
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      const scoreDiff = (b.engagementScore ?? 0) - (a.engagementScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, limit);
}

export function getArticleBySlug(slug: string): Article | null {
  const autoArticle = getAutoArticles().find((a) => a.slug === slug);
  if (autoArticle) return autoArticle;

  const db = getDb();
  if (!db) return MOCK_ARTICLES.find((a) => a.slug === slug) ?? null;
  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM articles WHERE slug = ? AND processed = 1`
    )
    .get(slug) as DbRow | undefined;
  db.close();
  if (row) return mapRow(row);
  return MOCK_ARTICLES.find((a) => a.slug === slug) ?? null;
}
