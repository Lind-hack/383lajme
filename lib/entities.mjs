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
  // Places and outlets that look like two names: New York, Page Six, Kosovo Online.
  "york", "jork", "garden", "six", "albania", "online", "euronews", "act", "referee",
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
  // All capitals is an acronym ("CLARITY Act"), except Roman numerals ("Leo
  // XIV"). Ordinary words are not tested here: by its first letters
  // "romantizim" took Fabrizio Romano, and a story typed without diacritics
  // writes "kanë" as "kane", which took Harry Kane.
  const isWord = (w) => w.length >= 3 && /^\p{Lu}+$/u.test(w) && !/^[IVXLC]+$/.test(w);

  for (const article of articles ?? []) {
    if (!article) continue;
    const title = String(article.title ?? "");
    const body = String(article.body ?? "");

    for (const [source, weight] of [
      // An English headline in Title Case capitalises every word: "Confusing
      // Scenes As Dream Cycle Ends" is not a list of names.
      [isTitleCase(title) ? "" : title, 2],
      [body, 1],
    ]) {
      for (const match of source.matchAll(NAME_RUN)) {
        const run = withoutTitle(match[1].trim());
        if (!run || !looksLikePerson(run) || run.split(/\s+/).some(isWord)) continue;
        const key = fold(run);
        const prev = seen.get(key);
        // Keep the first spelling encountered; later ones are usually the same
        // name with a case or punctuation difference.
        if (prev) prev.mentions += weight;
        else seen.set(key, { name: run, mentions: weight });
      }
    }
  }

  mergeDeclined(seen);
  return [...seen.values()]
    .filter((p) => p.mentions >= minMentions)
    .map((p) => ({ ...p, aliases: nameAliases(p.name) }))
    .filter((p) => p.aliases.length > 1)
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}

/** Most words capitalised, as English headlines are written. */
function isTitleCase(title) {
  const words = title.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  if (words.length < 4) return false;
  return words.filter((w) => /^\p{Lu}/u.test(w)).length / words.length >= 0.75;
}

/**
 * "Lionel Messit" and "Lionel Messin" are Lionel Messi with a case ending, and
 * "Albin Kurtit" is Albin Kurti: one person, counted once, under the plain
 * name the corpus also uses. Only into a name that exists, so an ending is
 * never guessed off a name nobody wrote.
 */
function mergeDeclined(seen) {
  const keys = [...seen.keys()].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const words = key.split(" ");
    if (words.length < 2) continue;
    const surname = words[words.length - 1];
    for (const ending of CASE_ENDINGS) {
      const base = surname.slice(0, -ending.length);
      if (!surname.endsWith(ending) || base.length < 4) continue;
      const target = [...words.slice(0, -1), base].join(" ");
      const into = seen.get(target);
      if (!into || target === key) continue;
      into.mentions += seen.get(key).mentions;
      seen.delete(key);
      break;
    }
  }
}

/**
 * Words that open a capitalised run without being a name: "Për Kosovën" at
 * the start of a sentence is a preposition and a country, and was treated as
 * a person whose surname matched 250 stories.
 */
const FUNCTION_STARTS = new Set([
  "per", "ne", "nga", "me", "kur", "pas", "edhe", "nese", "sipas", "gjate", "mes", "ndaj",
  "tek", "te", "pse", "si", "ku", "sot", "dje", "ja", "kjo", "ky", "keto", "ai", "ajo",
  "une", "ata", "por", "dhe", "ose", "deri", "prej", "mbi", "pa", "para", "pra", "nje",
  "the", "and", "for", "with", "how", "why", "what", "when", "in", "on", "at", "of",
]);

/**
 * Titles and jobs in front of a name, as stems: "Kryeministri Albin Kurti" is
 * Albin Kurti, and "Kryeministri Kurti" is not a second person called Kurti;
 * "Historiani Abdullahu", "Gjyqtarja Vargas", "Administrata Trump" (and its
 * common typo "Administata") are not first names. A stem matches only with an
 * Albanian ending after it, never as the start of another word: "Shefqet" is
 * not "shef", "Ishak" not "ish".
 */
