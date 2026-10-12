// Kosovo dates, counts and daily streaks — pure logic shared by the daily cards
// (Kuizi i ditës, Sondazhi), the market cards, the category feeds and admin.
//
// The file keeps the name of the feature it was written for, Reagimi i Ditës,
// which has since been replaced by Kuizi i ditës: a dozen modules import from
// this path. Everything here is side-effect free and unit tested in
// reagimi-data.test.mjs.

/**
 * Kosovo local time. Matches the fallback behaviour already used by
 * lib/tregu-date-key.mjs: prefer Europe/Pristina, drop to Europe/Belgrade (the same
 * offset and DST rules) on Intl builds that ship a trimmed tz database.
 */
export const KOSOVO_TZ = "Europe/Pristina";
export const KOSOVO_TZ_FALLBACK = "Europe/Belgrade";

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `YYYY-MM-DD` for a moment, in Kosovo local time.
 *
 * Rolls over at local midnight, not at UTC midnight (01:00 or 02:00 here): for
 * a card whose premise is "today", local midnight is the only right boundary.
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

// ─────────────────────────────────────────────────────────────────────────────
// Counts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thousands separator: U+00A0 NO-BREAK SPACE, written as an escape so it stays
 * visible to the next reader instead of sitting in the source as an invisible
 * character someone later normalises into a plain space.
 *
 * Space grouping is the Albanian convention and sidesteps the comma/period decimal
 * ambiguity. It has to be no-break: a plain space lets the count wrap between the
 * "1" and the "249" at narrow widths, which reads as two separate numbers.
 */
export const THOUSANDS_SEPARATOR = " ";

/** Grouped with a no-break space, e.g. 1 249. */
export function formatCount(n: number): string {
  return String(Math.max(0, Math.trunc(n))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    THOUSANDS_SEPARATOR
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak
// ─────────────────────────────────────────────────────────────────────────────

export interface StreakState {
  lastDate: string;
  count: number;
}

/**
 * Advance a daily streak for an action taken on `todayKey`.
 *
 * Acting twice on the same day does not advance it. Missing a day resets it.
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
