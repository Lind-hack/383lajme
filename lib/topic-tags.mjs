/**
 * Kërko — topic tags on every article.
 *
 * The search finds a topic through the tags of the articles about it (see
 * scoreTopic in search-match.mjs), so a Champions League report is found by
 * "futboll" and "sport" whatever words it uses, and a story about the crypto
 * market that names Bitcoin in passing is not found by "bitcoin".
 *
 * The heartbeat (lib/topic-tags-server.ts) asks the model which topics of the
 * tree (search-topics.mjs) each new article is about, a dozen articles per
 * call, and keeps the answers in one JSON index in Supabase storage, the same
 * pattern as the Për ty summaries. No table, no migration.
 *
 * Index: { items: { <slug>: { t: string[] | null, v: number, n?: number } } }
 *   t  the topic ids, [] when the article is about none of them, null while
 *      the model has not answered for it
 *   v  TOPICS_VERSION the tags were made against; older ones are redone
 *   n  how many calls skipped the article, so one it never answers stops
 *      being retried after MAX_TRIES
 *
 * Pure and unit tested in topic-tags.test.mjs.
 */

import { TOPICS, TOPIC_IDS, TOPICS_VERSION } from "./search-topics.mjs";

export const TAG_BUCKET = "search-topics";
export const INDEX_PATH = "index.json";
/** Articles per model call. */
export const PER_CALL = 12;
export const MAX_TAGS = 4;
export const MAX_TRIES = 3;
/** What the model sees of an excerpt: enough to know the subject. */
const EXCERPT_CHARS = 280;

const tree = TOPICS.map((t) => `${t.id} — ${t.name}${t.parent ? ` (under ${t.parent})` : ""}`).join("\n");

/** Written in English: it is a classifier's brief, never shown to a reader. */
export const TAG_SYSTEM = `You tag stories from 383, a Kosovo news site, with the topics they are about.
Stories are in Albanian. Pick topics only from this list (id — name):

${tree}

Rules:
- Tag what the story is ABOUT, not every word it mentions. A story about the crypto market
  that mentions Bitcoin once is "kripto", not "bitcoin". A story about a minister's trial is
  "drejtesia" and maybe "korrupsioni", not "qeveria".
- Use the most specific topic that fits. Do not also add its parent: "liga-kampioneve" already
  counts as football and sport.
- One to ${MAX_TAGS} topics. A story about none of them gets [].
- Countries, cities and people are not topics; ignore them.

Reply with JSON only, one entry per story number: {"tags": {"1": ["id"], "2": []}}`;

/** The user turn: the stories, numbered from 1. */
export function buildTagPrompt(batch) {
  return batch
    .map((article, i) => {
      const excerpt = String(article.excerpt ?? "").replace(/\s+/g, " ").trim().slice(0, EXCERPT_CHARS);
      return `${i + 1}. ${String(article.title ?? "").trim()}${excerpt ? `\n   ${excerpt}` : ""}`;
    })
    .join("\n");
}

/** Known ids only, once each, at most MAX_TAGS. Untrusted model output. */
function cleanList(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const id of value) {
    const clean = typeof id === "string" ? id.trim().toLowerCase() : "";
    if (!TOPIC_IDS.has(clean) || out.includes(clean)) continue;
    out.push(clean);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

/**
 * slug → topic ids from the model's answer. A story the answer does not cover
 * is left out, so it is tried again; [] is kept, because "about none of them"
 * is an answer.
 */
export function cleanTags(raw, batch) {
  const out = new Map();
  const tags = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.tags : null;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return out;
  batch.forEach((article, i) => {
    const list = cleanList(tags[String(i + 1)]);
    if (list && article?.slug) out.set(article.slug, list);
  });
  return out;
}

/** The stored index, made safe to read whatever is in the file. */
export function normalizeIndex(raw) {
  const items = {};
  const source = raw && typeof raw === "object" && raw.items && typeof raw.items === "object" && !Array.isArray(raw.items) ? raw.items : {};
  for (const [slug, item] of Object.entries(source)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const t = item.t === null ? null : cleanList(item.t);
    if (t === null && item.t !== null) continue;
    items[slug] = { t, v: Number.isFinite(item.v) ? item.v : 0, ...(Number.isFinite(item.n) ? { n: item.n } : {}) };
  }
  return { items, updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null };
}

/** The index with this run's answers, and a skip counted for each story the model passed over. */
export function withTags(index, tags, skipped, now) {
  const items = { ...index.items };
  for (const [slug, t] of tags) items[slug] = { t, v: TOPICS_VERSION };
  for (const slug of skipped) {
    if (tags.has(slug)) continue;
    const before = items[slug];
    items[slug] = { t: before?.v === TOPICS_VERSION ? before.t : null, v: TOPICS_VERSION, n: (before?.n ?? 0) + 1 };
  }
  return { items, updatedAt: new Date(now).toISOString() };
}

/** Articles (newest first) still needing tags on the current tree, up to max. */
export function pickUntagged(articles, index, max) {
  const out = [];
  for (const article of articles) {
    if (!article?.slug || !article?.title) continue;
    const item = index.items[article.slug];
    const done = item && item.v === TOPICS_VERSION && (item.t !== null || (item.n ?? 0) >= MAX_TRIES);
    if (done) continue;
    out.push(article);
    if (out.length === max) break;
  }
  return out;
}

/** slug → topic ids for the search: tagged articles only, old trees included until redone. */
export function tagMap(index) {
  const map = new Map();
  for (const [slug, item] of Object.entries(index.items)) {
    if (Array.isArray(item.t)) map.set(slug, item.t);
  }
  return map;
}