const TITLE_STEMS = [
  "kryeministr", "kryetar", "president", "ministr", "deputet", "zevendes", "ambasador", "trajner",
  "sekretar", "guvernator", "kancelar", "drejtor", "komandant", "gjeneral", "senator", "lider",
  "zyrtar", "zot", "zonj", "kapiten", "shef", "mbret", "princ", "papa", "sulmues", "mesfushor",
  "portier", "profesor", "doktor", "kryeparlamentar", "kryesues", "kryeprokuror", "prokuror",
  "gjyqtar", "administrat", "administat", "historian", "analist", "gazetar", "aktor", "kengetar",
  "reper", "rapper", "sportist", "futbollist", "shkrimtar", "regjisor", "avokat", "biznesmen",
  "miliarder", "influencer", "modelj", "legjend", "familj", "qeveri", "kabinet", "parti",
];
const TITLE_ENDINGS = new Set([
  "", "i", "it", "in", "a", "ja", "je", "e", "es", "en", "u", "ut", "ri", "rit", "rin", "et", "at",
  "se", "s", "n", "t", "ve",
]);
const isTitle = (word) => {
  const f = fold(word);
  return TITLE_STEMS.some((t) => f.startsWith(t) && TITLE_ENDINGS.has(f.slice(t.length)));
};

/**
 * The run without titles in front, or null when it opens with a function
 * word or is only a title and a surname.
 */
function withoutTitle(run) {
  const words = run.split(/\s+/);
  if (FUNCTION_STARTS.has(fold(words[0]))) return null;
  while (words.length > 2 && isTitle(words[0])) words.shift();
  // "Kryeministri Kurti" and "Historiani Abdullahu" are a title and a
  // surname, not a person of their own; "Prince William" and "Papa Leo" are
  // how those people are named.
  if (words.length === 2 && isTitle(words[0]) && !HONORIFICS.has(fold(words[0]))) return null;
  return words.join(" ");
}

/** Titles that are part of how someone is named. */
const HONORIFICS = new Set(["prince", "princess", "princi", "papa", "pope", "king", "queen", "sheikh", "sir", "lady", "lord"]);

/**
 * Surnames that belong to more than one person in these names, and who owns
 * each one alone.
 *
 * "Rama" is Edi and Përparim, "Williams" Serena, Venus and Ronwen. A surname
 * alone does not say which of them a story is about, so nameForms() asks for a
 * first name as well, except from the owner: the person at least OWNER_SHARE
 * of the full-name mentions belong to. "Trump" alone is Donald Trump, not
 * Ivanka; "Williams" between Serena (5) and Venus (4) belongs to nobody.
 *
 * Not a second person: a title in front ("Kryeministri Kurti"), a function
 * word, or a word the corpus also writes in lower case, which is a word, not a
 * first name ("Aktualisht Kane" opens a sentence; "Gjyqtarja Vargas" is the
 * judge Vargas).
 *
 * @param {readonly (string | { name: string, mentions?: number, curated?: boolean })[]} entries
 * @param {{ lower?: Set<string> }} [opts] folded words the corpus writes in lower case
 * @returns {Map<string, string | null>} folded surname -> owner's first-name key, or null
 */
