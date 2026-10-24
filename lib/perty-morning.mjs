// The rules of the morning push, kept apart from the database so they can be
// tested: when it goes out, which push addresses are accepted, and what the
// notification says.
//
// The push carries nothing personal. It wakes the site's service worker
// (public/tregu-sw.js), which asks /api/per-ty/push/latest whether this browser
// was just sent its morning edition, and if so shows the note below. The seven
// stories are put together on the device when the reader opens Për ty.

import { noDashes } from "./story-summary.mjs";

export const MORNING_HOUR = 7;
/** How long after sending the worker still recognises the push as the morning one. */
export const RECENT_MS = 30 * 60 * 1000;

/**
 * How the morning push greets. It is the one place a reader hears from 383
 * before opening it, so it should sound like a person, not a system: short,
 * warm, a different line on different days (the same words every morning
 * stop being read), no dashes, no "Dardani i ka zgjedhur" machinery.
 */
export const MORNING_NOTES = [
  { title: "Mirëmëngjes ☀️", body: "Shpresojmë ta kesh nisur mirë ditën. Lajmet e tua të sotme të presin, të shkurtra e të qarta." },
  { title: "Mirëmëngjes, mik", body: "Kafeja e para, lajmet pas saj. Të kemi mbledhur gjithçka që ka rëndësi për ty sot." },
  { title: "Një mëngjes të mbarë ☕", body: "Ndërsa flije, ne i lexuam lajmet për ty. Disa minuta dhe je në dijeni për gjithçka." },
  { title: "Mirëmëngjes nga 383", body: "Gazeta jote e sotme është gati. Merre me qetësi, të pret sa herë të duash." },
];
export const MORNING_NOTE = { ...MORNING_NOTES[0], url: "/per-ty" };
const MAX_HEADLINE = 90;

/**
 * Today's note. With the day's must-know headline (lib/per-ty-must-know), the
 * body leads with it: the same story for every reader, so still nothing
 * personal travels. The tap opens Për ty.
 *
 * @param {{ headline?: string | null, date?: string }} [opts]  date: Kosovo "YYYY-MM-DD", picks the day's greeting
 */
export function morningNote(opts = {}) {
  const date = typeof opts?.date === "string" ? opts.date : "";
  const day = [...date].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const base = MORNING_NOTES[day % MORNING_NOTES.length];
  let headline = noDashes(String(opts?.headline ?? "").replace(/\s+/g, " ")).replace(/[.!…:]+$/, "");
  if (headline.length > MAX_HEADLINE) headline = `${headline.slice(0, MAX_HEADLINE - 1).replace(/\s+\S*$/, "")}…`;
  if (!headline) return { ...base, url: "/per-ty" };
  return { title: base.title, body: `Lajmi i ditës: ${headline}. Pjesën tjetër ta kemi ruajtur te gazeta jote.`, url: "/per-ty" };
}

/** The push services of Chrome/Android, Firefox, Safari/iPhone and Edge. */
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

/** A browser push address we will store, or null. */
export function validEndpoint(raw) {
  if (typeof raw !== "string" || raw.length > 1000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !PUSH_HOSTS.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** The hour and date in Kosovo. */
export function kosovoNow(now = new Date()) {
  const fmt = (opts) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", ...opts }).format(now);
  return {
    hour: Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(now)),
    date: fmt({ year: "numeric", month: "2-digit", day: "2-digit" }),
  };
}

/**
 * Whether the morning push should go out now. The whole 07:00 hour counts, so
 * a missed heartbeat at 07:00 still sends at 07:02; the per-day claim in the
 * database keeps it to once.
 */
export function isMorningWindow(now = new Date()) {
  return kosovoNow(now).hour === MORNING_HOUR;
}

/** Was this browser sent its morning edition recently enough to be this push? */
export function isRecentSend(lastSentAt, now = new Date()) {
  const t = Date.parse(lastSentAt ?? "");
  return Number.isFinite(t) && now.getTime() - t >= 0 && now.getTime() - t < RECENT_MS;
}
