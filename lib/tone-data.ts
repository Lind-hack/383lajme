// Server-side reader for the Toni i Mediave / Bota Flet data pipeline.
// Source files are produced by tools/tone_scraper.py (daily via
// .github/workflows/tone-scraper.yml) and are plain JSON under public/ —
// optional-chain everything here, the files can be stale, mid-write-cycle,
// or (on a fresh checkout before the first scraper run) simply absent.

import { readFile } from "fs/promises";
import path from "path";

// tools/tone_scraper.py can now return "unknown" for an article it isn't
// confident enough to score (deliberately, not a bug — see UNKNOWN in that
// file) — the raw types below reflect that honestly. Display-facing types
// further down (ForeignCoverageItem) stay narrowed to the confident three,
// guaranteed by an explicit filter rather than by the type alone.
export type ToneSentimentRaw = "positive" | "neutral" | "negative" | "unknown";

export interface ToneArticle {
  /** Original-language headline, as published. */
  title: string;
  /** Albanian rendering, or null when translation never succeeded. This is
   * what the drill-down leads with — the original is in German or Turkish. */
  albanianTitle?: string | null;
  url: string;
  date: string;
  sentiment: ToneSentimentRaw;
  /** One clause on why the outlet was read this way, from the classifier.
   * Optional: entries written before the v2 stance rewrite have none. */
  reason?: string;
  /** True when the charged language belonged to a quoted speaker rather than
   * to the outlet — which is why the article is not counted against it. */
  isQuote?: boolean;
}

export interface ToneOutlet {
  name: string;
  sentiment: ToneSentimentRaw;
  articleCount: number;
  articles: ToneArticle[];
}

export interface CountrySummary {
  index: number | null;
  positive: number;
  neutral: number;
  negative: number;
  n: number;
  confident: boolean;
}

export interface ToneOutletsData {
  lastUpdated: string;
  overallIndex: number | null;
  totalArticles: number;
  sourceCount: number;
  countries: Record<string, { outlets: ToneOutlet[]; summary: CountrySummary }>;
}

export interface ToneHistoryRow {
  date: string;
  overallIndex: number | null;
  totalArticles: number;
  sourceCount: number;
  /** Which definition of "tone" produced this row. Absent means 1, the
   * original "is this good or bad news" reading; 2 is "is the outlet's own
   * voice hostile toward Kosovo". Rows of different versions are not
   * comparable and must not be subtracted from one another. */
  stanceVersion?: number;
  countries: Record<string, CountrySummary>;
  headlines: Array<{
    title: string;
    source: string;
    country: string;
    flag: string;
    url: string;
    sentiment: ToneSentimentRaw;
  }>;
}

/** Must stay in step with FEEDS/FLAGS in tools/tone_scraper.py. A country
 *  missing here still gets a row and an index, but loses its flag — and with
 *  it the ISO code the map keys its shapes by, so it silently stops being
 *  clickable on the map. */
const FLAGS: Record<string, string> = {
  Gjermani: "🇩🇪", SHBA: "🇺🇸", Britani: "🇬🇧", Francë: "🇫🇷",
  Itali: "🇮🇹", Serbi: "🇷🇸", Austri: "🇦🇹", Zvicër: "🇨🇭",
  Holandë: "🇳🇱", Belgjikë: "🇧🇪", Spanjë: "🇪🇸", Greqi: "🇬🇷",
  Suedi: "🇸🇪", Poloni: "🇵🇱", Turqi: "🇹🇷", Kroaci: "🇭🇷",
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public", file), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getToneOutlets(): Promise<ToneOutletsData | null> {
  return readJson<ToneOutletsData>("tone-outlets.json");
}

export async function getToneHistory(): Promise<ToneHistoryRow[]> {
  const data = await readJson<ToneHistoryRow[]>("tone-history.json");
  return Array.isArray(data) ? data : [];
}

export interface ToneSummary {
  hasData: boolean;
  today: ToneHistoryRow | null;
  overallIndex: number | null;
  /** Change vs. 7 rows back (or the oldest available row, if history is younger than a week). */
  weekDelta: number | null;
  /** Up to 90 most recent {date, index} points, oldest first — for the sparkline / line chart. */
  sparkline: Array<{ date: string; index: number }>;
  countries: Array<{ country: string; flag: string } & CountrySummary>;
  /** Country whose index moved the most vs. 7 rows back. */
  topMover: { country: string; flag: string; delta: number } | null;
  totalArticles: number;
  sourceCount: number;
  lastUpdated: string | null;
  daysTracked: number;
}

/**
 * Reduces the raw history into everything the homepage module and the /toni
 * page need. Returns hasData: false (never fabricated numbers) if the
 * scraper hasn't produced a history row yet — callers must handle that
 * state explicitly rather than rendering zeros.
 */