export function sharedSurnames(entries, opts = {}) {
  /** @type {Map<string, Map<string, number>>} */
  const given = new Map();
  for (const entry of entries ?? []) {
    const name = typeof entry === "string" ? entry : entry?.name;
    // A curated name is a person by definition: "Përparim" is also "progress".
    const curated = typeof entry === "object" && entry?.curated === true;
    const count = typeof entry === "string" ? 1 : Math.max(1, Number(entry?.mentions) || 1);
    const words = String(name ?? "").trim().split(/\s+/);
    if (words.length < 2) continue;
    const first = words[0];
    const key = fold(first);
    if (isTitle(first) || FUNCTION_STARTS.has(key)) continue;
    if (!curated && opts.lower?.has(first.normalize("NFC").toLowerCase())) continue;
    const surname = fold(words[words.length - 1]);
    if (!surname) continue;
    if (!given.has(surname)) given.set(surname, new Map());
    const firsts = given.get(surname);
    const k = givenKey(first);
    firsts.set(k, (firsts.get(k) ?? 0) + count);
  }
  const out = new Map();
  for (const [surname, firsts] of given) {
    if (firsts.size < 2) continue;
    const total = [...firsts.values()].reduce((a, b) => a + b, 0);
    const [top, n] = [...firsts].sort((a, b) => b[1] - a[1])[0];
    out.set(surname, n >= total * OWNER_SHARE ? top : null);
  }
  return out;
}

/** Share of the full-name mentions that makes a surname alone one person's. */
const OWNER_SHARE = 0.8;
/** Five letters, so a declined first name ("Ballkanit", "Ballkanin") is one. */
const givenKey = (word) => fold(word).slice(0, 5);

/**
 * Words the text writes in lower case at least twice: words, not names.
 * Lower-cased but not folded, so "kanë" (they have) does not make "Kane" a
 * word; and only from stories written with diacritics, because one typed
 * without them writes "kanë" as "kane".
 *
 * @param {readonly { title?: string, body?: string }[]} articles
 * @returns {Set<string>}
 */
export function lowerCaseWords(articles) {
  const counts = new Map();
  for (const a of articles ?? []) {
    const text = `${a?.title ?? ""} ${a?.body ?? ""}`.normalize("NFC");
    if (!/[ëçËÇ]/u.test(text)) continue;
    for (const token of text.match(/[\p{L}]+/gu) ?? []) {
      if (!/^\p{Ll}/u.test(token)) continue;
      const key = token;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n >= 2).map(([k]) => k));
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
    // A title right before the surname says which Rama: Edi is the prime
    // minister, Përparim the mayor ("kryetari").
    match: ["Edi Rama", "Rama", "Ramës", "Ramën", "Kryeministri Rama", "kryeministri Rama", "kryeministrit Rama", "kryeministri shqiptar Rama"],
    // "Rama" alone is also Përparim Rama, the mayor of Prishtina. A story that
    // says only "Rama" is Edi Rama's when it also says "Edi" or places him in
    // Albania (lib/entities.mjs nameForms).
    // Albania only: "bashki" and "qark" are its municipalities and counties
    // (Kosovo has "komuna"), and the cities are Albanian.
    context: ["shqiperi", "tiran", "socialist", "ps", "bashki", "qark", "pogradec", "vlor", "durres", "shkod", "elbasan", "korc", "berat", "fier"],
  },
  {
    // EDITORIAL: role as of November 2026, from 383's own coverage of the
    // municipality. Check after any Prishtina election.
    id: "perparim-rama",
    name: "Përparim Rama",
    kind: "person",
    role: "Kryetar i Prishtinës",
    aliases: ["perparim rama", "përparim rama", "perparim", "kryetari i prishtines", "kryetari i prishtinës"],
    match: ["Përparim Rama", "Përparim Ramës", "Përparim Ramën", "Rama", "Ramës", "Ramën", "Kryetari Rama", "kryetari Rama", "kryetarit Rama"],
    // Kosovo words only: Albania has mayors ("kryetarët e bashkive") too.
    context: ["prishtin", "komuna", "komune", "komunal", "ldk"],
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
    // EDITORIAL: in office since January 2025. "Trump" alone is him: the
    // corpus also names Melania and Ivanka, and by full-name counts alone it
    // could not tell, so his stories that say only "Trump" were lost.
    id: "donald-trump",
    name: "Donald Trump",
    kind: "person",
    role: "Presidenti i SHBA-së",
    aliases: ["donald trump", "trump", "presidenti amerikan", "presidenti i shba"],
    match: ["Donald Trump", "Trump", "Trumpit", "Trumpin", "Trumpi", "Trump-it", "Trump-in"],
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
    match: [spec.name, ...matchWords(spec)],
  };
}

