// "3 ditë rresht!" — how many days in a row the reader has opened "Për ty".
//
// Counted by the calendar day in Kosovo, on the device only. Opening twice on
// the same day does not count twice; missing a day starts again at one.

import { kosovoLocalDate } from "./tregu-date-key.mjs";

export const STREAK_KEY = "383:perty-streak";

/** The Kosovo date the day before `day` ("YYYY-MM-DD"). */
function dayBefore(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fold today's visit into the stored streak (untrusted) and return the new one.
 * @returns {{ day: string, count: number }}
 */
export function nextStreak(stored, now = new Date()) {
  const today = kosovoLocalDate(now);
  const day = typeof stored?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stored.day) ? stored.day : null;
  const count = Number.isInteger(stored?.count) && stored.count > 0 ? Math.min(stored.count, 3650) : 0;
  if (day === today && count > 0) return { day, count };
  if (day === dayBefore(today) && count > 0) return { day: today, count: count + 1 };
  return { day: today, count: 1 };
}
