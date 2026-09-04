import { KOSOVO_TZ, KOSOVO_TZ_FALLBACK } from "@/lib/reagimi-data";

/**
 * Timestamps for the admin, formatted on the server.
 *
 * Formatting these in the browser caused a hydration mismatch: the same row
 * rendered "Sep 01, 04:52 PM" on the server and "01 sht, 04:52 m.d." on the
 * client, because Node's ICU and the browser's disagree about the `sq` locale.
 * React then discarded and re-rendered the whole list on every load.
 *
 * Formatting here removes the class of bug rather than the instance: the client
 * receives a finished string and has nothing left to disagree about.
 *
 * The zone is pinned to Kosovo for the same reason. The operator reads these
 * against their own clock, and Vercel's servers run UTC, so a local-time
 * getter would quietly shift every evening article to the previous day.
 */

const MONTHS_SHORT = [
  "jan",
  "shk",
  "mar",
  "pri",
  "maj",
  "qer",
  "korr",
  "gush",
  "sht",
  "tet",
  "nën",
  "dhj",
];

/** Numeric parts only: those are stable across ICU builds, month names are not. */
function partsInKosovo(date: Date): Record<string, string> | null {
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  for (const timeZone of [KOSOVO_TZ, KOSOVO_TZ_FALLBACK]) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).formatToParts(date);
      return Object.fromEntries(parts.map((p) => [p.type, p.value]));
    } catch {
      // A Node build without Europe/Pristina falls through to Belgrade, which
      // has kept the same offset and DST rules. lib/tregu-date-key.mjs does
      // the same thing for the same reason.
    }
  }
  return null;
}

/** "1 sht, 16:52", or "1 sht 2025, 16:52" once the year stops being this one. */
export function adminTimestamp(value: string | null | undefined, now = new Date()): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const p = partsInKosovo(date);
  if (!p) return "—";

  const month = MONTHS_SHORT[Number(p.month) - 1] ?? p.month;
  const day = String(Number(p.day));
  const nowParts = partsInKosovo(now);
  const sameYear = nowParts?.year === p.year;

  return sameYear
    ? `${day} ${month}, ${p.hour}:${p.minute}`
    : `${day} ${month} ${p.year}, ${p.hour}:${p.minute}`;
}
