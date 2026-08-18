/**
 * Sondazhi i Ditës — pure logic for the daily poll.
 *
 * Everything here is side-effect free and unit tested in sondazhi-data.test.mjs.
 * The component stays thin: fetch, render, react.
 *
 * Written as .mjs so both the node:test suite and the .ts consumers can import
 * it directly, which is the same split lib/tregu-automation.mjs already uses.
 *
 * The clock and the number formatting come from reagimi-data rather than being
 * reimplemented. The two cards sit against each other on the homepage, and the
 * poll used to key its day off toISOString() (UTC) while Reagimi keyed off local
 * midnight — so on any night between 00:00 and 02:00 the two adjacent cards
 * disagreed about what "today" meant. One clock, one answer.
 */

import { dateKeyInKosovo, previousDateKey, formatCount } from "./reagimi-data.ts";

export { dateKeyInKosovo, previousDateKey, formatCount };

/**
 * @typedef {object} PollRecord
 * @property {string} pollDate
 * @property {string} question
 * @property {string[]} options
 * @property {string | null} [contextLine]      One sentence of real context from the day's news.
 * @property {string | null} [sourceArticleSlug] Article the question came from, for the "lexo" link.
 * @property {"draft" | "approved"} [status]
 */

/**
 * @typedef {object} PollTally
 * @property {number[]} counts  Index-aligned with the poll's options.
 * @property {number} total
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sample size
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Below this many votes a day's split is noise, and saying so is the honest
 * move. It is not a gate — the real numbers and the real count are always
 * shown. It only changes how the result describes itself.
 */
export const PROVISIONAL_THRESHOLD = 25;

/**
 * A poll day is final because its date has passed, not because a job ran.
 * Nothing has to be scheduled, nothing can be missed, and there is no stored
 * `finalized_at` to drift out of sync with reality.
 *
 * @param {string} pollDate
 * @param {string} todayKey
 * @returns {boolean}
 */
export function isFinalDay(pollDate, todayKey) {
  return pollDate < todayKey;
}

/**
 * @param {number} total
 * @param {string} pollDate
 * @param {string} todayKey
 * @returns {boolean}
 */
export function isProvisional(total, pollDate, todayKey) {
  return !isFinalDay(pollDate, todayKey) && total < PROVISIONAL_THRESHOLD;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tally
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fold the `{ "0": 3, "1": 2 }` map the sondazhi_day() RPC returns into an array
 * aligned with the poll's options.
 *
 * Defensive on both sides: an option nobody picked is absent from the map, and a
 * stale vote can point past the end of a poll whose options were edited after
 * voting opened. Neither may throw or silently shift the other bars.
 *
 * @param {Record<string, unknown> | null | undefined} raw
 * @param {number} optionCount
 * @returns {PollTally}
 */
export function tallyFromCounts(raw, optionCount) {
  const counts = new Array(Math.max(0, optionCount)).fill(0);
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      const idx = Number(key);
      const n = Number(value);
      if (!Number.isInteger(idx) || idx < 0 || idx >= counts.length) continue;
      if (!Number.isFinite(n) || n < 0) continue;
      counts[idx] = Math.trunc(n);
    }
  }
  return { counts, total: counts.reduce((a, b) => a + b, 0) };
}

/**
 * Whole percentages that always sum to exactly 100 (largest-remainder method).
 * Without this, rounded bars routinely display as 99% or 101%.
 *
 * @param {readonly number[]} counts
 * @returns {number[]}
 */
export function pollPercentages(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);

  const exact = counts.map((c, i) => ({ i, value: (c / total) * 100 }));
  const out = new Array(counts.length).fill(0);

  let assigned = 0;
  for (const e of exact) {
    out[e.i] = Math.floor(e.value);
    assigned += out[e.i];
  }

  const remainder = 100 - assigned;
  const byFraction = [...exact].sort(
    (a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value))
  );
  for (let i = 0; i < remainder; i++) {
    out[byFraction[i % byFraction.length].i] += 1;
  }

  return out;
}

/**
 * Index of the winning option, or null on a tie or an empty poll.
 *
 * @param {readonly number[]} counts
 * @returns {number | null}
 */
export function leadingOption(counts) {
  let best = -1;
  /** @type {number | null} */
  let bestIdx = null;
  let tied = false;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > best) {
      best = counts[i];
      bestIdx = i;
      tied = false;
    } else if (counts[i] === best) {
      tied = true;
    }
  }
  if (best <= 0) return null;
  return tied ? null : bestIdx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy
//
// The card's whole argument is carried in these lines, so they live here where
// they can be tested rather than scattered through JSX.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "23 vota" / "1 votë" / an invitation when nobody has voted yet.
 * @param {number} total
 * @returns {string}
 */
export function voteCountLabel(total) {
  if (total <= 0) return "Bëhu i pari që voton";
  if (total === 1) return "1 votë";
  return `${formatCount(total)} vota`;
}

/**
 * The line under the options, before voting. States the stake plainly.
 * @param {number} total
 * @returns {string}
 */
export function stakeLabel(total) {
  if (total <= 0) return "Bëhu i pari që voton sot.";
  if (total === 1) return "Një votë deri tani. Vota jote e ndryshon rezultatin.";
  return `${formatCount(total)} vota deri tani. Vota jote e ndryshon rezultatin.`;
}