/** Topics: their words, as folded words. */
const TOPIC_KINDS = new Set(["tema", "teme"]);

/**
 * The single words of a name worth finding in text, as written.
 *
 * A person by surname only: "Harry Kane" is "Kane" in a headline, but "Harry"
 * is Harry Styles as often as Harry Kane. A place or organisation by its
 * longer words, keeping their capitals, so mentions() can tell the name from
 * the Albanian word it folds into. A topic by its folded words, as before.
 */
function matchWords(spec) {
  if (TOPIC_KINDS.has(spec.kind)) return contentWords(spec.name);
  const words = String(spec.name).trim().split(/\s+/);
  if (words.length < 2) return [];
  if (spec.kind === "person") {
    const surname = words[words.length - 1];
    return fold(surname).length >= MIN_TOKEN && !NOT_A_SURNAME.has(fold(surname)) ? [surname] : [];
  }
  return words.filter((w) => fold(w).length >= 4 && !STOPWORDS.has(fold(w)));
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
      // Declension applies to what the reader types, not only to what the
      // article says: someone searching "Trumpit" has named Donald Trump as
      // squarely as someone searching "Trump". Multi-word aliases stay exact —
      // a phrase inflected at both ends is a different query, not this one.
      // A name the corpus found gets the strict name rules (real endings,
      // four-letter stems): "pariz" (Paris) is not "Paro" by a stem "par".
      const hit = alias.includes(" ") || q.includes(" ")
        ? alias === q
        : curated
          ? wordMatchesForm(q, alias)
          : nameLength(q, alias) > 0;
      if (!hit) continue;
      const len =
        alias.length + (KIND_RANK[entity.kind] ?? 0) * 10 + (curated ? 1000 : 0);
      if (len > bestLen) {
        bestLen = len;
        best = entity;
      }
    }
  };

  for (const entity of CURATED) consider(entity, entity.aliases, true);
  for (const item of derived ?? []) {
    if (!item) continue;
    // Either a full entity (a country, a topic) or a bare derived person.
    const entity = item.kind
      ? item
      // Full name and surname, like any person: "Trump" alone is a Trump story.
      : { id: null, name: item.name, kind: "person", aliases: item.aliases, match: [item.name, ...matchWords({ name: item.name, kind: "person" })] };
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
 * @param {readonly NameForm[]} forms folded strings (surfaceForms) or nameForms() output
 * @returns {boolean}
 */
export function mentions(article, forms) {
  if (!article || !forms?.length) return false;
  const { tokens, words, marked } = readText(`${article.title ?? ""} ${article.body ?? ""}`);
  let padded = null;

  const has = (form) => {
    if (isName(form)) return mentionsName(tokens, words, form, marked);
    const folded = fold(form);
    if (folded.includes(" ")) {
      padded ??= ` ${words.filter(Boolean).join(" ")} `;
      return padded.includes(` ${folded} `);
    }
    return words.some((word) => wordMatchesForm(word, folded));
  };
  // Context words are prefixes ("tiran" for Tiranë, Tiranës); short ones whole ("ps").
  const inContext = (c) => words.some((w) => (c.length <= 3 ? w === c : w.startsWith(c)));

  return forms.some((form) => {
    if (!form) return false;
    if (typeof form === "string") return has(form);
    if (!form.text || !has(form.text)) return false;
    if (!form.needs) return true;
    return (form.needs.names ?? []).some((n) => mentionsName(tokens, words, n, marked)) || (form.needs.context ?? []).some(inContext);
  });
}

/**
 * The forms to look for, as written: capitals and diacritics kept, so
 * mentions() can tell a name from the word it folds into. Use this rather
 * than surfaceForms() wherever the result goes to mentions().
 *
 * A surname another person also has comes back guarded: { text, needs },
 * found only with one of the person's given names or context words in the
 * same story (see sharedSurnames).
 *
 * @typedef {string | { text: string, needs: { names: string[], context: string[] } }} NameForm
 * @param {(Entity & { context?: string[] }) | null | undefined} entity
 * @param {{ shared?: Map<string, string | null> }} [opts] from sharedSurnames()
 * @returns {NameForm[]}
 */
export function nameForms(entity, opts = {}) {
  if (!entity) return [];
  const forms = [entity.name, ...(entity.match ?? [])].map((f) => String(f ?? "").trim()).filter(Boolean);
  // A folded copy of a name would match the plain word the name exists to
  // avoid ("kane" for "Kane"); the name as written covers it.
  const names = new Set(forms.filter(isName).map(fold));
  const unique = [...new Set(forms.filter((f) => isName(f) || !names.has(fold(f))))];

  // A surname someone else also has counts alone only with the first name or
  // the person's context somewhere in the story: "Rama" in a story about
  // rubbish in Prishtina is Përparim Rama, not Edi Rama.
  const words = String(entity.name ?? "").trim().split(/\s+/);
  if (entity.kind !== "person" || words.length < 2) return unique;
  const context = (entity.context ?? []).map(fold).filter(Boolean);
  // Shared, and not this person's alone (see sharedSurnames). A curated
  // person's surname is the editors' call, not the corpus count: only their
  // context, if they have one (the two Ramas), adds a condition.
  const owner = entity.id ? undefined : opts.shared?.get(fold(words[words.length - 1]));
  const shared = owner !== undefined && owner !== givenKey(words[0]);
  if (!context.length && !shared) return unique;
  // Any given name says which person it is: "Jacob Larsen" for Jacob Bruun Larsen.
  const needs = { names: words.slice(0, -1).filter((w) => !isTitle(w)), context };
  return unique.map((f) => (/\s/.test(f) || !isName(f) ? f : { text: f, needs }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Names in text
//
// Folding is right for what a reader types and wrong for finding a name: it
// turns the verb "kanë" (they have), in nearly every Albanian story, into
// "kane", and "Harry Kane" listed Trump, Xi and Zelensky. A form written with
// a capital is a name, and a name is only found where the text has it as one:
//
//   - with a capital, so the lower-case word is not it;
//   - without diacritics the name does not have, so "Kanë" opening a sentence
//     is not "Kane", while a story typed without any diacritics ("ne
//     Prishtine") still finds "Prishtinë";
//   - with a real Albanian ending if any (Kurtin, Kurtit, Ramës, Trumpit), not
//     any three letters, so "Kane" is not "Kansas" or "Kanada" and "Rama" not
//     "Ramazani".
// ─────────────────────────────────────────────────────────────────────────────

const isName = (form) => /^\p{Lu}/u.test(form);
/** NATO, KFOR, BE: a whole word, no endings or stems, so "NATO" is not "Nata" or "Natës". */
const isAcronym = (part) => part.length >= 2 && /^\p{Lu}+$/u.test(part);
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** What Albanian adds to a name: Kurti-n, Kurti-t, Trump-it, Mbappe-ja, Shqipëri-së. */
const NAME_ENDINGS = new Set(["i", "it", "in", "a", "ja", "je", "e", "es", "en", "s", "se", "n", "ne", "t", "ut", "un", "ve", "u"]);
/** What replaces a name's final vowel: Ram-ës, Ram-ën, Prishtin-a, Kosov-ë, and English Kosov-o. */
const STEM_ENDINGS = new Set(["a", "e", "o", "es", "en", "ese", "ja"]);

const hasMark = (ch) => ch.normalize("NFD").length > 1;

/**
 * How much of the folded word is the name itself, or 0 when the word is not
 * the name: the whole name, the name plus an ending, or its stem plus a
 * replaced final vowel.
 */
function nameLength(word, name) {
  if (word === name) return name.length;
  if (word.startsWith(name) && NAME_ENDINGS.has(word.slice(name.length))) return name.length;
  const stem = name.replace(/[aeiouy]$/, "");
  // Four letters at least: "Kan" and "Ram" are stems of too many words (Kana, Ramen).
  if (stem !== name && stem.length >= 4 && word.startsWith(stem) && STEM_ENDINGS.has(word.slice(stem.length))) {
    return stem.length;
  }
  // A name the corpus first met declined ("Lionel Messin") is the plain one
  // plus a case ending; the plain form and its other cases are the same
  // person. Consonant endings only: a final vowel is part of the name, and
  // "Kurti" is not "Kurt".
  for (const ending of CASE_ENDINGS) {
    const base = name.slice(0, -ending.length);
    if (!name.endsWith(ending) || base.length < 4) continue;
    if (word === base || (word.startsWith(base) && NAME_ENDINGS.has(word.slice(base.length)))) return base.length;
  }
  return 0;
}

/** Case endings that can be stripped from a declined name to get the plain one. */
const CASE_ENDINGS = ["it", "in", "n", "t", "s", "se", "ne"];

/**
 * The matched part of the token carries the name's diacritics. In a story
 * typed without any ("ne Prishtine") a missing one is forgiven; in one that
 * writes ë and ç elsewhere it is not, so "Ramen" there is the noodle dish,
 * not "Ramën". A diacritic the name does not have is never forgiven: "Kanë"
 * is not "Kane".
 */
function sameMarks(token, form, length, marked) {
  const t = [...token];
  const f = [...form];
  for (let i = 0; i < length && i < t.length; i++) {
    const tm = hasMark(t[i]);
    const fm = hasMark(f[i] ?? "");
    if (!tm && !fm) continue;
    if (!tm && fm && !marked) continue;
    if (t[i].toLowerCase() !== f[i]?.toLowerCase()) return false;
  }
  return true;
}

/**
 * A text split into words once. mentions() runs for every article against
 * every subject (2000 x 300 for trending), and splitting and folding the same
 * text each time made it 3-4 times slower than the plain folded match it
 * replaced.
 */
const READ = new Map();
const READ_MAX = 6000;

function readText(text) {
  const cached = READ.get(text);
  if (cached) return cached;
  const raw = text.normalize("NFC");
  // An apostrophe inside a word keeps it one word: "O'Kane" is not "Kane",
  // while "Kane's" is Kane with an ending.
  const tokens = raw.match(WORD) ?? [];
  const read = {
    tokens,
    words: tokens.map((t) => fold(t).replace(/ /g, "")),
    marked: /[ëçËÇ]/u.test(raw),
  };
  if (READ.size >= READ_MAX) READ.clear();
  READ.set(text, read);
  return read;
}

function mentionsName(tokens, words, form, marked) {
  const parts = form.normalize("NFC").match(WORD) ?? [];
  const folded = parts.map((p) => fold(p).replace(/ /g, ""));
  if (!folded.length || folded.some((p) => !p)) return false;

  for (let i = 0; i < tokens.length; i++) {
    if (!/^\p{Lu}/u.test(tokens[i])) continue;
    if (folded.length === 1) {
      if (isAcronym(parts[0])) {
        if (words[i] === folded[0]) return true;
        continue;
      }
      const length = nameLength(words[i], folded[0]);
      if (length && sameMarks(tokens[i], parts[0], length, marked)) return true;
      continue;
    }
    // A name of several words is an exact phrase, as before: "Edi Rama" is
    // not an "Edi" here and a "Rama" three sentences later.
    const fits = folded.every((p, j) => words[i + j] === p && sameMarks(tokens[i + j], parts[j], p.length, marked));
    if (fits) return true;
  }
  return false;
}