export function summarizeToneHistory(history: ToneHistoryRow[]): ToneSummary {
  if (history.length === 0) {
    return {
      hasData: false,
      today: null,
      overallIndex: null,
      weekDelta: null,
      sparkline: [],
      countries: [],
      topMover: null,
      totalArticles: 0,
      sourceCount: 0,
      lastUpdated: null,
      daysTracked: 0,
    };
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted[sorted.length - 1];
  const weekAgoIdx = Math.max(0, sorted.length - 8);
  const weekAgo = sorted[weekAgoIdx];

  // A delta is only meaningful between two rows that measured the same thing.
  // On 2026-08-10 the index changed from "was the news about Kosovo good or
  // bad" to "was the outlet's own voice hostile toward Kosovo", which moved
  // the number about twelve points on its own. Subtracting across that
  // boundary would report a methodology change as a swing in world opinion,
  // so it reports nothing at all until there are two v2 rows to compare.
  const sameDefinition =
    (today?.stanceVersion ?? 1) === (weekAgo?.stanceVersion ?? 1);

  const weekDelta =
    today?.overallIndex != null &&
    weekAgo?.overallIndex != null &&
    weekAgoIdx !== sorted.length - 1 &&
    sameDefinition
      ? today.overallIndex - weekAgo.overallIndex
      : null;

  const sparkline = sorted
    .slice(-90)
    .filter((row) => row.overallIndex != null)
    .map((row) => ({ date: row.date, index: row.overallIndex as number }));

  const countryNames = Object.keys(today?.countries ?? {});
  const countries = countryNames.map((country) => {
    const summary = today?.countries?.[country] ?? {
      index: null,
      positive: 0,
      neutral: 0,
      negative: 0,
      n: 0,
      confident: false,
    };
    return { country, flag: FLAGS[country] ?? "", ...summary };
  });

  let topMover: ToneSummary["topMover"] = null;
  if (weekAgo && weekAgo.date !== today.date) {
    for (const country of countryNames) {
      const now = today?.countries?.[country]?.index;
      const then = weekAgo?.countries?.[country]?.index;
      if (now == null || then == null) continue;
      const delta = now - then;
      if (!topMover || Math.abs(delta) > Math.abs(topMover.delta)) {
        topMover = { country, flag: FLAGS[country] ?? "", delta };
      }
    }
  }

  return {
    hasData: true,
    today,
    overallIndex: today?.overallIndex ?? null,
    weekDelta,
    sparkline,
    countries,
    topMover,
    totalArticles: today?.totalArticles ?? 0,
    sourceCount: today?.sourceCount ?? 0,
    lastUpdated: today?.date ?? null,
    daysTracked: sorted.length,
  };
}

// ── Article cache (public/tone-article-cache.json) ───────────────────────
// Written by tools/tone_scraper.py, which now runs 9x/day (07:00–23:00
// Kosovo time) instead of once. This is the persistent, cross-run store
// that lets Bota Flet show new articles throughout the day instead of only
// once daily — see getForeignCoverage() below, which reads this instead of
// today's tone-outlets.json snapshot.

export interface ToneArticleCacheEntry {
  key: string;
  title: string;
  /** Albanian translation, or null if translation never succeeded. */
  albanianTitle: string | null;
  translated: boolean;
  url: string;
  googleNewsUrl: string;
  /** Resolved og:image from the real publisher page, or null if scraping
   * failed or hasn't been retried yet. */
  imageUrl: string | null;
  imageAttempts: number;
  outlet: string;
  country: string;
  sentiment: ToneSentimentRaw;
  date: string;
  firstSeen: string;
  lastSeen: string;
}

export interface ToneArticleCache {
  version: number;
  articles: Record<string, ToneArticleCacheEntry>;
}

export async function getToneArticleCache(): Promise<ToneArticleCache | null> {
  return readJson<ToneArticleCache>("tone-article-cache.json");
}

export interface ForeignCoverageItem {
  /** Albanian translation — what's actually displayed. */
  title: string;
  /** Original-language headline, kept for transparency even though not
   * shown today (a future "shiko origjinalin" link, hover title, etc). */
  originalTitle: string;
  url: string;
  /** Guaranteed non-null — see the imageUrl filter below. */
  imageUrl: string;
  date: string;
  /** Deliberately narrower than ToneSentimentRaw — getForeignCoverage()
   * excludes "unknown" articles before this type is ever constructed, so
   * every consumer (the sentiment-color/label lookups in bota-flet-card.tsx)
   * can assume a real value without a fallback branch. */
  sentiment: "positive" | "neutral" | "negative";
  outlet: string;
  country: string;
  flag: string;
}

/** Same shape as app/page.tsx's titleKws, tuned slightly differently: that
 * one dedupes same-language articles from the site's own pool, where
 * near-duplicate stories tend to share long literal phrases. Here, five
 * outlets independently write their OWN headline (then get independently
 * translated to Albanian) about the same event — "hedh gurë" (threw
 * stones) turning up as a signal needs a shorter minimum length and a
 * lower match threshold than the 5+/3 pairing works with. */
function titleKeywords(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
}

/**
 * Reads the article cache (not today's tone-outlets.json snapshot) for
 * Bota Flet's display pool — this is what makes the section refresh across
 * the day instead of once, and what keeps it non-empty right after
 * midnight before the first run of a new day has landed.
 *
 * Filters to entries that have BOTH a resolved image (the user explicitly
 * chose "only show articles with a real image" over any fake/AI fallback)
 * AND a successful Albanian translation (untranslated headlines aren't
 * shown here at all — Toni still counts their sentiment, translation and
 * display are independent concerns), within a recent window so the section
 * always reads as current news, not a stale backlog.
 */
export function getForeignCoverage(
  cache: ToneArticleCache | null,
  limit = 6,
  windowHours = 72
): ForeignCoverageItem[] {
  if (!cache?.articles) return [];

  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  // Window is based on firstSeen (when OUR pipeline discovered the story —
  // always a clean "YYYY-MM-DD" we generate ourselves), not entry.date (the
  // article's own original publish date from the RSS feed, which the
  // scraper stores as a truncated, non-ISO display string like "Sun, 09 Au"
  // — Date.parse() can't read that at all, and even a fixed format would be
  // the wrong field: a genuinely old story we only just found today should
  // still count as fresh for the pool, and one we found days ago shouldn't
  // resurface just because the original publish date is recent).
  const candidates: Array<{ entry: ToneArticleCacheEntry; ts: number }> = [];
  for (const entry of Object.values(cache.articles)) {
    if (!entry?.imageUrl || !entry?.albanianTitle || !entry?.translated) continue;
    // tools/tone_scraper.py now writes sentiment: "unknown" for an article
    // it isn't confident enough to score (evidence-based classification,
    // not the old keyword guess) — a real, expected value, not corrupt
    // data. Showing it here would mean SENTIMENT_COLOR/SENTIMENT_LABEL in
    // bota-flet-card.tsx (only positive/neutral/negative) silently render
    // a blank badge. The whole point of "unknown" is not guessing, so it's
    // excluded from the one section whose entire premise is a sentiment
    // badge on every card, same as it's already excluded from the country
    // index math on the Python side.
    if (entry.sentiment === "unknown") continue;
    const ts = Date.parse(entry.firstSeen || "");
    if (Number.isNaN(ts) || ts < cutoff) continue;
    candidates.push({ entry, ts });
  }

  // Covers every raw value, including "unknown". The loop above skips those,
  // but the skip does not narrow the type of what was already pushed, and an
  // unlisted key would silently sort as NaN rather than fail loudly.
  const weight: Record<ToneSentimentRaw, number> = {
    negative: 0,
    positive: 1,
    neutral: 2,
    unknown: 3,
  };
  candidates.sort((a, b) => {
    const bySentiment = weight[a.entry.sentiment] - weight[b.entry.sentiment];
    if (bySentiment !== 0) return bySentiment;
    return b.ts - a.ts;
  });

  // Topic diversity pass — same keyword-overlap technique app/page.tsx
  // already uses for NJOFTIME. Without this, a single big story (multiple
  // outlets covering the same parliament incident, say) can legitimately
  // win every negative-first slot and the section shows one event five
  // times instead of five different ones — technically correct sorting,
  // but reads as repetitive rather than "here's what the world is saying."
  const selected: Array<{ entry: ToneArticleCacheEntry; ts: number }> = [];
  const selectedKws: Set<string>[] = [];
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    const kws = titleKeywords(candidate.entry.albanianTitle as string);
    const isDuplicateTopic = selectedKws.some(
      (kw) => [...kws].filter((w) => kw.has(w)).length >= 2
    );
    if (isDuplicateTopic) continue;
    selected.push(candidate);
    selectedKws.push(kws);
  }
  // If diversity filtering left us short (a genuinely slow news day with
  // few distinct stories), top back up with the next-best candidates even
  // if they overlap, rather than showing fewer articles than asked for.
  if (selected.length < limit) {
    for (const candidate of candidates) {
      if (selected.length >= limit) break;
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
    }
  }

  return selected.map(({ entry }) => ({
    title: entry.albanianTitle as string,
    originalTitle: entry.title,
    url: entry.url,
    imageUrl: entry.imageUrl as string,
    date: entry.date,
    // "unknown" was filtered out at the top of the candidate loop, which is
    // what ForeignCoverageItem's narrower type documents — but the filter is
    // a `continue` on a different variable, so the compiler cannot see it.
    sentiment: (entry.sentiment ?? "neutral") as ForeignCoverageItem["sentiment"],
    outlet: entry.outlet,
    country: entry.country,
    flag: FLAGS[entry.country] ?? "",
  }));
}