/**
 * Where the reader stands once they have voted.
 *
 * This is the line that turns a click into a position — "you are in the
 * minority" is a fact about you, not about the poll, and it is what a vote cast
 * without thinking looks like ten seconds later.
 *
 * @param {number | null} myVote
 * @param {readonly number[]} counts
 * @returns {string | null}
 */
export function standingLabel(myVote, counts) {
  if (myVote === null || myVote < 0 || myVote >= counts.length) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 1) return null;

  const mine = counts[myVote];
  const best = Math.max(...counts);

  if (mine === best) {
    const sharedTop = counts.filter((c) => c === best).length > 1;
    return sharedTop ? "Je në një rezultat të barabartë." : "Ti je me shumicën.";
  }
  return `Ti je në pakicë — ${formatCount(mine)} nga ${formatCount(total)}.`;
}

/**
 * How the result describes its own reliability.
 * @param {number} total
 * @param {string} pollDate
 * @param {string} todayKey
 * @returns {string}
 */
export function resultStatusLabel(total, pollDate, todayKey) {
  if (isFinalDay(pollDate, todayKey)) return "Rezultati përfundimtar";
  if (isProvisional(total, pollDate, todayKey)) {
    return `Ende herët — ${voteCountLabel(total)}. Rezultati përfundimtar në mesnatë.`;
  }
  return "Rezultati përfundimtar në mesnatë.";
}

/**
 * The strip at the top of the card: what the room decided yesterday.
 *
 * Yesterday's split rather than today's, on purpose. Showing the live result
 * before someone votes would drag them toward it; yesterday's cannot bias a
 * question it does not belong to, and it is the payoff for having voted then.
 *
 * @param {PollRecord | null} poll
 * @param {readonly number[] | null} counts
 * @returns {{ pct: number, option: string, slug: string | null } | null}
 */
export function yesterdayCallback(poll, counts) {
  if (!poll || !counts) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const winner = leadingOption(counts);
  if (winner === null) return null;

  const option = poll.options[winner];
  if (!option) return null;

  return {
    pct: pollPercentages(counts)[winner],
    option,
    slug: poll.sourceArticleSlug ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Records from rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A `daily_polls` row into a PollRecord, or null if it cannot be trusted.
 *
 * `options` is jsonb and has been written by three different code paths over the
 * table's life, so it is validated rather than cast. A poll with fewer than two
 * usable options is not a poll.
 *
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {PollRecord | null}
 */
export function pollFromRow(row) {
  if (!row) return null;

  const pollDate = typeof row.poll_date === "string" ? row.poll_date : null;
  const question = typeof row.question === "string" ? row.question.trim() : "";
  if (!pollDate || !question) return null;

  const rawOptions = row.options;
  const parsed = Array.isArray(rawOptions)
    ? rawOptions
    : typeof rawOptions === "string"
      ? safeParseArray(rawOptions)
      : null;
  if (!parsed) return null;

  const options = parsed
    .filter((o) => typeof o === "string")
    .map((o) => o.trim())
    .filter(Boolean);
  if (options.length < 2) return null;

  return {
    pollDate,
    question,
    options,
    contextLine:
      typeof row.context_line === "string" && row.context_line.trim()
        ? row.context_line.trim()
        : null,
    sourceArticleSlug:
      typeof row.source_article_slug === "string" && row.source_article_slug.trim()
        ? row.source_article_slug.trim()
        : null,
    status: row.status === "draft" ? "draft" : "approved",
  };
}

/**
 * @param {string} raw
 * @returns {unknown[] | null}
 */
function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown
//
// The day genuinely ends, so saying how long is left is honest urgency rather
// than manufactured pressure. It is also the one number on the card that moves
// while you look at it, which is what makes a static block worth stopping for.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Milliseconds until midnight in Kosovo.
 *
 * Derived from the wall clock Intl reports for the zone rather than from UTC
 * arithmetic, so it stays correct across both DST shifts without special cases.
 *
 * @param {Date} [now]
 * @returns {number}
 */
export function msUntilKosovoMidnight(now = new Date()) {
  const fmt = (tz) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);

  let parts;
  try {
    parts = fmt("Europe/Pristina");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    parts = fmt("Europe/Belgrade");
  }

  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Midnight itself formats as hour 24 in some ICU versions, 00 in others.
  const hour = get("hour") % 24;
  const remainingSeconds = (23 - hour) * 3600 + (59 - get("minute")) * 60 + (60 - get("second"));
  return remainingSeconds * 1000;
}

/**
 * "6 orë 12 min" / "42 min" / "less than a minute".
 *
 * Hours drop off once there are none, because "0 orë 42 min" reads like a
 * broken clock. Under a minute stops counting seconds: a ticking second hand
 * on a poll is pressure the feature has not earned.
 *
 * @param {number} ms
 * @returns {string}
 */
export function countdownLabel(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "Mbyllet së shpejti";
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "Mbyllet brenda pak çastesh";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `Mbyllet për ${minutes} min`;
  if (minutes === 0) return `Mbyllet për ${hours} orë`;
  return `Mbyllet për ${hours} orë ${minutes} min`;
}
