// The people a reader can follow in "Për ty".
//
// Politicians come from lib/entities.mjs CURATED, so search and the personal
// feed share one definition of who "Kurti" is. Sport and showbiz names live
// here instead of in CURATED: adding them there would change what Kërko
// answers, which is a separate decision.
//
// EDITORIAL DATA — the list and every spelling below need an editor's check.
//
// How `match` is written, and why it is uneven. lib/entities.mjs mentions()
// treats a single word as a stem that may take a short Albanian ending
// ("Xhaka" also finds "Xhakës"), and a multi-word form as an exact phrase.
// A lone surname is therefore only listed when it cannot mean anything else:
//
//   "Ora"       is the Albanian word for "hour"          → full name only
//   "Lipa"      as a stem reaches "Lipjan"                → full name only
//   "Kelmendi", "Krasniqi", "Asllani", "Hamza"
//               are common surnames in Kosovo             → full name only
//   "Gjakova"   is a city                                 → full name only
//   "Xhaka"     as a stem reaches "xhaketa" (jacket)      → full name only
//   "Rexha"     as a stem reaches the name "Rexhep"       → full name only
//
// Full-name phrases do not decline on their own, so the inflected phrase is
// listed next to it ("Majlinda Kelmendin", "Majlinda Kelmendit").

import { CURATED } from "./entities.mjs";

/** @typedef {{ id: string, name: string, group: string, match: string[] }} Person */

const POLITICIANS = CURATED.filter((e) => e.kind === "person").map((e) => ({
  id: e.id,
  name: e.name,
  group: "Politikë",
  match: e.match ?? [],
}));

/** @type {Person[]} */
const OTHERS = [
  // Sport
  { id: "majlinda-kelmendi", name: "Majlinda Kelmendi", group: "Sport", match: ["Majlinda Kelmendi", "Majlinda Kelmendin", "Majlinda Kelmendit"] },
  { id: "nora-gjakova", name: "Nora Gjakova", group: "Sport", match: ["Nora Gjakova", "Nora Gjakovën", "Nora Gjakovës"] },
  { id: "distria-krasniqi", name: "Distria Krasniqi", group: "Sport", match: ["Distria Krasniqi", "Distria Krasniqin", "Distria Krasniqit"] },
  { id: "vedat-muriqi", name: "Vedat Muriqi", group: "Sport", match: ["Vedat Muriqi", "Muriqi"] },
  { id: "milot-rashica", name: "Milot Rashica", group: "Sport", match: ["Milot Rashica", "Rashica"] },
  { id: "granit-xhaka", name: "Granit Xhaka", group: "Sport", match: ["Granit Xhaka", "Granit Xhakës", "Granit Xhakën"] },
  { id: "armando-broja", name: "Armando Broja", group: "Sport", match: ["Armando Broja", "Broja"] },
  { id: "kristjan-asllani", name: "Kristjan Asllani", group: "Sport", match: ["Kristjan Asllani", "Kristjan Asllanin", "Kristjan Asllanit"] },
  // Showbiz
  { id: "dua-lipa", name: "Dua Lipa", group: "Showbiz", match: ["Dua Lipa", "Dua Lipës", "Dua Lipën"] },
  { id: "rita-ora", name: "Rita Ora", group: "Showbiz", match: ["Rita Ora", "Rita Orës", "Rita Orën"] },
  { id: "bebe-rexha", name: "Bebe Rexha", group: "Showbiz", match: ["Bebe Rexha", "Bebe Rexhës", "Bebe Rexhën"] },
  { id: "era-istrefi", name: "Era Istrefi", group: "Showbiz", match: ["Era Istrefi", "Istrefi"] },
  { id: "elvana-gjata", name: "Elvana Gjata", group: "Showbiz", match: ["Elvana Gjata", "Elvana Gjatës", "Elvana Gjatën"] },
];

/** Every followable person, politicians first. */
export const PEOPLE = [...POLITICIANS, ...OTHERS];

/** Display order of the groups in onboarding. */
export const PEOPLE_GROUPS = ["Politikë", "Sport", "Showbiz"];

const BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));

/**
 * A reader can also follow someone found through search who is not on the list.
 * Those are stored as "derived:<Full Name>" and matched on the full name only —
 * a lone surname from an arbitrary headline is exactly the ambiguity the list
 * above avoids.
 */
const DERIVED = /^derived:([\p{L}][\p{L} .'-]{2,58})$/u;

/** @param {unknown} id @returns {Person | null} */
export function personById(id) {
  if (typeof id !== "string") return null;
  const known = BY_ID.get(id);
  if (known) return known;
  const m = DERIVED.exec(id);
  if (!m) return null;
  const name = m[1].trim();
  // Two words at least: a single token is too ambiguous to follow.
  if (name.split(/\s+/).length < 2) return null;
  return { id, name, group: "Tjerë", match: [name] };
}

/** @param {unknown} id */
export function isPersonId(id) {
  return personById(id) !== null;
}

/** @param {string} name */
export function derivedPersonId(name) {
  return `derived:${String(name).trim().replace(/\s+/g, " ")}`;
}
