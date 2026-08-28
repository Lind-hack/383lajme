import type { MarketCategory } from "./tregu-client";

// Live headlines straight from the internet at scoring time — closes the gap
// between the article pipeline (bundled at deploy, up to ~1h stale) and a
// breaking story. Two Google News RSS feeds per market: one for the market's
// category, one built from the market question's own keywords. No API key,
// no new dependency (regex XML parse), hard timeout, and any failure returns
// [] so scoring falls back to bundled articles alone.

export interface LiveHeadline {
  title: string;
  source: string;
  ageMin: number;
  url?: string;
}

const FETCH_TIMEOUT_MS = 4000;
const MAX_HEADLINES = 8;
const MAX_AGE_MIN = 24 * 60;

const CATEGORY_FEED: Record<MarketCategory, string | null> = {
  politike:
    "https://news.google.com/rss/search?q=Kosov%C3%AB+OR+Kosova+politik%C3%AB+OR+qeveria+when%3A1d&hl=sq&gl=XK&ceid=XK:sq",
  ekonomi:
    "https://news.google.com/rss/search?q=Kosov%C3%AB+ekonomi+OR+BQK+OR+inflacioni+when%3A1d&hl=sq&gl=XK&ceid=XK:sq",
  sport:
    "https://news.google.com/rss/search?q=Kosova+sport+OR+futboll+when%3A1d&hl=sq&gl=XK&ceid=XK:sq",
  bote:
    "https://news.google.com/rss/search?q=breaking+world+news+when%3A1d&hl=en-US&gl=US&ceid=US:en",
  "te-tjera": null,
};

const LOCAL_BREAKING_FEED = "https://euronews.al/feed/";

// Albanian + English stopwords stripped before building the per-question query.
const STOPWORDS = new Set([
  "a", "do", "te", "të", "ne", "në", "e", "i", "u", "me", "dhe", "se", "që", "qe",
  "nga", "per", "për", "mbi", "nen", "nën", "ka", "kane", "kanë", "eshte", "është",
  "jane", "janë", "para", "deri", "pas", "kjo", "ky", "kete", "këtë", "vitit", "muajit",
  "the", "an", "of", "to", "in", "on", "is", "are", "will", "before", "by",
]);

const SEARCH_ALIASES = [
  ["ngushtic", "strait"], ["hormuz", "hormuz"], ["rihap", "reopen"],
  ["urë", "bridge"], ["ure", "bridge"], ["iber", "ibar"], ["ibrit", "ibar"],
  ["armepush", "ceasefire"], ["rus", "russia"], ["ukrain", "ukraine"],
  ["viz", "visa"], ["emigru", "immigrant"], ["amerikan", "america"], ["kosovar", "kosovo"],
  ["shqiper", "albania"], ["kapituj", "chapters"], ["negociat", "negotiations"],
  ["bised", "talks"], ["marrevesh", "deal"], ["marrëvesh", "deal"], ["bler", "acquisition"],
  ["nenshkru", "signed"], ["nënshkru", "signed"], ["shkark", "removal"], ["larg", "removal"],
  ["zjar", "fire"], ["algjer", "algeria"], ["luft", "war"], ["sanksion", "sanctions"],
  ["trump", "trump"], ["nvidia", "nvidia"], ["hugging", "hugging"], ["face", "face"],
  ["bitcoin", "bitcoin"], ["lisa", "lisa"], ["cook", "cook"],
];
const CANONICAL_STOPWORDS = new Set([
  ...STOPWORDS,
  "brenda", "plotesisht", "plotësisht", "kryesor", "kryesore", "zyrtar", "zyrtarisht", "konfirmoje", "konfirmohet", "marrë", "marre", "deri", "gusht", "shtator", "tetor", "nëntor", "nentor", "dhjetor", "janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "muaj", "muajve", "ditë", "dite", "ditëve", "ditve", "vite", "vitit", "vjet", "tre", "katër", "kater", "gjashtë", "gjashte", "një", "nje",
]);

function foldSearch(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeSearchToken(token: string): string {
  const folded = foldSearch(token);
  const alias = SEARCH_ALIASES.find(([prefix]) => folded.startsWith(foldSearch(prefix)));
  return alias?.[1] ?? folded;
}

function questionSearchWords(question: string): string[] {
  return foldSearch(question)
    .replace(/[?!.,:;"'()]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

export function liveNewsSearchUrls(question: string): string[] {
  const words = questionSearchWords(question);
  if (words.length < 2) return [];
  const baseWords = words.slice(0, 6);
  const urls = [`https://news.google.com/rss/search?q=${encodeURIComponent(baseWords.join(" ") + " when:1d")}&hl=sq&gl=XK&ceid=XK:sq`];
  const canonicalTerms = [...new Set(words.map(normalizeSearchToken))]
    .filter((term) => term.length >= 4 && !CANONICAL_STOPWORDS.has(term) && !/^\d+$/.test(term))
    .slice(0, 5);
  if (canonicalTerms.length >= 2) {
    const canonicalUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(canonicalTerms.join(" ") + " when:1d")}&hl=en-US&gl=US&ceid=US:en`;
    if (!urls.includes(canonicalUrl)) urls.push(canonicalUrl);
  }
  return urls;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

export function parseLiveNewsRss(xml: string, now = Date.now()): LiveHeadline[] {
  const out: LiveHeadline[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const item of items) {
    const title = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const source = decodeEntities(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "");
    const url = decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? "");
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    if (!title) continue;
    const ts = Date.parse(pubDate);
    const ageMin = Number.isFinite(ts) ? Math.max(0, Math.round((now - ts) / 60000)) : MAX_AGE_MIN;
    if (ageMin > MAX_AGE_MIN) continue;
    out.push({ title, source, ageMin, ...(url ? { url } : {}) });
  }
  return out;
}

// One cron run loops many markets; identical feed URLs (category feeds) are
// fetched once and reused. Serverless instances are short-lived, so a plain
// module map with a TTL is enough.
const cache = new Map<string, { at: number; headlines: LiveHeadline[] }>();
const CACHE_TTL_MS = 60_000;

async function fetchFeed(url: string): Promise<LiveHeadline[]> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.headlines;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "383lajme-tregu/1.0" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const headlines = parseLiveNewsRss(await res.text());
    cache.set(url, { at: Date.now(), headlines });
    return headlines;
  } catch {
    cache.set(url, { at: Date.now(), headlines: [] });
    return [];
  }
}

/** Freshest internet headlines relevant to a market — newest first, deduped, capped. */
export async function liveHeadlinesFor(
  question: string,
  category: MarketCategory,
): Promise<LiveHeadline[]> {
  const urls = [...liveNewsSearchUrls(question), CATEGORY_FEED[category], ...(category === "politike" || category === "ekonomi" || category === "te-tjera" ? [LOCAL_BREAKING_FEED] : [])].filter(
    (u): u is string => Boolean(u),
  );
  if (urls.length === 0) return [];

  const batches = await Promise.all(urls.map(fetchFeed));
  const seen = new Set<string>();
  const merged: LiveHeadline[] = [];
  for (const h of batches.flat().sort((a, b) => a.ageMin - b.ageMin)) {
    const key = h.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(h);
    if (merged.length >= MAX_HEADLINES) break;
  }
  return merged;
}
