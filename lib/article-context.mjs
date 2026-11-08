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

// Where a chart's numbers may come from, and the page each one links to.
const CHART_SOURCE = {
  CoinGecko: /^https:\/\/www\.coingecko\.com\/en\/coins\/[a-z0-9-]+$/,
  "Banka Qendrore Evropiane": /^https:\/\/data\.ecb\.europa\.eu\/data\/datasets\/EXR\/EXR\.D\.[A-Z]{3}\.EUR\.SP00\.A$/,
};

function cleanChart(chart) {
  if (!chart || typeof chart !== "object") return undefined;
  const pattern = Object.hasOwn(CHART_SOURCE, String(chart.source)) ? CHART_SOURCE[chart.source] : null;
  if (!pattern || !pattern.test(text(chart.source_url)) || !text(chart.label) || !/^[A-Z]{3}$/.test(text(chart.unit))) return undefined;
  const points = Array.isArray(chart.points) ? chart.points.slice(-400) : [];
  const valid = points.every((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number.isFinite(p[1]) && p[1] > 0);
  if (!valid || points.length < 5) return undefined;
  return { label: text(chart.label), unit: chart.unit, points: points.map(([day, value]) => [day, value]), source: chart.source, sourceUrl: chart.source_url };
}

/** "Në shifra": two to six of the story's own numbers, each checked against its sources by the job. */
function cleanFigures(figures) {
  if (!figures || typeof figures !== "object" || !Array.isArray(figures.items)) return undefined;
  const title = text(figures.title);
  const unit = text(figures.unit);
  const items = figures.items;
  if (!title || unit.length > 12 || items.length < 2 || items.length > 6) return undefined;
  const valid = items.every((i) => i && typeof i === "object" && text(i.label) && text(i.label).length <= 40
    && typeof i.value === "number" && Number.isFinite(i.value) && i.value >= 0);
  if (!valid || !items.some((i) => i.value > 0)) return undefined;
  return { title, unit, items: items.map((i) => ({ label: text(i.label), value: i.value })) };
}

const round = (value) => Number(value.toFixed(1));

/**
 * An SVG line and area for a price series in a width x height box. x follows the
 * calendar, so a weekend without a rate is a gap in time, not a squeezed step.
 */
export function chartShape(points, width, height) {
  const days = points.map(([day]) => Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const values = points.map(([, value]) => value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(1, days[days.length - 1] - days[0]);
  const x = (i) => round(((days[i] - days[0]) / span) * width);
  const y = (i) => round(high === low ? height / 2 : ((high - values[i]) / (high - low)) * height);
  const line = values.map((_, i) => `${i ? "L" : "M"}${x(i)},${y(i)}`).join("");
  const first = values[0];
  const last = values[values.length - 1];
  return {
    line,
    area: `${line}L${width},${height}L0,${height}Z`,
    lastY: y(values.length - 1),
    low, high, first, last,
    change: (last - first) / first,
  };
}

/** raw_article.context as the page may show it, or undefined when there is nothing to show. */
export function parseArticleContext(value) {
  if (!value || typeof value !== "object" || value.v !== 1 || value.status !== "ok") return undefined;
  const media = Array.isArray(value.media) ? value.media.map(cleanMedia).filter(Boolean) : [];
  const what = text(value.what);
  const why = text(value.why);
  const chart = cleanChart(value.chart);
  const figures = cleanFigures(value.figures);
  if (!what && media.length === 0 && !chart && !figures) return undefined;
  return { what: what || undefined, why: why || undefined, media, chart, figures };
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
