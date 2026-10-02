// The rules of the morning push, kept apart from the database so they can be
// tested: when it goes out, which push addresses are accepted, and what the
// notification says.
//
// The push carries nothing personal. It wakes the site's service worker
// (public/tregu-sw.js), which asks /api/per-ty/push/latest whether this browser
// was just sent its morning edition, and if so shows the note below. The seven
// stories are put together on the device when the reader opens Për ty.

export const MORNING_HOUR = 7;
/** How long after sending the worker still recognises the push as the morning one. */
export const RECENT_MS = 30 * 60 * 1000;

export const MORNING_NOTE = {
  title: "Edicioni yt i mëngjesit është gati",
  body: "Shtatë lajme për ty, për kafen e mëngjesit. Dardani i ka zgjedhur.",
  url: "/per-ty",
};

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
