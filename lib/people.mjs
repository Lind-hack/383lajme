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
//   "Meta"      is the company                            → full name only
//   "Musk"      as a stem reaches "muskujt" (muscles)     → declined forms only
//   "Skënderaj" is a town, "Ara" and "Cook" are words     → full name only
//   "Berisha", "Haradinaj", "Ismaili", "Murati"
//               are shared by more than one public figure → full name only
//
// Përparim Rama is deliberately absent: "Rama" already means Edi Rama above,
// so his stories would be credited to both.
//
// Groups are the site's seven sections, so onboarding can put the people of
// the sections a reader picked first.
//
// Full-name phrases do not decline on their own, so the inflected phrase is
// listed next to it ("Majlinda Kelmendin", "Majlinda Kelmendit").

import { CURATED } from "./entities.mjs";

/** @typedef {{ id: string, name: string, group: string, match: string[] }} Person */

/** Which section each curated politician belongs to. */
const CURATED_GROUP = {
  "albin-kurti": "Kosovë",
  "vjosa-osmani": "Kosovë",
  "edi-rama": "Shqipëri",
  "bajram-begaj": "Shqipëri",
  "aleksandar-vucic": "Botë",
};

const POLITICIANS = CURATED.filter((e) => e.kind === "person").map((e) => ({
  id: e.id,
  name: e.name,
  group: CURATED_GROUP[e.id] ?? "Botë",
  match: e.match ?? [],
}));

