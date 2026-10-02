// The reader's ledger: a quiet monthly tally of their time with 383, kept on
// the device only.
//
// It is the foundation of "Gazeta jote" (docs/ideas/gazeta-jote.md): the issue
// number on the masthead ("Nr. 47" — the 47th day with 383), Dardani's "mungove
// 3 ditë", and the monthly and yearly wrapped ("Muaji yt me 383", "Viti yt me
// 383"). A wrapped can only show what was recorded, so this records from now.
//
// Per month (Kosovo's calendar, not the reader's clock) it keeps:
//
//   visitDays   which days of the month the reader came
//   readIds     a short hash of each story read, so a story counts once a month
//   readHours   reads by hour of day, for "ti je lexues i mëngjesit"
//   people, cities, categories   reads by what the story was about
//   questions   how many questions they asked Dardani (the questions themselves
//               are Dardani's memory, lib/dardani-memory.mjs, not this)
//
// No titles, no slugs in clear, no text the reader typed. Everything read back
// is untrusted and everything is bounded, like the rest of Për ty's storage.

export const LEDGER_KEY = "383:ledger";
export const LEDGER_VERSION = 1;
/** Two years and a month: enough for this year's and last year's wrapped. */
export const MAX_MONTHS = 25;
/** Per month and per kind: the most-read survive, the long tail is dropped. */
export const MAX_KEYS = 60;
/** Nobody reads this many distinct stories in a month; it only bounds storage. */
const MAX_READS = 1500;

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KIND = { cat: "categories", person: "people", city: "cities" };

export function emptyLedger() {
  return { v: LEDGER_VERSION, firstSeen: null, months: {} };
}

function emptyMonth() {
  return {
    visitDays: [],
    readIds: [],
    reads: 0,
    readHours: Array(24).fill(0),
    people: {},
    cities: {},
    categories: {},
    questions: 0,
  };
}

const count = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Keep valid keys with positive counts; past MAX_KEYS, the highest counts win. */
function normalizeCounts(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = [];
  for (const [key, value] of Object.entries(raw)) {
    const n = count(value);
    if (key && key.length <= 80 && n > 0) entries.push([key, n]);
  }
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_KEYS));
}

function normalizeMonth(raw) {
  const m = emptyMonth();
  if (!raw || typeof raw !== "object") return m;
  m.visitDays = [
    ...new Set((Array.isArray(raw.visitDays) ? raw.visitDays : []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 31)),
  ].sort((a, b) => a - b);
  m.readIds = [
    ...new Set((Array.isArray(raw.readIds) ? raw.readIds : []).filter((id) => typeof id === "string" && /^[a-z0-9]{1,8}$/.test(id))),
  ].slice(-MAX_READS);
  m.reads = m.readIds.length;
  const hours = Array.isArray(raw.readHours) ? raw.readHours : [];
  m.readHours = m.readHours.map((_, h) => count(hours[h]));
  m.people = normalizeCounts(raw.people);
  m.cities = normalizeCounts(raw.cities);
  m.categories = normalizeCounts(raw.categories);
  m.questions = count(raw.questions);
  return m;
}

/** Coerce anything at all into a valid ledger. Unknown versions start over. */
export function normalizeLedger(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== LEDGER_VERSION) return emptyLedger();
  if (!raw.months || typeof raw.months !== "object" || Array.isArray(raw.months)) return emptyLedger();
  const keys = Object.keys(raw.months).filter((k) => MONTH_KEY.test(k)).sort().slice(-MAX_MONTHS);
  const months = {};
  for (const key of keys) months[key] = normalizeMonth(raw.months[key]);
  return {
    v: LEDGER_VERSION,
    firstSeen: typeof raw.firstSeen === "string" && DAY_DATE.test(raw.firstSeen) ? raw.firstSeen : null,
    months,
  };
}

/** The month, day, hour and date in Kosovo at `now`. */
export function kosovoParts(now = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Belgrade",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value])
  );
  const month = `${parts.year}-${parts.month}`;
  return { month, day: Number(parts.day), hour: Number(parts.hour), date: `${month}-${parts.day}` };
}

