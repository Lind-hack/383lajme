// Reagimi i Ditës — pure logic.
//
// Everything here is side-effect free and unit tested in reagimi-data.test.mjs.
// The component stays thin: fetch, render, react.

/**
 * Kosovo local time. Matches the fallback behaviour already used by
 * lib/tregu-date-key.mjs: prefer Europe/Pristina, drop to Europe/Belgrade (the same
 * offset and DST rules) on Intl builds that ship a trimmed tz database.
 */
export const KOSOVO_TZ = "Europe/Pristina";
export const KOSOVO_TZ_FALLBACK = "Europe/Belgrade";

// ─────────────────────────────────────────────────────────────────────────────
// Reaction vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Five reactions spanning negative → dismissive → positive.
 *
 * Deliberately NOT a yes/no: `DailyPoll` sits directly below this module and is
 * already a binary Po/Jo vote. This differentiates by being an expressive reaction
 * to a specific thing rather than an answer to a question.
 *
 * Icon names map to lucide-react exports; the component holds the actual imports so
 * this module stays free of React deps and can be tested in plain node.
 *
 * Keep the keys in sync with the CHECK constraint in
 * supabase/migrations/0041_reagimi_dites.sql.
 */
export const REACTIONS = [
  { key: "zemerim", label: "Zemërim", icon: "Flame" },
  { key: "dyshim", label: "Dyshim", icon: "HelpCircle" },
  { key: "qesharake", label: "Qesharake", icon: "Laugh" },
  { key: "dakord", label: "Dakord", icon: "ThumbsUp" },
  { key: "shprese", label: "Shpresë", icon: "Sparkles" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

const REACTION_KEYS: readonly string[] = REACTIONS.map((r) => r.key);

export function isReactionKey(value: unknown): value is ReactionKey {
  return typeof value === "string" && REACTION_KEYS.includes(value);
}

export function reactionLabel(key: ReactionKey): string {
  return REACTIONS.find((r) => r.key === key)?.label ?? key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────────────────────

/** A curated row from `reagimi_daily`. */
export interface ReagimiRecord {
  reagimiDate: string;
  quote: string;
  speakerName: string;
  speakerRole: string | null;
  contextLine: string | null;
  articleSlug: string | null;
  videoUrl: string | null;
}

/** What the card renders, from either the curated row or the auto fallback. */
export interface ReagimiView {
  /** `curated` = an editor filled it in. `auto` = derived from today's articles. */
  source: "curated" | "auto";
  dateKey: string;
  /** The lead. A real quote when curated; the headline when auto. */
  lead: string;
  /** Person who said it (curated) or the outlet that reported it (auto). */
  attributionName: string;
  attributionRole: string | null;
  contextLine: string | null;
  articleSlug: string | null;
  videoUrl: string | null;
  /** Auto-picked leads are headlines, so they are not rendered in quote marks. */
  quoted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `YYYY-MM-DD` for a moment, in Kosovo local time.
 *
 * Note this intentionally differs from `DailyPoll`, which uses
 * `toISOString().slice(0,10)` (UTC) and therefore rolls its day over at 01:00 or
 * 02:00 local rather than midnight. For a feature whose entire premise is "today",
 * rolling at local midnight is the correct behaviour.
 */
export function dateKeyInKosovo(when: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the key shape we want.
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: KOSOVO_TZ }).format(when);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.DateTimeFormat("en-CA", {
      ...opts,
      timeZone: KOSOVO_TZ_FALLBACK,
    }).format(when);
  }
}

/** Shift a `YYYY-MM-DD` key by whole days. Pure string math, no tz involved. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  // UTC noon keeps the arithmetic clear of DST edges entirely.
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function previousDateKey(dateKey: string): string {
  return shiftDateKey(dateKey, -1);
}

const WEEKDAYS_SQ = [
  "E diel",
  "E hënë",
  "E martë",
  "E mërkurë",
  "E enjte",
  "E premte",
  "E shtunë",
];

const MONTHS_SQ = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
];

/**
 * "E martë, 16 gusht" — the visible proof that this is today's.
 *
 * Hand-rolled rather than `Intl` with an `sq` locale: Albanian locale data is not
 * guaranteed present in every runtime (notably a slimmed server ICU), and silently
 * falling back to English weekday names on a Kosovo news site is worse than a table.
 */
export function formatAlbanianDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "";
  const weekday = WEEKDAYS_SQ[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  return `${weekday}, ${d} ${MONTHS_SQ[m - 1]}`;
}

/** Relative label for the continuity rail: "Dje" or the plain date. */
export function relativeDayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Sot";
  if (dateKey === previousDateKey(todayKey)) return "Dje";
  return formatAlbanianDate(dateKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tally
// ─────────────────────────────────────────────────────────────────────────────

export interface Tally {
  counts: Record<ReactionKey, number>;
  total: number;
  /** Highest-count reaction, or null when there are no reactions yet. Ties resolve
   *  by REACTIONS order so the result is stable across renders. */
  top: ReactionKey | null;
}

export function emptyCounts(): Record<ReactionKey, number> {
  return REACTIONS.reduce(
    (acc, r) => {
      acc[r.key] = 0;
      return acc;
    },
    {} as Record<ReactionKey, number>
  );
}

export function tallyReactions(rows: ReadonlyArray<{ reaction: string }>): Tally {
  const counts = emptyCounts();
  let total = 0;

  for (const row of rows) {
    if (!isReactionKey(row.reaction)) continue; // ignore anything not in the vocabulary
    counts[row.reaction] += 1;
    total += 1;
  }

  let top: ReactionKey | null = null;
  for (const r of REACTIONS) {
    if (counts[r.key] === 0) continue;
    if (top === null || counts[r.key] > counts[top]) top = r.key;
  }

  return { counts, total, top };
}

/** Whole percentages that always sum to exactly 100 (largest-remainder method).
 *  Without this, five rounded bars routinely display as 99% or 101%. */
export function reactionPercentages(tally: Tally): Record<ReactionKey, number> {
  const out = emptyCounts();
  if (tally.total === 0) return out;

  const exact = REACTIONS.map((r) => ({
    key: r.key,
    value: (tally.counts[r.key] / tally.total) * 100,
  }));

  let assigned = 0;
  for (const e of exact) {
    out[e.key] = Math.floor(e.value);
    assigned += out[e.key];
  }

  const remainder = 100 - assigned;
  const byFraction = [...exact].sort(
    (a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value))
  );
  for (let i = 0; i < remainder; i++) {
    out[byFraction[i % byFraction.length].key] += 1;
  }

  return out;
}

/**
 * Thousands separator: U+00A0 NO-BREAK SPACE, written as an escape so it stays
 * visible to the next reader instead of sitting in the source as an invisible
 * character someone later normalises into a plain space.
 *
 * Space grouping is the Albanian convention and sidesteps the comma/period decimal
 * ambiguity. It has to be no-break: a plain space lets the count wrap between the
 * "1" and the "249" at narrow widths, which reads as two separate numbers.
 */
export const THOUSANDS_SEPARATOR = "\u00A0";

/** Grouped with a no-break space, e.g. 1 249. */
export function formatCount(n: number): string {
  return String(Math.max(0, Math.trunc(n))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    THOUSANDS_SEPARATOR
  );
}

/** "1 249 reaguan" / "1 person reagoi" — Albanian singular/plural. */
export function reactionCountLabel(total: number): string {
  if (total === 0) return "Bëhu i pari që reagon";
  if (total === 1) return "1 person reagoi";
  return `${formatCount(total)} reaguan`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak
// ─────────────────────────────────────────────────────────────────────────────

export interface StreakState {
  lastDate: string;
  count: number;
}

/**
 * Advance the streak for a reaction cast on `todayKey`.
 *
 * Reacting twice on the same day does not advance it. Missing a day resets it.
 * Only rendered from 2 upward: a "1 day streak" is not a streak.
 */
export function advanceStreak(prev: StreakState | null, todayKey: string): StreakState {
  if (!prev || !prev.lastDate) return { lastDate: todayKey, count: 1 };
  if (prev.lastDate === todayKey) return prev;
  if (prev.lastDate === previousDateKey(todayKey)) {
    return { lastDate: todayKey, count: prev.count + 1 };
  }
  return { lastDate: todayKey, count: 1 };
}

/** A stored streak only still counts if it is from today or yesterday. */
export function activeStreak(prev: StreakState | null, todayKey: string): number {
  if (!prev || !prev.lastDate) return 0;
  if (prev.lastDate === todayKey) return prev.count;
  if (prev.lastDate === previousDateKey(todayKey)) return prev.count;
  return 0;
}

export function parseStreak(raw: string | null): StreakState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Optional-chained: this is persisted data and may predate the current shape.
    const lastDate = (parsed as Partial<StreakState>)?.lastDate;
    const count = (parsed as Partial<StreakState>)?.count;
    if (typeof lastDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return null;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
    return { lastDate, count: Math.trunc(count) };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal shape this module needs from `Article`. Keeps lib/mock-data out of tests. */
export interface SelectableArticle {
  id: string;
  slug: string;
  title: string;
  source: string;
  category: string;
  publishedAt: string;
  engagementScore?: number;
  videoClipUrl?: string;
}

/**
 * Auto fallback: the strongest article **published today**, and nothing else.
 *
 * This is the fix for the shipped `· 5d`. The previous implementation picked the
 * highest-scored non-hero article with no date constraint whatsoever, so a quiet
 * news week left a five-day-old article sitting under a heading that promises daily.
 * Returning null here is correct and the card renders its waiting state.
 */
export function pickFallbackArticle<T extends SelectableArticle>(
  articles: readonly T[],
  todayKey: string,
  excludeId?: string
): T | null {
  const todays = articles.filter(
    (a) =>
      a.id !== excludeId &&
      a.publishedAt &&
      dateKeyInKosovo(new Date(a.publishedAt)) === todayKey
  );
  if (todays.length === 0) return null;

  return todays.reduce((best, a) =>
    (a.engagementScore ?? 0) > (best.engagementScore ?? 0) ? a : best
  );
}

/** Curated row → view model. */
export function viewFromRecord(record: ReagimiRecord): ReagimiView {
  return {
    source: "curated",
    dateKey: record.reagimiDate,
    lead: record.quote,
    attributionName: record.speakerName,
    attributionRole: record.speakerRole,
    contextLine: record.contextLine,
    articleSlug: record.articleSlug,
    videoUrl: record.videoUrl,
    quoted: true,
  };
}

/**
 * Auto-picked article → view model.
 *
 * `quoted: false` matters: the lead is a headline, so it must not render inside
 * quote marks attributed to a person. Attribution is the outlet that reported it,
 * which is true, rather than a speaker we cannot know.
 */
export function viewFromArticle(article: SelectableArticle, todayKey: string): ReagimiView {
  return {
    source: "auto",
    dateKey: todayKey,
    lead: article.title,
    attributionName: article.source,
    attributionRole: article.category,
    contextLine: null,
    articleSlug: article.slug,
    videoUrl: article.videoClipUrl ?? null,
    quoted: false,
  };
}

/** Resolve what to show today: curated wins, else today's top article, else nothing. */
export function resolveView<T extends SelectableArticle>(
  record: ReagimiRecord | null,
  articles: readonly T[],
  todayKey: string,
  excludeId?: string
): ReagimiView | null {
  if (record) return viewFromRecord(record);
  const article = pickFallbackArticle(articles, todayKey, excludeId);
  return article ? viewFromArticle(article, todayKey) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video
// ─────────────────────────────────────────────────────────────────────────────

/** Pull the 11-char id out of an embed, watch, youtu.be or shorts URL. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /embed\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Thumbnail candidates, best first.
 *
 * `hqdefault` (what shipped) is 480x360 4:3, so a 16:9 slot letterboxes it with
 * black bars. `maxresdefault` and `sddefault` are 16:9 but are not generated for
 * every upload, hence the ordered fallback the component walks on error.
 */
export function thumbnailCandidates(videoId: string): string[] {
  return [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
