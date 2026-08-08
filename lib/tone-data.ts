// Server-side reader for the Toni i Mediave / Bota Flet data pipeline.
// Source files are produced by tools/tone_scraper.py (daily via
// .github/workflows/tone-scraper.yml) and are plain JSON under public/ —
// optional-chain everything here, the files can be stale, mid-write-cycle,
// or (on a fresh checkout before the first scraper run) simply absent.

import { readFile } from "fs/promises";
import path from "path";

export interface ToneArticle {
  title: string;
  url: string;
  date: string;
  sentiment: "positive" | "neutral" | "negative";
}

export interface ToneOutlet {
  name: string;
  sentiment: "positive" | "neutral" | "negative";
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
  countries: Record<string, CountrySummary>;
  headlines: Array<{
    title: string;
    source: string;
    country: string;
    flag: string;
    url: string;
    sentiment: "positive" | "neutral" | "negative";
  }>;
}

const FLAGS: Record<string, string> = {
  Gjermani: "🇩🇪",
  SHBA: "🇺🇸",
  Britani: "🇬🇧",
  Francë: "🇫🇷",
  Itali: "🇮🇹",
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

  const weekDelta =
    today?.overallIndex != null && weekAgo?.overallIndex != null && weekAgoIdx !== sorted.length - 1
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

export interface ForeignCoverageItem {
  title: string;
  url: string;
  date: string;
  sentiment: "positive" | "neutral" | "negative";
  outlet: string;
  country: string;
  flag: string;
}

/**
 * Flattens tone-outlets.json into a flat, most-relevant-first list of
 * foreign-outlet articles about Kosovo — this is the real feed behind
 * "Bota Flet" (as opposed to the site's own general article pool).
 * Leads with negative/positive (the pieces worth a reader's attention)
 * before neutral wire copy.
 */
export function getForeignCoverage(data: ToneOutletsData | null, limit = 6): ForeignCoverageItem[] {
  if (!data?.countries) return [];

  const items: ForeignCoverageItem[] = [];
  // The scraper dedupes wire copy (AP/Reuters/AFP) within each country's own
  // feed, but not across countries — the same English-language story
  // legitimately shows up in both the SHBA and Britani editions of Google
  // News. Flattened across all 5 countries that reads as this list glitching
  // and repeating itself, so dedupe again here on the way out.
  const seenTitles = new Set<string>();
  function normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 80);
  }

  for (const [country, entry] of Object.entries(data.countries)) {
    for (const outlet of entry?.outlets ?? []) {
      for (const article of outlet?.articles ?? []) {
        if (!article?.title || !article?.url) continue;
        const key = normalizeTitle(article.title);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        items.push({
          title: article.title,
          url: article.url,
          date: article.date ?? "",
          sentiment: article.sentiment ?? "neutral",
          outlet: outlet.name,
          country,
          flag: FLAGS[country] ?? "",
        });
      }
    }
  }

  const weight = { negative: 0, positive: 1, neutral: 2 } as const;
  items.sort((a, b) => weight[a.sentiment] - weight[b.sentiment]);
  return items.slice(0, limit);
}
