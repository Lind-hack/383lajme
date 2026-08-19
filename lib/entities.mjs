/**
 * Kërko — who and what an article is actually about.
 *
 * Lexical search fails the obvious case: an article quoting Edi Rama is found
 * by "Rama" and missed by "Edi", because nothing connects the two halves of a
 * name. And nothing at all connects a role — "kryeministri i Shqipërisë" — to
 * the person holding it.
 *
 * Two layers solve those separately, because they are different problems:
 *
 *   1. Names are mechanical. Every capitalised two-word run in the corpus is
 *      a candidate, and each half of it is a way someone will search. This
 *      needs no curation and covers whoever the news happens to be about
 *      today — Cristiano Ronaldo as readily as Albin Kurti.
 *   2. Roles and synonyms are editorial. No amount of text analysis reveals
 *      that "kryeministri i Shqipërisë" means Edi Rama; somebody has to say so.
 *
 * Pure and unit tested. Nothing here reads the network or the filesystem.
 */

import { fold } from "./search-match.mjs";

/**
 * @typedef {object} Entity
 * @property {string | null} [id]   Present on curated entries, absent on derived ones.
 * @property {string} name
 * @property {string} kind          person | organizate | teme
 * @property {string} [role]        What they are, shown under the name.
 * @property {string[]} aliases     What a reader types.
 * @property {string[]} [match]     What appears in article text, inflections included.
 */


// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — names, derived from the corpus
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokens that make a capitalised run an organisation or a place rather than a
 * person, or that would collide with something the site already means.
 *
 * "Sport" is the sharp one: without it, "BBC Sport" teaches the index that
 * searching "sport" means a British broadcaster rather than the section.
 */
const NOT_A_SURNAME = new Set([
  "sport", "sports", "news", "media", "tv", "radio", "press", "times", "post",
  "daily", "journal", "review", "group", "united", "city", "club", "fc",
  "league", "cup", "open", "park", "arena", "stadium", "university", "college",
  "institute", "ministry", "ministria", "qeveria", "kuvendi", "komuna",
  "partia", "lëvizja", "levizja", "amateur", "final", "world", "bota", "bote",
  "politike", "politikë", "ekonomi", "teknologji", "showbiz", "kosove", "kosovë",
]);

/** A run has to be at least this long per token to yield a usable alias. */
const MIN_TOKEN = 3;

/**
 * Capitalised runs of two or three words, which is what a person's name looks
 * like in a headline. Albanian's Ç and Ë are included explicitly: a regex
 * built only from A-Z silently drops every Albanian name that starts with one.
 */
const NAME_RUN =
  /(?:^|[^\p{L}])(\p{Lu}[\p{L}'’-]{1,}(?:\s+\p{Lu}[\p{L}'’-]{1,}){1,2})/gu;

/**
 * The ways a reader might type this name.
 *
 * Both halves, because "Edi" and "Rama" are each a complete search to the
 * person doing it. Short and generic tokens are left out — an alias of "al"
 * would attach every article mentioning Al Jazeera to anything at all.
 *
 * @param {string} fullName
 * @returns {string[]} folded, deduplicated, most specific first
 */
export function nameAliases(fullName) {
  const full = fold(fullName);
  if (!full) return [];
  const parts = full.split(" ").filter(Boolean);
  if (parts.length < 2) return [];

  const out = [full];
  for (const part of parts) {
    if (part.length < MIN_TOKEN) continue;
    if (NOT_A_SURNAME.has(part)) continue;
    out.push(part);
  }
  return [...new Set(out)];
}

/**
 * True when a capitalised run is worth treating as a person.
 *
 * Rejects runs whose parts are too short to be a name ("LA Clippers", "St
 * Jude", "US Amateur") or that carry an organisational word ("BBC Sport").
 *
 * @param {string} run
 * @returns {boolean}
 */
export function looksLikePerson(run) {
  const parts = fold(run).split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  return parts.every((p) => p.length >= MIN_TOKEN && !NOT_A_SURNAME.has(p));
}

