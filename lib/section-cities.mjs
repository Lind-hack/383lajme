// The cities a category page can be read by: Kosovë by its municipalities,
// Shqipëri by its main cities. Each one carries its emblem from
// public/images/cities (sources in that folder's README).
//
// The Kosovo entries reuse lib/cities.mjs — the ids, names and spellings Për ty
// already matches on — so a reader's home city means the same thing in both
// places. Albania's cities live only here: adding them to CITIES would put them
// in Për ty's "where are you from" picker, which is a different question.
//
// An article belongs to at most one city, matched in order of trust: the
// pipeline's own `city` field, then the first city its headline names, then
// the first one its summary names. A story about Prizren that mentions
// Prishtina in passing is a Prizren story.

import { CITIES } from "./cities.mjs";
import { surfaceForms, wordMatchesForm } from "./entities.mjs";
import { fold } from "./search-match.mjs";

const KOSOVO_IDS = [
  "prishtine", "prizren", "peje", "gjakove", "mitrovice", "ferizaj", "gjilan",
  "podujeve", "vushtrri", "suhareke", "lipjan", "drenas", "rahovec",
  "fushe-kosove", "kamenice", "decan", "istog", "malisheve", "skenderaj", "kacanik",
];

const ALBANIA = [
  { id: "tirane", name: "Tiranë", forms: ["Tiranë", "Tirana"] },
  { id: "durres", name: "Durrës", forms: ["Durrës", "Durrësi"] },
  { id: "shkoder", name: "Shkodër", forms: ["Shkodër", "Shkodra", "Shkodrës", "Shkodrën"] },
  { id: "vlore", name: "Vlorë", forms: ["Vlorë", "Vlora"] },
  { id: "elbasan", name: "Elbasan", forms: ["Elbasan", "Elbasani"] },
  { id: "korce", name: "Korçë", forms: ["Korçë", "Korça"] },
  { id: "fier", name: "Fier", forms: ["Fier", "Fieri"] },
  { id: "berat", name: "Berat", forms: ["Berat", "Berati"] },
  { id: "lezhe", name: "Lezhë", forms: ["Lezhë", "Lezha"] },
  { id: "kukes", name: "Kukës", forms: ["Kukës", "Kukësi"] },
  { id: "sarande", name: "Sarandë", forms: ["Sarandë", "Saranda"] },
  { id: "gjirokaster", name: "Gjirokastër", forms: ["Gjirokastër", "Gjirokastra", "Gjirokastrës"] },
  { id: "pogradec", name: "Pogradec", forms: ["Pogradec", "Pogradeci"] },
  { id: "kavaje", name: "Kavajë", forms: ["Kavajë", "Kavaja"] },
  { id: "lushnje", name: "Lushnjë", forms: ["Lushnjë", "Lushnja", "Lushnje"] },
  { id: "kruje", name: "Krujë", forms: ["Krujë", "Kruja"] },
];

const KOSOVO = KOSOVO_IDS.map((id) => {
  const city = CITIES.find((c) => c.id === id);
  if (!city) throw new Error(`section-cities: ${id} is missing from lib/cities.mjs`);
  return { id: city.id, name: city.name, forms: city.forms };
});

/** @typedef {{ id: string, name: string, emblem: string }} SectionCity */

const withEmblem = (city) => ({ id: city.id, name: city.name, emblem: `/images/cities/${city.id}.webp` });

/** Section name → its cities, in the order the picker breaks ties. */
const SECTIONS = {
  "Kosovë": KOSOVO,
  "Shqipëri": ALBANIA,
};

const FORMS = new Map(
  Object.values(SECTIONS).flat().map((c) => [c.id, surfaceForms({ name: c.name, match: c.forms })])
);

/** @param {string | null | undefined} section */
export function hasCities(section) {
  return Boolean(section && SECTIONS[section]);
}

/** @param {string | null | undefined} section @returns {SectionCity[]} */
export function sectionCities(section) {
  return (SECTIONS[section ?? ""] ?? []).map(withEmblem);
}

/** @param {string | null | undefined} section @param {unknown} id @returns {SectionCity | null} */
export function sectionCityById(section, id) {
  const city = (SECTIONS[section ?? ""] ?? []).find((c) => c.id === id);
  return city ? withEmblem(city) : null;
}

/** The city of `cities` named earliest in `text`, or null. */
function firstNamed(text, cities) {
  const folded = fold(text);
  if (!folded) return null;
  const words = folded.split(" ");
  const padded = ` ${folded} `;
  let best = null;
  let bestAt = Infinity;
  for (const city of cities) {
    for (const form of FORMS.get(city.id) ?? []) {
      let at = -1;
      if (form.includes(" ")) {
        const hit = padded.indexOf(` ${form} `);
        // Word position, so phrase and single-word hits compare on one scale.
        if (hit >= 0) at = padded.slice(0, hit).split(" ").filter(Boolean).length;
      } else {
        at = words.findIndex((word) => wordMatchesForm(word, form));
      }
      if (at >= 0 && at < bestAt) {
        best = city;
        bestAt = at;
      }
    }
  }
  return best;
}

/**
 * The id of the one city this article belongs to within `section`, or null.
 *
 * @param {{ city?: string | null, title?: string | null, excerpt?: string | null } | null | undefined} article
 * @param {string | null | undefined} section
 * @returns {string | null}
 */
export function cityOfArticle(article, section) {
  const cities = SECTIONS[section ?? ""];
  if (!article || !cities) return null;
  if (article.city) {
    const field = fold(article.city);
    const owned = cities.find((c) => (FORMS.get(c.id) ?? []).includes(field));
    if (owned) return owned.id;
  }
  return (firstNamed(article.title, cities) ?? firstNamed(article.excerpt, cities))?.id ?? null;
}
