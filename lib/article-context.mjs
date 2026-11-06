/**
 * The context card and in-text media of an article, as the page may trust them.
 *
 * scripts/news_article_context.py writes raw_article.context after publication.
 * Older rows have none, and an id ends up in an iframe address, so everything is
 * checked again here: a bad item is dropped, it never reaches the page.
 *
 * Posts are the platform's own player and never a copy; photos are Commons only.
 */

const ID = {
  instagram: /^[\w-]{5,40}$/,
  x: /^\d{1,25}$/,
  tiktok: /^\d{1,25}$/,
  youtube: /^[\w-]{11}$/,
};

const POST_URL = {
  instagram: /^https:\/\/www\.instagram\.com\/(?:p|reel)\/[\w-]+\/$/,
  x: /^https:\/\/x\.com\/\w{1,15}\/status\/\d+$/,
  tiktok: /^https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+$/,
  youtube: /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/,
};

/** The player address for a post, or undefined if the id isn't one we recognise. */
export function embedFrame({ platform, id, post } = {}) {
  if (!Object.hasOwn(ID, String(platform)) || !ID[platform].test(String(id ?? ""))) return undefined;
  if (platform === "instagram") return `https://www.instagram.com/${post === "reel" ? "reel" : "p"}/${id}/embed/captioned/`;
  if (platform === "x") return `https://platform.twitter.com/embed/Tweet.html?id=${id}&dnt=true`;
  if (platform === "tiktok") return `https://www.tiktok.com/player/v1/${id}`;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanMedia(item) {
  if (!item || typeof item !== "object") return null;
  const after = Number.isInteger(item.after) && item.after >= 0 ? item.after : 0;
  if (item.kind === "embed") {
    if (!embedFrame(item) || !POST_URL[item.platform].test(text(item.url))) return null;
    return { kind: "embed", platform: item.platform, id: item.id, post: text(item.post), url: item.url, author: text(item.author), caption: text(item.caption), after };
  }
  if (item.kind === "photo") {
    const src = text(item.src);
    const page = text(item.page);
    if (!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(src) || !text(item.credit)) return null;
    if (!page.startsWith("https://commons.wikimedia.org/")) return null;
    return { kind: "photo", src, credit: text(item.credit), page, who: text(item.who), after };
  }
  return null;
}

/** raw_article.context as the page may show it, or undefined when there is nothing to show. */
export function parseArticleContext(value) {
  if (!value || typeof value !== "object" || value.v !== 1 || value.status !== "ok") return undefined;
  const media = Array.isArray(value.media) ? value.media.map(cleanMedia).filter(Boolean) : [];
  const what = text(value.what);
  const why = text(value.why);
  if (!what && media.length === 0) return undefined;
  return { what: what || undefined, why: why || undefined, media };
}

/**
 * Paragraphs and media in reading order. An edit can shorten a body after its media
 * were placed; media past the end go after the last paragraph, they are never lost.
 */
export function weaveMedia(paragraphs, media = []) {
  const last = Math.max(0, paragraphs.length - 1);
  const placed = media.map((item) => ({ ...item, after: Math.min(item.after, last) }));
  const out = [];
  paragraphs.forEach((paragraph, index) => {
    out.push({ kind: "paragraph", paragraph, index });
    for (const item of placed) if (item.after === index) out.push(item);
  });
  if (paragraphs.length === 0) out.push(...placed);
  return out;
}
