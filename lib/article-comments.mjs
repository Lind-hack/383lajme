// Readers' comments under any story on 383 (app/api/comments, table
// article_comments, migration 0108; drawn by components/comments).
//
// Signed-in readers only. A comment shows at once; readers can report one,
// and REPORT_HIDE reports from different readers hide it until an editor
// looks (app/admin/komente). One level of replies, like TikTok.
//
// Pure. Promises, held by the tests:
//
//   1. A body is cleaned before it is judged: no control characters, no runs
//      of blank lines, no leading or trailing space; empty or too long is
//      refused, never cut.
//   2. Threads: newest conversations first, each one's replies oldest first;
//      a reply whose parent is gone is not shown on its own.
//   3. Counts, names and ids from storage are untrusted.

/** Longest comment, in characters, after cleaning. */
export const MAX_BODY = 600;
/** Reports from different readers that hide a comment until an editor looks. */
export const REPORT_HIDE = 3;
/** Comments one reader may post in RATE_WINDOW_S seconds. */
export const RATE_MAX = 5;
export const RATE_WINDOW_S = 60;
/** Most comments one story's thread loads. */
export const THREAD_LIMIT = 200;

const SLUG = /^[a-z0-9-]{1,160}$/;
// Control characters (not the newline) and the invisible ones used to fake empty text.
const INVISIBLE = new RegExp("[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]", "g");

export const isArticleSlug = (v) => typeof v === "string" && SLUG.test(v);
export const isCommentId = (v) => Number.isSafeInteger(v) && v > 0;

/** The body as it will be stored, or null when there is nothing to store. */
export function cleanBody(raw) {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text : null;
}

/** Why a body cannot be posted, in the reader's words, or null when it can. */
export function bodyProblem(raw) {
  const text = cleanBody(raw);
  if (!text) return "Shkruaj diçka para se ta dërgosh.";
  if ([...text].length > MAX_BODY) return `Komenti mund të ketë deri në ${MAX_BODY} shkronja.`;
  return null;
}

/** One or two letters for the round picture beside a name. */
export function initials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const first = [...parts[0]][0] ?? "";
  const last = parts.length > 1 ? ([...parts.at(-1)][0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * A steady colour for a name's round picture, from a small warm palette, so the
 * same reader looks the same everywhere.
 */
const AVATAR_COLORS = ["#ff4422", "#0047ff", "#00a651", "#7c3aed", "#e91e8c", "#06b6d4", "#f59e0b", "#e41e20"];
export function avatarColor(seed) {
  let h = 0;
  for (const ch of String(seed ?? "")) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/**
 * Rows as the API returns them → conversations: newest first, replies under
 * their comment, oldest first.
 *
 * @param {unknown} rows
 */
export function threads(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && isCommentId(r.id) && typeof r.body === "string" && typeof r.createdAt === "string"
  );
  const top = list.filter((r) => r.parentId == null);
  const ids = new Set(top.map((r) => r.id));
  const replies = new Map();
  for (const r of list) {
    if (r.parentId == null || !ids.has(r.parentId)) continue;
    if (!replies.has(r.parentId)) replies.set(r.parentId, []);
    replies.get(r.parentId).push(r);
  }
  const at = (r) => Date.parse(r.createdAt) || 0;
  return top
    .sort((a, b) => at(b) - at(a) || b.id - a.id)
    .map((r) => ({ ...r, replies: (replies.get(r.id) ?? []).sort((a, b) => at(a) - at(b) || a.id - b.id) }));
}

/** Rows {article_slug, n} → { slug: count }. */
export function countsFrom(rows) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const n = Number(row?.n);
    if (!isArticleSlug(row?.article_slug) || !Number.isFinite(n) || n <= 0) continue;
    out[row.article_slug] = (out[row.article_slug] ?? 0) + Math.floor(n);
  }
  return out;
}

/** "a,b,c" or an array → distinct valid slugs, at most `max`. */
export function parseArticleSlugs(input, max = 60) {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  return [...new Set(list.map((s) => String(s).trim()).filter(isArticleSlug))].slice(0, max);
}

/** 1 koment, 12 komente, 1,2 mijë komente. */
export function countLabel(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v === 1) return "1 koment";
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(".", ",").replace(",0", "")} mijë komente`;
  return `${v} komente`;
}

/** The short count under the button in the reel: 7, 1,2K. */
export function shortCount(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  return `${(v / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K`;
}
