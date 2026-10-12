// What kind of newspaper the reader's paper is — chosen by what they read.
//
// Every reader gets one of five papers, each with its own nameplate, type and
// spot colour (app/per-ty/paper/newspaper.css):
//
//   e-perditshme  a serious broadsheet        Kosovë, Shqipëri
//   sporti        a bold sports sheet         Sport
//   tabloid       a loud tabloid              Showbiz
//   bota          an international edition    Botë
//   biznes        a business paper            Ekonomi, Teknologji
//
// The mix is weighed from three things the device already knows: what the
// reader picked in onboarding (a pick is worth PICK_POINTS), what reading
// taught us (the decayed affinity weight) and the minutes they actually spent
// (lib/reading-engagement.mjs → the `s` tally). People count for their own
// section (lib/people.mjs `group`); towns count for Kosovë.
//
// Promises, held by the tests:
//
//   1. A new reader's paper is decided by their picks the moment onboarding
//      ends — nothing to set.
//   2. It does not flicker. Once chosen, the paper changes only when another
//      kind leads by SWITCH_MARGIN of the mix AND the current one has stood for
//      at least MIN_STAND_MS. When it does change, it says so, with the share.
//   3. A reader who picks a look themselves keeps it ("locked").
//   4. Stored state is untrusted: junk in, a valid look out.
//
// Also here: the edition's name from the hours the reader reads at, and how
// long the excerpts should be from how long they stay on a story.

import { normalizeInterests, readingStats } from "./interests.mjs";
import { personById } from "./people.mjs";
import { isCityId } from "./cities.mjs";

export const LOOK_KEY = "383:paper-look";

/** @typedef {"e-perditshme" | "sporti" | "tabloid" | "bota" | "biznes"} LookId */

/** @type {readonly { id: LookId, name: string, about: string, motto: string, cats: readonly string[] }[]} */
export const LOOKS = [
  { id: "e-perditshme", name: "E përditshme", about: "gazetë serioze e përditshme, e qetë dhe e qartë", motto: "Lajmet që të duhen, pa zhurmë", cats: ["Kosovë", "Shqipëri"] },
  { id: "sporti", name: "Sporti", about: "gazetë sporti, me tituj të mëdhenj", motto: "Ndeshja, rezultati, lojtari — për ty", cats: ["Sport"] },
  { id: "tabloid", name: "Tabloid", about: "tabloid i zhurmshëm, me ngjyra", motto: "Çka po flitet sot", cats: ["Showbiz"] },
  { id: "bota", name: "Bota", about: "botim ndërkombëtar", motto: "Bota, e parë nga Kosova", cats: ["Botë"] },
  { id: "biznes", name: "Biznes", about: "gazetë biznesi, në letër rozë", motto: "Paraja, puna dhe e ardhmja", cats: ["Ekonomi", "Teknologji"] },
];
export const LOOK_IDS = LOOKS.map((l) => l.id);

/** A pick from onboarding: worth about two full reads (FULL_WEIGHT 1.8 each). */
export const PICK_POINTS = 3;
/** Engaged minutes add this much per minute on top of the read weight. */
const MINUTE_POINTS = 0.2;
/** Another kind must lead the current one by this much of the mix to take over. */
export const SWITCH_MARGIN = 0.15;
/** …and the current paper must have stood this long. */
export const MIN_STAND_MS = 7 * 24 * 60 * 60 * 1000;

const lookOf = (cat) => LOOKS.find((l) => l.cats.includes(cat))?.id ?? null;

export function lookById(id) {
  return LOOKS.find((l) => l.id === id) ?? null;
}

/**
 * Each kind's share of the reader's attention, 0..1, summing to 1 (or all 0
 * for a reader with nothing yet).
 *
 * @param {unknown} rawInterests
 * @returns {Record<LookId, number>}
 */
export function readingMix(rawInterests, now = Date.now()) {
  const interests = normalizeInterests(rawInterests);
  const points = Object.fromEntries(LOOK_IDS.map((id) => [id, 0]));
  const add = (cat, n) => {
    const id = lookOf(cat);
    if (id && Number.isFinite(n) && n > 0) points[id] += n;
  };

  for (const cat of interests.categories) add(cat, PICK_POINTS);
  for (const id of interests.people) add(personById(id)?.group, PICK_POINTS);
  for (const id of interests.cities) if (id !== "diaspora") add("Kosovë", PICK_POINTS / 2);

  for (const key of Object.keys(interests.affinity)) {
    const stats = readingStats(interests.affinity, key, now);
    const value = stats.weight + stats.minutes * MINUTE_POINTS;
    const at = key.indexOf(":");
    const kind = key.slice(0, at);
    const id = key.slice(at + 1);
    if (kind === "cat") add(id, value);
    else if (kind === "person") add(personById(id)?.group, value / 2);
    else if (kind === "city" && isCityId(id) && id !== "diaspora") add("Kosovë", value / 2);
  }

  const total = Object.values(points).reduce((a, b) => a + b, 0);
  return /** @type {Record<LookId, number>} */ (
    Object.fromEntries(LOOK_IDS.map((id) => [id, total > 0 ? points[id] / total : 0]))
  );
}