/** @type {Person[]} */
const OTHERS = [
  // Kosovë
  { id: "memli-krasniqi", name: "Memli Krasniqi", group: "Kosovë", match: ["Memli Krasniqi", "Memli Krasniqin", "Memli Krasniqit"] },
  { id: "lumir-abdixhiku", name: "Lumir Abdixhiku", group: "Kosovë", match: ["Lumir Abdixhiku", "Abdixhiku"] },
  { id: "ramush-haradinaj", name: "Ramush Haradinaj", group: "Kosovë", match: ["Ramush Haradinaj", "Ramush Haradinajn", "Ramush Haradinajt"] },
  { id: "glauk-konjufca", name: "Glauk Konjufca", group: "Kosovë", match: ["Glauk Konjufca", "Konjufca"] },
  { id: "donika-gervalla", name: "Donika Gërvalla", group: "Kosovë", match: ["Donika Gërvalla", "Gërvalla", "Gervalla"] },
  { id: "bedri-hamza", name: "Bedri Hamza", group: "Kosovë", match: ["Bedri Hamza", "Bedri Hamzës", "Bedri Hamzën"] },
  // Shqipëri
  { id: "sali-berisha", name: "Sali Berisha", group: "Shqipëri", match: ["Sali Berisha", "Sali Berishës", "Sali Berishën"] },
  { id: "erion-veliaj", name: "Erion Veliaj", group: "Shqipëri", match: ["Erion Veliaj", "Veliaj"] },
  { id: "ilir-meta", name: "Ilir Meta", group: "Shqipëri", match: ["Ilir Meta", "Ilir Metës", "Ilir Metën"] },
  { id: "gazmend-bardhi", name: "Gazmend Bardhi", group: "Shqipëri", match: ["Gazmend Bardhi", "Gazmend Bardhit", "Gazmend Bardhin"] },
  // Sport
  { id: "majlinda-kelmendi", name: "Majlinda Kelmendi", group: "Sport", match: ["Majlinda Kelmendi", "Majlinda Kelmendin", "Majlinda Kelmendit"] },
  { id: "nora-gjakova", name: "Nora Gjakova", group: "Sport", match: ["Nora Gjakova", "Nora Gjakovën", "Nora Gjakovës"] },
  { id: "distria-krasniqi", name: "Distria Krasniqi", group: "Sport", match: ["Distria Krasniqi", "Distria Krasniqin", "Distria Krasniqit"] },
  { id: "vedat-muriqi", name: "Vedat Muriqi", group: "Sport", match: ["Vedat Muriqi", "Muriqi"] },
  { id: "milot-rashica", name: "Milot Rashica", group: "Sport", match: ["Milot Rashica", "Rashica"] },
  { id: "granit-xhaka", name: "Granit Xhaka", group: "Sport", match: ["Granit Xhaka", "Granit Xhakës", "Granit Xhakën"] },
  { id: "armando-broja", name: "Armando Broja", group: "Sport", match: ["Armando Broja", "Broja"] },
  { id: "kristjan-asllani", name: "Kristjan Asllani", group: "Sport", match: ["Kristjan Asllani", "Kristjan Asllanin", "Kristjan Asllanit"] },
  // Teknologji
  { id: "elon-musk", name: "Elon Musk", group: "Teknologji", match: ["Elon Musk", "Elon Muskut", "Elon Muskun", "Muskut", "Muskun"] },
  { id: "mira-murati", name: "Mira Murati", group: "Teknologji", match: ["Mira Murati", "Mira Muratin", "Mira Muratit"] },
  { id: "sam-altman", name: "Sam Altman", group: "Teknologji", match: ["Sam Altman", "Altman"] },
  { id: "mark-zuckerberg", name: "Mark Zuckerberg", group: "Teknologji", match: ["Mark Zuckerberg", "Zuckerberg"] },
  { id: "jensen-huang", name: "Jensen Huang", group: "Teknologji", match: ["Jensen Huang", "Jensen Huangut"] },
  { id: "tim-cook", name: "Tim Cook", group: "Teknologji", match: ["Tim Cook", "Tim Cookut"] },
  { id: "sundar-pichai", name: "Sundar Pichai", group: "Teknologji", match: ["Sundar Pichai", "Pichai"] },
  // Ekonomi
  { id: "hekuran-murati", name: "Hekuran Murati", group: "Ekonomi", match: ["Hekuran Murati", "Hekuran Muratin", "Hekuran Muratit"] },
  { id: "ahmet-ismaili", name: "Ahmet Ismaili", group: "Ekonomi", match: ["Ahmet Ismaili", "Ahmet Ismailin", "Ahmet Ismailit"] },
  { id: "gent-sejko", name: "Gent Sejko", group: "Ekonomi", match: ["Gent Sejko", "Sejko"] },
  { id: "christine-lagarde", name: "Christine Lagarde", group: "Ekonomi", match: ["Christine Lagarde", "Lagarde"] },
  { id: "kristalina-georgieva", name: "Kristalina Georgieva", group: "Ekonomi", match: ["Kristalina Georgieva", "Georgieva"] },
  { id: "warren-buffett", name: "Warren Buffett", group: "Ekonomi", match: ["Warren Buffett", "Buffett"] },
  // Botë
  { id: "donald-trump", name: "Donald Trump", group: "Botë", match: ["Donald Trump", "Trump"] },
  { id: "ursula-von-der-leyen", name: "Ursula von der Leyen", group: "Botë", match: ["Ursula von der Leyen", "von der Leyen"] },
  { id: "emmanuel-macron", name: "Emmanuel Macron", group: "Botë", match: ["Emmanuel Macron", "Macron"] },
  { id: "volodymyr-zelensky", name: "Volodymyr Zelensky", group: "Botë", match: ["Volodymyr Zelensky", "Zelensky", "Zelenski", "Zelenskyy"] },
  { id: "vladimir-putin", name: "Vladimir Putin", group: "Botë", match: ["Vladimir Putin", "Putin"] },
  { id: "friedrich-merz", name: "Friedrich Merz", group: "Botë", match: ["Friedrich Merz", "Merz"] },
  { id: "recep-tayyip-erdogan", name: "Recep Tayyip Erdoğan", group: "Botë", match: ["Recep Tayyip Erdoğan", "Erdoğan", "Erdogan"] },
  // Showbiz
  { id: "dua-lipa", name: "Dua Lipa", group: "Showbiz", match: ["Dua Lipa", "Dua Lipës", "Dua Lipën"] },
  { id: "rita-ora", name: "Rita Ora", group: "Showbiz", match: ["Rita Ora", "Rita Orës", "Rita Orën"] },
  { id: "bebe-rexha", name: "Bebe Rexha", group: "Showbiz", match: ["Bebe Rexha", "Bebe Rexhës", "Bebe Rexhën"] },
  { id: "era-istrefi", name: "Era Istrefi", group: "Showbiz", match: ["Era Istrefi", "Istrefi"] },
  { id: "elvana-gjata", name: "Elvana Gjata", group: "Showbiz", match: ["Elvana Gjata", "Elvana Gjatës", "Elvana Gjatën"] },
  { id: "ava-max", name: "Ava Max", group: "Showbiz", match: ["Ava Max", "Ava Maxit"] },
  { id: "alban-skenderaj", name: "Alban Skënderaj", group: "Showbiz", match: ["Alban Skënderaj", "Alban Skënderajt"] },
  { id: "arilena-ara", name: "Arilena Ara", group: "Showbiz", match: ["Arilena Ara", "Arilena Arës", "Arilena Arën"] },
];

/** Every followable person. */
export const PEOPLE = [...POLITICIANS, ...OTHERS];

/** Display order of the groups in onboarding: the site's sections, in nav order. */
export const PEOPLE_GROUPS = ["Kosovë", "Shqipëri", "Sport", "Teknologji", "Ekonomi", "Botë", "Showbiz"];

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
