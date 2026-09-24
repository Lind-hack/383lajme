// The places a reader can say they are from, for "Për ty".
//
// An article matches a city two ways, in order of trust:
//
//   1. its `city` field, set by the newsroom pipeline — authoritative, but most
//      stored articles do not have one yet;
//   2. the city named in its headline or summary.
//
// The second is what makes a local feed work at all today, so every city lists
// the spellings a headline actually uses. Albanian declines place names —
// Prishtinë, Prishtina, Prishtinës, Prishtinën — and lib/entities.mjs'
// wordMatchesForm() already handles those endings, so the forms here only need
// the base spellings plus anything the declension rule cannot reach.
//
// `from` is the label a feed item shows ("Nga Prizreni"). It is written out,
// not built from the name, because the definite form is irregular.

export const CITIES = [
  { id: "prishtine", name: "Prishtinë", from: "Nga Prishtina", forms: ["Prishtinë", "Prishtina", "Pristina"] },
  { id: "prizren", name: "Prizren", from: "Nga Prizreni", forms: ["Prizren", "Prizreni"] },
  { id: "peje", name: "Pejë", from: "Nga Peja", forms: ["Pejë", "Peja"] },
  { id: "gjakove", name: "Gjakovë", from: "Nga Gjakova", forms: ["Gjakovë", "Gjakova"] },
  { id: "mitrovice", name: "Mitrovicë", from: "Nga Mitrovica", forms: ["Mitrovicë", "Mitrovica"] },
  { id: "ferizaj", name: "Ferizaj", from: "Nga Ferizaji", forms: ["Ferizaj", "Ferizaji"] },
  { id: "gjilan", name: "Gjilan", from: "Nga Gjilani", forms: ["Gjilan", "Gjilani"] },
  { id: "podujeve", name: "Podujevë", from: "Nga Podujeva", forms: ["Podujevë", "Podujeva"] },
  { id: "vushtrri", name: "Vushtrri", from: "Nga Vushtrria", forms: ["Vushtrri", "Vushtrria"] },
  { id: "suhareke", name: "Suharekë", from: "Nga Suhareka", forms: ["Suharekë", "Suhareka"] },
  { id: "lipjan", name: "Lipjan", from: "Nga Lipjani", forms: ["Lipjan", "Lipjani"] },
  { id: "drenas", name: "Drenas", from: "Nga Drenasi", forms: ["Drenas", "Drenasi", "Gllogoc"] },
  { id: "rahovec", name: "Rahovec", from: "Nga Rahoveci", forms: ["Rahovec", "Rahoveci"] },
  { id: "fushe-kosove", name: "Fushë Kosovë", from: "Nga Fushë Kosova", forms: ["Fushë Kosovë", "Fushë Kosova", "Fushë Kosovës"] },
  { id: "kamenice", name: "Kamenicë", from: "Nga Kamenica", forms: ["Kamenicë", "Kamenica"] },
  { id: "decan", name: "Deçan", from: "Nga Deçani", forms: ["Deçan", "Deçani"] },
  { id: "istog", name: "Istog", from: "Nga Istogu", forms: ["Istog", "Istogu"] },
  { id: "malisheve", name: "Malishevë", from: "Nga Malisheva", forms: ["Malishevë", "Malisheva"] },
  { id: "skenderaj", name: "Skenderaj", from: "Nga Skenderaji", forms: ["Skenderaj", "Skenderaji"] },
  { id: "kacanik", name: "Kaçanik", from: "Nga Kaçaniku", forms: ["Kaçanik", "Kaçaniku"] },
  { id: "tirane", name: "Tiranë", from: "Nga Tirana", forms: ["Tiranë", "Tirana"] },
  { id: "shkup", name: "Shkup", from: "Nga Shkupi", forms: ["Shkup", "Shkupi"] },
  { id: "diaspora", name: "Diaspora", from: "Për diasporën", forms: ["diasporë", "diaspora", "mërgatë", "mërgata"] },
];

const BY_ID = new Map(CITIES.map((c) => [c.id, c]));

/** @param {unknown} id */
export function cityById(id) {
  return typeof id === "string" ? BY_ID.get(id) ?? null : null;
}

/** @param {unknown} id */
export function isCityId(id) {
  return typeof id === "string" && BY_ID.has(id);
}
