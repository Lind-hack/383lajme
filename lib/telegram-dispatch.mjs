/**
 * Pure logic for the Telegram news dispatch: candidate selection and message
 * rendering. No fetch calls here — app/api/cron/dispatch-telegram does I/O —
 * so every rule below is unit-testable the same way as sondazhi/tregu helpers.
 *
 * Bot API facts these constants encode (core.telegram.org/bots/api):
 *   - sendPhoto caption: 0–1024 characters AFTER entity parsing (HTML tags count).
 *   - photo by HTTP URL: <= 10 MB, width+height <= 10000 px.
 *   - sendMessage text: 1–4096 characters.
 */

const SITE_BASE = "https://www.383ks.com";
export const CAPTION_LIMIT = 1024;

/** Featured articles younger than this may go to the channel. */
export const MAX_AGE_HOURS = 36;

/** Hard cap per run — a chat feed floods long before a reader forgives it. */
export const MAX_POSTS_PER_RUN = 3;

export function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function articleUrl(slug) {
  return `${SITE_BASE}/article/${slug}`;
}

/**
 * Channel caption: bold headline, short excerpt, one link. The excerpt yields
 * space whenever title + link crowd the 1024-character budget: it is trimmed
 * conservatively up front (escaping can inflate raw text), shaved again if the
 * escaped composition still overflows, and cleaned to end on a word boundary
 * plus an ellipsis rather than a half word or a torn HTML entity.
 */
export function renderCaption(article, { captionLimit = CAPTION_LIMIT } = {}) {
  const title = String(article.title ?? "").trim();
  const excerptRaw = String(article.excerpt ?? "").replace(/\s+/g, " ").trim();
  const url = articleUrl(String(article.slug ?? ""));

  const titlePart = `<b>${escapeHtml(title)}</b>`;
  // Written out rather than hidden behind anchor text. These posts get
  // copied into WhatsApp, where there is no channel to link back to, and
  // copying an <a> leaves the URL behind: the reader pastes a headline
  // with nothing to tap. Telegram auto-links a bare URL anyway.
  const linkPart = `Lexo më shumë: ${escapeHtml(url)}`;

  let allowed = Math.max(0, captionLimit - titlePart.length - linkPart.length - 8);
  let excerptEsc = escapeHtml(excerptRaw.slice(0, Math.floor((allowed * 92) / 100)));

  let body = excerptEsc;
  while (`${titlePart}\n\n${body}\n\n${linkPart}`.length > captionLimit && body.length > 24) {
    body = body.slice(0, body.length - 24);
  }
  if (body.length > 0) {
    // A slice can land mid-entity ("&am"); entities always close with ";",
    // so anything dangling from an "&" without one is torn — drop it.
    body = body.replace(/&[^;]*$/, "");
    const spaceIdx = body.lastIndexOf(" ");
    if (spaceIdx > 40) body = body.slice(0, spaceIdx);
    body += "…";
  }

  return `${titlePart}\n\n${body}\n\n${linkPart}`;
}

/**
 * What goes to the channel today: featured, fresh, not already posted,
 * newest first, capped per run.
 */
export function selectCandidates({
  articles,
  postedSlugs,
  nowMs = Date.now(),
  maxAgeHours = MAX_AGE_HOURS,
  limit = MAX_POSTS_PER_RUN,
}) {
  const posted = postedSlugs instanceof Set ? postedSlugs : new Set(postedSlugs ?? []);
  const cutoff = nowMs - maxAgeHours * 60 * 60 * 1000;

  return (articles ?? [])
    .map((a) => ({ ...a, _ts: Date.parse(a.publishedAt ?? "") }))
    .filter((a) => Number.isFinite(a._ts))
    .filter((a) => a.featured === true)
    .filter((a) => a._ts >= cutoff)
    .filter((a) => !posted.has(a.slug))
    .sort((a, b) => b._ts - a._ts)
    .slice(0, limit);
}