/** FNV-1a, base 36: enough to tell a month's stories apart, not to recover them. */
function readId(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function withMonth(ledger, now, change) {
  const l = normalizeLedger(ledger);
  const { month, day, date } = kosovoParts(now);
  const m = l.months[month] ?? emptyMonth();
  if (!m.visitDays.includes(day)) m.visitDays = [...m.visitDays, day].sort((a, b) => a - b);
  change(m);
  l.months[month] = m;
  if (!l.firstSeen) l.firstSeen = date;
  return normalizeLedger(l);
}

/** The reader was here today. */
export function recordVisit(ledger, now = Date.now()) {
  return withMonth(ledger, now, () => {});
}

/**
 * The reader read `slug`. `keys` are lib/per-ty-rank.mjs articleKeys():
 * "cat:Kosovë", "person:albin-kurti", "city:prishtine". A story already read
 * this month changes nothing.
 */
export function recordRead(ledger, slug, keys, now = Date.now()) {
  if (typeof slug !== "string" || !slug) return recordVisit(ledger, now);
  const { hour } = kosovoParts(now);
  return withMonth(ledger, now, (m) => {
    const id = readId(slug);
    if (m.readIds.includes(id)) return;
    m.readIds = [...m.readIds, id];
    m.readHours[hour] += 1;
    for (const key of Array.isArray(keys) ? keys : []) {
      if (typeof key !== "string") continue;
      const at = key.indexOf(":");
      const kind = KIND[key.slice(0, at)];
      const value = key.slice(at + 1);
      if (!kind || !value) continue;
      m[kind] = { ...m[kind], [value]: (m[kind][value] ?? 0) + 1 };
    }
  });
}

/** The reader asked Dardani something. Only the count is kept here. */
export function recordQuestion(ledger, now = Date.now()) {
  return withMonth(ledger, now, (m) => {
    m.questions += 1;
  });
}

function visitDates(ledger) {
  const l = normalizeLedger(ledger);
  const dates = [];
  for (const [month, m] of Object.entries(l.months)) {
    for (const d of m.visitDays) dates.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return dates.sort();
}

/** How many days the reader has come to 383 — the issue number of their paper. */
export function daysWithUs(ledger) {
  return visitDates(ledger).length;
}

/** The most days in a row the reader came, across month boundaries. */
export function longestStreak(ledger) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const date of visitDates(ledger)) {
    const t = Date.parse(`${date}T00:00:00Z`);
    run = prev !== null && t - prev === 86400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

const top = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

/**
 * What a wrapped card needs, over the months `from`..`to` ("2026-01".."2026-12").
 * `beforeNine` is the share of reads before 09:00, or null when there were no
 * reads — a card says nothing rather than "0% of nothing".
 */
export function summarize(ledger, { from, to }) {
  const l = normalizeLedger(ledger);
  const out = { reads: 0, questions: 0, days: 0, people: {}, cities: {}, categories: {} };
  const hours = Array(24).fill(0);
  for (const [month, m] of Object.entries(l.months)) {
    if (month < from || month > to) continue;
    out.reads += m.reads;
    out.questions += m.questions;
    out.days += m.visitDays.length;
    m.readHours.forEach((n, h) => (hours[h] += n));
    for (const kind of ["people", "cities", "categories"]) {
      for (const [key, n] of Object.entries(m[kind])) out[kind][key] = (out[kind][key] ?? 0) + n;
    }
  }
  const morning = hours.slice(0, 9).reduce((a, b) => a + b, 0);
  return {
    reads: out.reads,
    questions: out.questions,
    days: out.days,
    topPeople: top(out.people),
    topCities: top(out.cities),
    topCategories: top(out.categories),
    readHours: hours,
    beforeNine: out.reads > 0 ? morning / out.reads : null,
  };
}

// ── On the device ──────────────────────────────────────────────────────────
// Every storage call is wrapped: a browser that refuses storage still gets a
// working site, its ledger is just empty.

function store() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLedger() {
  try {
    return normalizeLedger(JSON.parse(store()?.getItem(LEDGER_KEY) ?? "null"));
  } catch {
    return emptyLedger();
  }
}

function update(change) {
  try {
    store()?.setItem(LEDGER_KEY, JSON.stringify(change(readLedger())));
  } catch {
    // Not recorded; nothing on the page depends on it.
  }
}

export const noteVisit = (now = Date.now()) => update((l) => recordVisit(l, now));
export const noteRead = (slug, keys, now = Date.now()) => update((l) => recordRead(l, slug, keys, now));
export const noteQuestion = (now = Date.now()) => update((l) => recordQuestion(l, now));

/** Forget it all, alongside "Harro historikun e leximit". */
export function forgetLedger() {
  try {
    store()?.removeItem(LEDGER_KEY);
  } catch {
    // Nothing stored where storage is blocked.
  }
}