/**
 * Find the people the corpus is about.
 *
 * `minMentions` keeps one-off misreadings out of the index while letting a
 * genuinely recurring name in. Titles count double: a name in a headline is
 * what the piece is about, a name in the body may be an aside.
 *
 * @param {readonly {title?: string, body?: string}[]} articles
 * @param {{ minMentions?: number }} [opts]
 * @returns {{ name: string, aliases: string[], mentions: number }[]}
 */
export function extractPeople(articles, opts = {}) {
  const minMentions = opts.minMentions ?? 2;
  /** @type {Map<string, { name: string, mentions: number }>} */
  const seen = new Map();

  for (const article of articles ?? []) {
    if (!article) continue;
    const title = String(article.title ?? "");
    const body = String(article.body ?? "");

    for (const [source, weight] of [
      [title, 2],
      [body, 1],
    ]) {
      for (const match of source.matchAll(NAME_RUN)) {
        const run = match[1].trim();
        if (!looksLikePerson(run)) continue;
        const key = fold(run);
        const prev = seen.get(key);
        // Keep the first spelling encountered; later ones are usually the same
        // name with a case or punctuation difference.
        if (prev) prev.mentions += weight;
        else seen.set(key, { name: run, mentions: weight });
      }
    }
  }

  return [...seen.values()]
    .filter((p) => p.mentions >= minMentions)
    .map((p) => ({ ...p, aliases: nameAliases(p.name) }))
    .filter((p) => p.aliases.length > 1)
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — roles and synonyms, which have to be stated
//
// EDITORIAL DATA. Offices change hands and this file does not know when. Every
// role here is a claim about who currently holds it, so it needs reviewing the
// way a fact in an article does — a stale entry sends readers to the wrong
// person, which is worse than finding nothing.
//
// `match` is what appears in article text, INCLUDING inflected forms — Albanian
// declines names by changing the stem, so "Ramës" is not "Rama" with a suffix
// and cannot be derived. `aliases` is what a reader types.
// They are separate because they genuinely differ: nobody writes "kryeministri
// i Shqipërisë" in a headline, and nobody searches for "Rama tha se".
// ─────────────────────────────────────────────────────────────────────────────

export const CURATED = [
  {
    id: "edi-rama",
    name: "Edi Rama",
    kind: "person",
    role: "Kryeministër i Shqipërisë",
    aliases: [
      "edi rama", "edi", "rama",
      "kryeministri i shqiperise", "kryeministri shqiptar", "kryeministri i shqipërisë",
    ],
    // Albanian inflects the stem itself — Rama becomes Ramës, not Rama+suffix —
    // so no mechanical rule derives these. They have to be written down.
    match: ["Edi Rama", "Rama", "Ramës", "Ramën", "Ramës"],
  },
  {
    id: "bajram-begaj",
    name: "Bajram Begaj",
    kind: "person",
    role: "President i Shqipërisë",
    aliases: ["bajram begaj", "begaj", "presidenti i shqiperise", "presidenti shqiptar"],
    match: ["Bajram Begaj", "Begaj", "Begajn", "Begajt"],
  },
  {
    id: "albin-kurti",
    name: "Albin Kurti",
    kind: "person",
    role: "Kryeministër i Kosovës",
    aliases: ["albin kurti", "albin", "kurti", "kryeministri i kosoves", "kryeministri i kosovës"],
    match: ["Albin Kurti", "Kurti", "Kurtin", "Kurtit"],
  },
  {
    id: "vjosa-osmani",
    name: "Vjosa Osmani",
    kind: "person",
    role: "Presidente e Kosovës",
    aliases: ["vjosa osmani", "vjosa", "osmani", "presidentja e kosoves", "presidenti i kosoves"],
    match: ["Vjosa Osmani", "Osmani", "Osmanin", "Osmanit"],
  },
  {
    id: "aleksandar-vucic",
    name: "Aleksandar Vučić",
    kind: "person",
    role: "President i Serbisë",
    aliases: ["aleksandar vucic", "vucic", "vuçiç", "presidenti i serbise", "presidenti serb"],
    match: ["Vučić", "Vucic", "Aleksandar Vučić", "Vuçiçin"],
  },
  {
    id: "dialogu-kosove-serbi",
    name: "Dialogu Kosovë-Serbi",
    kind: "teme",
    role: "Bisedimet e Brukselit",
    aliases: [
      "dialogu kosove serbi", "dialogu", "bisedimet e brukselit", "dialogu me serbine",
      "normalizimi", "marreveshja me serbine",
    ],
    match: ["dialog", "Bruksel", "normalizim"],
  },
  {
    id: "kfor",
    name: "KFOR",
    kind: "organizate",
    role: "Forca e NATO-s në Kosovë",
    aliases: ["kfor", "forcat e nato s ne kosove", "misioni i nato s"],
    match: ["KFOR"],
  },
  {
    id: "be",
    name: "Bashkimi Evropian",
    kind: "organizate",
    role: "BE",
    aliases: ["bashkimi evropian", "be", "bashkimi europian", "brukseli", "integrimi evropian"],
    match: ["Bashkimi Evropian", "BE-së", "Komisioni Evropian"],
  },
  {
    id: "nato",
    name: "NATO",
    kind: "organizate",
    role: "Aleanca e Atlantikut të Veriut",
    aliases: ["nato", "aleanca", "anetaresimi ne nato"],
    match: ["NATO"],
  },
  {
    id: "liberalizimi-vizave",
    name: "Liberalizimi i vizave",
    kind: "teme",
    role: "Udhëtimi pa viza në zonën Schengen",
    aliases: ["liberalizimi i vizave", "vizat", "pa viza", "schengen"],
    match: ["viza", "Schengen"],
  },
];


// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — everything that is not a person
//
// A reader searching "zjarret" or "Gjermani" is naming a subject just as
// squarely as one searching "Edi". Restricting subject resolution to people
// was an accident of which case came up first, not a principle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Albanian function words. They carry no subject and would otherwise become
 * aliases — a topic aliased to "për" would answer half the queries on the site.
 */
const STOPWORDS = new Set([
  "e", "i", "te", "ne", "me", "per", "nga", "dhe", "qe", "si", "nje", "ka",
  "do", "mbi", "pas", "para", "deri", "se", "ky", "kjo", "ai", "ajo", "ata",
  "ato", "eshte", "jane", "u", "a", "as", "apo", "ose", "sa", "ku", "kur",
  "vetem", "edhe", "duke", "nen", "sipas", "gjate", "rreth", "tek", "the",
  "of", "in", "on", "and", "for", "to",
]);

/**
 * The words in a label that could stand alone as a search.
 *
 * @param {string} label
 * @returns {string[]}
 */
export function contentWords(label) {
  return [...new Set(
    fold(label)
      .split(" ")
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  )];
}

/**
 * Build a subject out of anything the site already knows the name of.
 *
 * Countries, cities, topics and organisations all reduce to the same shape: a
 * name a reader might type, and some strings to look for in article text.
 *
 * @param {{ name: string, kind: string, role?: string, id?: string,
 *           href?: string, extraAliases?: string[], meta?: object }} spec
 * @returns {Entity}
 */
export function deriveEntity(spec) {
  const folded = fold(spec.name);
  const aliases = [folded, ...(spec.extraAliases ?? []).map(fold)];

  // A multi-word label is also searchable by its content words: nobody types
  // "Shuarja e zjarreve në pyje", they type "zjarret".
  if (folded.includes(" ")) aliases.push(...contentWords(spec.name));

  return {
    id: spec.id ?? null,
    name: spec.name,
    kind: spec.kind,
    role: spec.role,
    href: spec.href,
    meta: spec.meta,
    aliases: [...new Set(aliases.filter(Boolean))],
    match: [spec.name, ...contentWords(spec.name)],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn a query into the entity it names, if it names one.
 *
 * Curated entries win over derived ones: a role phrase is a deliberate
 * editorial statement and should not be outvoted by a coincidental name run.
 * Within each layer the longest alias wins, so "edi rama" beats the "rama"
 * that would also have matched.
 *
 * @param {string} query
 * @param {readonly (Entity | {name: string, aliases: string[]})[]} [derived]
 * @returns {Entity | null}
 */
export function resolveEntity(query, derived = []) {
  const q = fold(query);
  if (!q || q.length < 2) return null;

  /** @type {Entity | null} */
  let best = null;
  let bestLen = 0;

  /**
   * When two subjects answer to the same word, the more specific one wins.
   * "Prizren" is a city before it is a topic that happens to mention Prizren,
   * and a person before either.
   */
  const KIND_RANK = { person: 5, vend: 4, qytet: 3, organizate: 2, teme: 1 };

  const consider = (entity, aliases, curated) => {
    for (const alias of aliases) {
      if (alias !== q) continue;
      const len =
        alias.length + (KIND_RANK[entity.kind] ?? 0) * 10 + (curated ? 1000 : 0);
      if (len > bestLen) {
        bestLen = len;
        best = entity;
      }
    }
  };

  for (const entity of CURATED) consider(entity, entity.aliases, true);
  for (const item of derived) {
    // Either a full entity (a country, a topic) or a bare derived person.
    const entity = item.kind
      ? item
      : { id: null, name: item.name, kind: "person", aliases: item.aliases, match: [item.name] };
    consider(entity, entity.aliases ?? [], false);
  }

  return best;
}

/**
 * Every string worth looking for in article text to find this entity.
 *
 * @param {Entity | null | undefined} entity
 * @returns {string[]}
 */
export function surfaceForms(entity) {
  if (!entity) return [];
  const forms = [entity.name, ...(entity.match ?? [])].filter(Boolean);
  return [...new Set(forms.map((f) => fold(f)).filter(Boolean))];
}

/**
 * Does this article mention the entity by any of its surface forms?
 *
 * @param {{title?: string, body?: string}} article
 * @param {readonly string[]} forms already folded
 * @returns {boolean}
 */
/** How much of an ending Albanian declension is allowed to add. */
const MAX_SUFFIX = 3;
/** Below this a stem is too generic to match on. */
const MIN_STEM = 3;

/**
 * Does one word in the text correspond to this search form?
 *
 * Albanian declines nouns and names heavily, and in two different ways:
 *
 *   Kurti  → Kurtin, Kurtit      the ending grows
 *   Rama   → Ramës,  Ramën       the stem's own final vowel changes
 *
 * A whole-word test alone misses every inflected mention, which is why the
 * curated entities had to list their declensions by hand. Allowing a short
 * ending covers the first kind; retrying without the form's final vowel covers
 * the second. Both are capped, because an unbounded prefix is how "rama" came
 * to match "Ramallahut" — 6 characters of ending is a different word, not a
 * declension of this one.
 *
 * @param {string} word folded
 * @param {string} form folded
 * @returns {boolean}
 */
export function wordMatchesForm(word, form) {
  if (!word || !form) return false;
  if (word === form) return true;
  if (word.startsWith(form) && word.length - form.length <= MAX_SUFFIX) return true;

  // ë folds to e, so the vowel set needs no diacritics here.
  const stem = form.replace(/[aeiouy]$/, "");
  if (stem.length >= MIN_STEM && stem !== form) {
    if (word.startsWith(stem) && word.length - stem.length <= MAX_SUFFIX) return true;
  }
  return false;
}

/**
 * Does this article mention the entity by any of its surface forms?
 *
 * Multi-word forms are matched as exact phrases: "edi rama" should not be
 * assembled out of an "Edi" here and a "Rama" three sentences later.
 *
 * @param {{title?: string, body?: string}} article
 * @param {readonly string[]} forms already folded
 * @returns {boolean}
 */
export function mentions(article, forms) {
  if (!article || !forms?.length) return false;
  const text = `${fold(article.title ?? "")} ${fold(article.body ?? "")}`;
  const padded = ` ${text} `;
  const words = text.split(" ").filter(Boolean);

  return forms.some((form) => {
    if (!form) return false;
    if (form.includes(" ")) return padded.includes(` ${form} `);
    return words.some((word) => wordMatchesForm(word, form));
  });
}