/** Coerce stored look state into something usable, or null. */
export function normalizeLookState(raw) {
  if (!raw || typeof raw !== "object" || !LOOK_IDS.includes(raw.look)) return null;
  const since = typeof raw.since === "string" && Number.isFinite(Date.parse(raw.since)) ? raw.since : null;
  return { look: raw.look, since: since ?? new Date(0).toISOString() };
}

/**
 * The paper the reader gets today.
 *
 * @param {Record<string, number>} mix         readingMix()
 * @param {unknown} stored                      the last state (untrusted)
 * @param {{ locked?: string | null, now?: number }} [opts]  locked: a look the reader chose
 * @returns {{ look: LookId, state: { look: LookId, since: string } | null,
 *   changed: null | { from: LookId, to: LookId, share: number } }}
 */
export function resolveLook(mix, stored, opts = {}) {
  const now = opts.now ?? Date.now();
  const state = normalizeLookState(stored);
  if (opts.locked && LOOK_IDS.includes(opts.locked)) {
    return { look: /** @type {LookId} */ (opts.locked), state, changed: null };
  }

  const share = (id) => (Number.isFinite(mix?.[id]) ? mix[id] : 0);
  // Ties go to the first in LOOKS: the broadsheet is 383's own voice.
  let leader = LOOK_IDS[0];
  for (const id of LOOK_IDS) if (share(id) > share(leader)) leader = id;
  const stamp = new Date(now).toISOString();

  if (!state) return { look: leader, state: { look: leader, since: stamp }, changed: null };
  if (leader === state.look) return { look: state.look, state, changed: null };

  const stood = now - Date.parse(state.since) >= MIN_STAND_MS;
  if (stood && share(leader) - share(state.look) >= SWITCH_MARGIN) {
    return {
      look: leader,
      state: { look: leader, since: stamp },
      changed: { from: state.look, to: leader, share: Math.round(share(leader) * 100) },
    };
  }
  return { look: state.look, state, changed: null };
}

/**
 * "Botimi i mëngjesit" or "Botimi i mbrëmjes": when this reader usually reads,
 * from the ledger's reads-by-hour (lib/reader-ledger.mjs, Kosovo hours).
 * Morning until there is a real pattern.
 *
 * @param {unknown} ledger  the stored ledger, already normalised by its module
 */
export function editionName(ledger) {
  let morning = 0;
  let evening = 0;
  const months = ledger && typeof ledger === "object" ? Object.values(ledger.months ?? {}).slice(-2) : [];
  for (const month of months) {
    const hours = Array.isArray(month?.readHours) ? month.readHours : [];
    hours.forEach((n, h) => {
      const c = Number.isFinite(n) && n > 0 ? n : 0;
      if (h >= 15 || h < 4) evening += c;
      else morning += c;
    });
  }
  return morning + evening >= 6 && evening > morning * 1.2 ? "Botimi i mbrëmjes" : "Botimi i mëngjesit";
}

/**
 * How long this reader stays on a story, from the engaged-seconds and reads
 * tallies on their topic keys (every story has exactly one topic, so each read
 * lands on one cat: key once).
 *
 * @returns {"short" | "medium" | "long"} short: headlines; long: full excerpts
 */
export function readingPace(rawInterests, now = Date.now()) {
  const interests = normalizeInterests(rawInterests);
  let seconds = 0;
  let reads = 0;
  for (const key of Object.keys(interests.affinity)) {
    if (!key.startsWith("cat:")) continue;
    const stats = readingStats(interests.affinity, key, now);
    seconds += stats.minutes * 60;
    reads += stats.reads;
  }
  if (reads < 3) return "medium";
  const perRead = seconds / reads;
  if (perRead >= 75) return "long";
  if (perRead < 35) return "short";
  return "medium";
}

/** @param {Storage} [storage] */
export function readLookState(storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    return normalizeLookState(JSON.parse(store?.getItem(LOOK_KEY) ?? "null"));
  } catch {
    return null;
  }
}

/** @param {Storage} [storage] */
export function writeLookState(state, storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    const clean = normalizeLookState(state);
    if (clean) store.setItem(LOOK_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}
