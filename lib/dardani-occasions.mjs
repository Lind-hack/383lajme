// Which Dardani the navbar's "Pyet Dardanin" pill wears today.
//
// On ordinary days the pill plays the headbob loop. On these days it swaps to
// the matching occasion still instead, judged by the calendar date in Kosovo
// (a reader in New York at 23:00 on 27 Nëntor is already on Flag Day here):
//
//   28 Nëntor           flag-albania    Dita e Flamurit
//   17 Shkurt           flag-kosovo     Dita e Pavarësisë
//   31 Dhjetor, 1 Janar new-year
//   a match day         matchday-scarf  from MATCH_DAYS below
//
// The national days win over a match that falls on one of them.

import { kosovoLocalDate } from "./tregu-date-key.mjs";

/**
 * Kosovo national-team match days, as "YYYY-MM-DD" in Kosovo time.
 * Add each fixture when it is announced; past dates can stay, they never match again.
 * @type {readonly string[]}
 */
export const MATCH_DAYS = [];

/** @type {Record<string, { still: string, copy: string }>} keyed by "MM-DD" */
const FIXED = {
  "11-28": { still: "flag-albania", copy: "Gëzuar Ditën e Flamurit!" },
  "02-17": { still: "flag-kosovo", copy: "Gëzuar Ditën e Pavarësisë!" },
  "12-31": { still: "new-year", copy: "Gëzuar Vitin e Ri!" },
  "01-01": { still: "new-year", copy: "Gëzuar Vitin e Ri!" },
};

const MATCH_DAY = { still: "matchday-scarf", copy: "Hajde Dardanët!" };

/**
 * @param {Date} [now]
 * @param {readonly string[]} [matchDays]
 * @returns {{ still: "flag-albania" | "flag-kosovo" | "new-year" | "matchday-scarf", copy: string } | null}
 */
export function occasionFor(now = new Date(), matchDays = MATCH_DAYS) {
  const day = kosovoLocalDate(now);
  const fixed = FIXED[day.slice(5)];
  if (fixed) return /** @type {any} */ (fixed);
  if (matchDays.includes(day)) return /** @type {any} */ (MATCH_DAY);
  return null;
}
