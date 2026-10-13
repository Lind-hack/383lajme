// Small things that make Për ty read as the reader's own.
//
//   greeting   "Mirëmëngjes, Lind" by the hour in Kosovo
//   dwellNudge how much a story screen's time on view teaches the paper:
//              staying to read the key points is a quiet "more", flicking past
//              at once a quiet "less" — both far smaller than 👍 / 👎
//
// Pure.

/** Below this the reader did not even read the headline. */
export const FLICK_MS = 1500;
/** At or above this the reader stayed to read the points. */
export const STAY_MS = 6000;
/** Past this they had put the phone down: it says nothing. */
export const AWAY_MS = 120_000;
export const STAY_NUDGE = 0.3;
export const FLICK_NUDGE = -0.15;

/** The hour in Kosovo, whatever the device's clock zone. */
export function kosovoHour(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Belgrade" }).format(date));
  return Number.isFinite(h) ? h % 24 : date.getHours();
}

/** "Mirëmëngjes, Lind" — or without the comma when there is no name. */
export function greeting(date = new Date(), name = "") {
  const h = kosovoHour(date);
  const word = h >= 5 && h < 11 ? "Mirëmëngjes" : h >= 11 && h < 18 ? "Mirëdita" : "Mirëmbrëma";
  const who = typeof name === "string" ? name.trim() : "";
  return who ? `${word}, ${who}` : word;
}

/** What `ms` on a story screen (without opening it) adds to its key's weight. */
export function dwellNudge(ms) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t < 0 || t >= AWAY_MS) return 0;
  if (t < FLICK_MS) return FLICK_NUDGE;
  if (t >= STAY_MS) return STAY_NUDGE;
  return 0;
}
