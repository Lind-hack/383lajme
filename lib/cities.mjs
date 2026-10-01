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
//
// `lat`/`lon` place the town for the home-city weather in Për ty. Diaspora is
// not a place, so it has none and gets the border waits instead.

export const CITIES = [
  { id: "prishtine", name: "Prishtinë", from: "Nga Prishtina", forms: ["Prishtinë", "Prishtina", "Pristina"], lat: 42.6629, lon: 21.1655 },
  { id: "prizren", name: "Prizren", from: "Nga Prizreni", forms: ["Prizren", "Prizreni"], lat: 42.2139, lon: 20.7397 },
  { id: "peje", name: "Pejë", from: "Nga Peja", forms: ["Pejë", "Peja"], lat: 42.6593, lon: 20.2887 },
  { id: "gjakove", name: "Gjakovë", from: "Nga Gjakova", forms: ["Gjakovë", "Gjakova"], lat: 42.3803, lon: 20.4308 },
  { id: "mitrovice", name: "Mitrovicë", from: "Nga Mitrovica", forms: ["Mitrovicë", "Mitrovica"], lat: 42.8914, lon: 20.866 },
  { id: "ferizaj", name: "Ferizaj", from: "Nga Ferizaji", forms: ["Ferizaj", "Ferizaji"], lat: 42.3702, lon: 21.1553 },
  { id: "gjilan", name: "Gjilan", from: "Nga Gjilani", forms: ["Gjilan", "Gjilani"], lat: 42.4635, lon: 21.4694 },
  { id: "podujeve", name: "Podujevë", from: "Nga Podujeva", forms: ["Podujevë", "Podujeva"], lat: 42.9106, lon: 21.1919 },
  { id: "vushtrri", name: "Vushtrri", from: "Nga Vushtrria", forms: ["Vushtrri", "Vushtrria"], lat: 42.8231, lon: 20.9675 },
  { id: "suhareke", name: "Suharekë", from: "Nga Suhareka", forms: ["Suharekë", "Suhareka"], lat: 42.358, lon: 20.825 },
  { id: "lipjan", name: "Lipjan", from: "Nga Lipjani", forms: ["Lipjan", "Lipjani"], lat: 42.5217, lon: 21.1258 },
  { id: "drenas", name: "Drenas", from: "Nga Drenasi", forms: ["Drenas", "Drenasi", "Gllogoc"], lat: 42.6253, lon: 20.8936 },
  { id: "rahovec", name: "Rahovec", from: "Nga Rahoveci", forms: ["Rahovec", "Rahoveci"], lat: 42.3994, lon: 20.6547 },
  { id: "fushe-kosove", name: "Fushë Kosovë", from: "Nga Fushë Kosova", forms: ["Fushë Kosovë", "Fushë Kosova", "Fushë Kosovës"], lat: 42.6381, lon: 21.0961 },
  { id: "kamenice", name: "Kamenicë", from: "Nga Kamenica", forms: ["Kamenicë", "Kamenica"], lat: 42.5781, lon: 21.5803 },
  { id: "decan", name: "Deçan", from: "Nga Deçani", forms: ["Deçan", "Deçani"], lat: 42.5403, lon: 20.2878 },
  { id: "istog", name: "Istog", from: "Nga Istogu", forms: ["Istog", "Istogu"], lat: 42.7808, lon: 20.4875 },
  { id: "malisheve", name: "Malishevë", from: "Nga Malisheva", forms: ["Malishevë", "Malisheva"], lat: 42.4828, lon: 20.7458 },
  { id: "skenderaj", name: "Skenderaj", from: "Nga Skenderaji", forms: ["Skenderaj", "Skenderaji"], lat: 42.7467, lon: 20.7886 },
  { id: "kacanik", name: "Kaçanik", from: "Nga Kaçaniku", forms: ["Kaçanik", "Kaçaniku"], lat: 42.2319, lon: 21.2592 },
  { id: "tirane", name: "Tiranë", from: "Nga Tirana", forms: ["Tiranë", "Tirana"], lat: 41.3275, lon: 19.8187 },
  { id: "shkup", name: "Shkup", from: "Nga Shkupi", forms: ["Shkup", "Shkupi"], lat: 41.9981, lon: 21.4254 },
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
