/**
 * Kërko — matching and ranking for the site-wide search.
 *
 * Pure and unit tested in search-match.test.mjs. The API route does the I/O;
 * everything that decides what matches and in what order lives here.
 *
 * Albanian is the whole difficulty. A reader types "kosove" and means "Kosovë",
 * types "cmimet" and means "çmimet", and will not type the diacritic on a phone
 * keyboard. Postgres has no Albanian text-search configuration, so folding is
 * done here rather than delegated to the database.
 */

import { topicFor, topicForms, descendantsOf } from "./search-topics.mjs";

/**
 * Lowercase, strip diacritics, collapse punctuation to single spaces.
 *
 * The combining-mark range is written as escapes rather than literal marks so
 * it survives being copied, pasted and re-encoded — invisible characters in a
 * character class are corrupted silently and the regex then matches nothing.
 *
 * @param {string} value
 * @returns {string}
 */
export function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Query split into the terms every match has to satisfy. */
export function terms(query) {
  const folded = fold(query);
  return folded ? folded.split(" ").filter(Boolean) : [];
}

/**
 * Albanian function words, folded. A query like "protesta në Prishtinë" means
 * protesta + Prishtinë; requiring "ne" as well only lets it match by accident
 * inside other words, or not at all.
 */
const STOPWORDS = new Set([
  "e", "i", "te", "ne", "dhe", "me", "per", "nga", "se", "si", "ka", "nje",
  "u", "do", "qe", "por", "a", "o", "ose", "mbi", "pa", "deri", "pas", "prej",
  "tek", "jane", "eshte", "kjo", "ky", "ai", "ajo", "keto", "ata", "tij", "saj",
]);

/** The terms a match must satisfy: the query without function words, unless it is only those. */
export function searchTerms(query) {
  const all = terms(query);
  const content = all.filter((t) => !STOPWORDS.has(t));
  return joinTopicNames(content.length ? content : all);
}

/**
 * A topic named in several words is one term: "liga e kampioneve" means the
 * Champions League, not three words a story must each contain somewhere.
 * Longest name first, so "premier league" is not read as two topics.
 */
function joinTopicNames(words) {
  const out = [];
  for (let i = 0; i < words.length; ) {
    let taken = 1;
    for (let len = Math.min(3, words.length - i); len >= 2; len--) {
      if (topicFor(words.slice(i, i + len).join(" "))) {
        taken = len;
        break;
      }
    }
    out.push(words.slice(i, i + taken).join(" "));
    i += taken;
  }
  return out;
}

/**
 * The part of a word Albanian inflection leaves alone. "Kosova", "Kosovës"
 * and "Kosovën" share "kosov"; a reader who types any of them means the
 * others too. Short words are kept whole — "be" and "bota" are not stems.
 */
export function stem(term) {
  if (term.length < 5) return term;
  for (const suffix of SUFFIXES) {
    if (term.endsWith(suffix) && term.length - suffix.length >= 4) return term.slice(0, -suffix.length);
  }
  return term;
}

/** Common Albanian case and article endings, folded, longest first. */
const SUFFIXES = ["ave", "eve", "ive", "ise", "it", "in", "es", "en", "ve", "ut", "un", "at", "et", "a", "e", "i", "u"];

/** At most one insertion, deletion or substitution apart. */
export function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}


/**
 * @typedef {object} SearchResult
 * @property {string} kind
 * @property {string} title
 * @property {string} href
 * @property {string} [meta]
 * @property {string} [body]
 * @property {number} [weight]
 * @property {number} [score]
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
//
// The numbers are gaps, not magnitudes: each tier must beat every combination
// of the tiers below it, so a title match can never be displaced by a pile of
// weak body matches.
// ─────────────────────────────────────────────────────────────────────────────

const EXACT_TITLE = 1000;
const TITLE_PREFIX = 400;
const TITLE_WORD_PREFIX = 240;
/** A title names a narrower member of the topic searched: "Bitcoin" for "kripto". */
const MEMBER_TITLE = 200;
/** A title word shares the term's stem: "kosova" finding "Kosovës". */
const TITLE_STEM = 90;
/** A title word one keystroke away: "prishtna" finding "Prishtinë". */
const TITLE_TYPO = 60;
const BODY_WORD_PREFIX = 40;
/** A tagged story's headline names the topic its tags leave out (scoreTopic). */
const UNTAGGED_HEADLINE = BODY_WORD_PREFIX;
/** The supporting text names a narrower member of the topic searched. */
const MEMBER_BODY = 32;
const BODY_STEM = 24;

/**
 * Newer stories win ties: at most RECENCY_MAX points, fading to nothing over
 * RECENCY_DAYS. Smaller than the smallest gap between tiers, so it orders
 * equally good matches and never lifts a weaker match over a better one.
 */
const RECENCY_MAX = 7;
const RECENCY_DAYS = 30;

/**
 * Score one term against a title and its supporting text.
 *
 * @param {string} term  already folded
 * @param {string} title already folded
 * @param {string} body  already folded
 * @returns {number} 0 when the term appears in neither
 */
function scoreTerm(term, text, tags = null) {
  if (!term) return 0;

  const topic = topicFor(term);
  if (topic) return scoreTopic(topic, text, tags);
  const { title, body } = text;

  if (title === term) return EXACT_TITLE;
  if (title.startsWith(term)) return TITLE_PREFIX;
  if (title.includes(` ${term}`)) return TITLE_WORD_PREFIX;
  // Never from the middle of a word: "kripto" found "transkripton", a story
  // about speech-to-text, and a reader sees that as the search being broken.

  const root = stem(term);
  const titleWords = title.split(" ");
  if (root !== term && titleWords.some((w) => w.startsWith(root))) return TITLE_STEM;
  if (titleWords.some((w) => isCompound(w, root))) return TITLE_STEM;
  if (term.length >= 5 && titleWords.some((w) => w.length >= 4 && withinOneEdit(term, w))) {
    return TITLE_TYPO;
  }

  if (!body) return 0;
  if (body.startsWith(term) || body.includes(` ${term}`)) return BODY_WORD_PREFIX;
  if (root !== term && (body.startsWith(root) || body.includes(` ${root}`))) return BODY_STEM;
  if (body.split(" ").some((w) => isCompound(w, root))) return BODY_STEM;
  return 0;
}

/**
 * Albanian prefixes that build a new word on an existing one: "parazgjedhje",
 * "paszgjedhjen", "rindërtim". Only these may come before the term, because
 * anything else is a different word that happens to contain it: "drama" for
 * "rama", "shkurtimet" for "kurti", "transkripton" for "kripto".
 */
const WORD_PREFIXES = ["para", "pas", "ri", "mos", "kunder"];

function isCompound(word, root) {
  if (root.length < 4) return false;
  return WORD_PREFIXES.some((p) => word.startsWith(p + root));
}

/** Words that carry meaning: function words drop out, so "Ligën e Kampionëve" reads "ligen kampioneve". */
function contentWords(text) {
  return text ? text.split(" ").filter((w) => w && !STOPWORDS.has(w)) : [];
}

/** Does the form of several words start at words[i]? Each word matches the start of a word. */
function phraseAt(words, i, parts, exact) {
  return parts.every((part, j) => {
    const w = words[i + j];
    return w !== undefined && (exact ? w === part : w.startsWith(part));
  });
}

const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A topic's forms compiled once into what one word is tested against: a
 * pattern for the single-word prefixes (with the Albanian compound prefixes in
 * front of the longer ones), a set for the exact words, and the few names of
 * several words kept apart. Testing each word against dozens of forms one by
 * one made a topic search cost 130 ms a keystroke.
 */
const COMPILED = new WeakMap();

function compile(forms) {
  const cached = COMPILED.get(forms);
  if (cached) return cached;
  const single = forms.prefix.filter((f) => !f.includes(" "));
  const long = single.filter((f) => f.length >= 4);
  const alternatives = [
    ...(single.length ? [`(?:${single.map(escape).join("|")})`] : []),
    ...(long.length ? [`(?:${WORD_PREFIXES.join("|")})(?:${long.map(escape).join("|")})`] : []),
  ];
  const compiled = {
    prefix: alternatives.length ? new RegExp(`^(?:${alternatives.join("|")})`) : null,
    exact: new Set(forms.exact.filter((f) => !f.includes(" "))),
    phrases: [
      ...forms.prefix.filter((f) => f.includes(" ")).map((f) => ({ parts: f.split(" "), exact: false })),
      ...forms.exact.filter((f) => f.includes(" ")).map((f) => ({ parts: f.split(" "), exact: true })),
    ],
    not: forms.not.length ? new RegExp(`^(?:${forms.not.map(escape).join("|")})`) : null,
  };
  COMPILED.set(forms, compiled);
  return compiled;
}

/** Does any of the forms appear in the words, outside the words the topic excludes? */
function hasForm(words, forms, from = 0, to = words.length) {
  const c = compile(forms);
  for (let i = from; i < to; i++) {
    const w = words[i];
    if (c.not?.test(w)) continue;
    if (c.exact.has(w) || c.prefix?.test(w)) return true;
    if (c.phrases.some((ph) => phraseAt(words, i, ph.parts, ph.exact))) return true;
  }
  return false;
}

/**
 * Score a term that names a topic (lib/search-topics.mjs).
 *
 * A tagged article (lib/topic-tags.mjs) is found by its tags: tagged with the
 * topic itself on the word-match tier, with anything under it just below. Its
 * headline still counts when it names the topic, in case the tagger missed
 * it, but its summary does not: "bitcoin" in passing in a story about the
 * crypto market is not a Bitcoin story, and that was the complaint.
 *
 * An article not yet tagged, and anything that is not an article, falls back
 * to the topic's words: its own on the usual tiers, the words of everything
 * under it just below, so "Tregu i kriptos" leads "Bitcoin bie" for "kripto"
 * and both are found.
 */
function scoreTopic(topic, text, tags) {
  const { own, wider } = topicForms(topic);
  const titleWords = (text.titleWords ??= contentWords(text.title));
  let words = 0;
  if (own.exact.includes(titleWords.join(" ")) || own.prefix.includes(titleWords.join(" "))) words = EXACT_TITLE;
  else if (hasForm(titleWords, own, 0, 1)) words = TITLE_PREFIX;
  else if (hasForm(titleWords, own)) words = TITLE_WORD_PREFIX;

  if (Array.isArray(tags)) {
    if (tags.includes(topic.id)) return Math.max(words, TITLE_WORD_PREFIX);
    if (descendantsOf(topic.id).some((id) => tags.includes(id))) return Math.max(words, MEMBER_TITLE);
    // The headline names the topic and the tags disagree. Either the tagger
    // missed it, or the word means something else here ("zgjedhjet" is also
    // "choices", "votimin" a vote in the US Senate). Found, but after every
    // story actually tagged with the topic.
    return words ? UNTAGGED_HEADLINE : 0;
  }

  if (words) return words;
  const bodyWords = (text.bodyWords ??= contentWords(text.body));
  if (hasForm(titleWords, wider)) return MEMBER_TITLE;
  if (hasForm(bodyWords, own)) return BODY_WORD_PREFIX;
  if (hasForm(bodyWords, wider)) return MEMBER_BODY;
  return 0;
}

/**
 * A brand joined in capitals is two words to a reader: "ChatGPT" is found by
 * "gpt", "OpenAI" by "openai" and by "open". Folding lowercases the boundary
 * away, so the split is taken from the original text first.
 */
function splitJoined(value) {
  return String(value ?? "").replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2");
}

/**
 * Folded text per entry, kept as long as the entry object lives. The search
 * runs on every keystroke over the same index (rebuilt every few minutes in
 * search-sources), and folding 2000 headlines and summaries each time made a
 * keystroke cost 100-200 ms; folded once, it is the scoring alone.
 */
const FOLDED = new WeakMap();

/** An entry folded once, plus its capital-split reading when that differs. */
function foldEntry(entry) {
  const cached = FOLDED.get(entry);
  if (cached) return cached;
  const title = fold(entry.title ?? "");
  const body = fold(entry.body ?? "");
  const splitTitle = fold(splitJoined(entry.title));
  const splitBody = fold(splitJoined(entry.body));
  const split = splitTitle !== title || splitBody !== body ? { title: splitTitle, body: splitBody } : null;
  // null, not [], when the article has not been tagged yet: no tags is a verdict.
  const tags = Array.isArray(entry.topics) ? entry.topics : null;
  const text = { title, body, split, tags };
  FOLDED.set(entry, text);
  return text;
}

/** The better of the plain and the capital-split reading. */
function scoreFolded(term, text) {
  const plain = scoreTerm(term, text, text.tags);
  return text.split ? Math.max(plain, scoreTerm(term, text.split, text.tags)) : plain;
}

/** Up to RECENCY_MAX points for a dated entry, by age. */
function recency(entry, now) {
  const time = entry?.date ? Date.parse(entry.date) : NaN;
  if (!Number.isFinite(time)) return 0;
  const days = Math.max(0, (now - time) / 86_400_000);
  return Math.max(0, RECENCY_MAX * (1 - days / RECENCY_DAYS));
}

/**
 * Score an entry against the query.
 *
 * Every term must hit something, so "dialogu serbi" does not match a piece that
 * only mentions dialogue. Returns 0 for no match, which callers treat as
 * "exclude" rather than "rank last".
 *
 * @param {readonly string[]} queryTerms
 * @param {{ title?: string, body?: string, weight?: number }} entry
 * @returns {number}
 */
export function scoreEntry(queryTerms, entry, now = Date.now()) {
  if (!queryTerms.length) return 0;

  const text = foldEntry(entry);
  const { title } = text;
  if (!title && !text.body) return 0;

  let total = 0;
  for (const term of queryTerms) {
    const s = scoreFolded(term, text);
    if (s === 0) return 0;
    total += s;
  }

  // A shorter title containing the same match is the more precise answer:
  // "Botë" should beat "Bota Flet për Kosovën" when someone types "bot".
  // Destinations only: between two stories that match equally well, a short
  // headline is not the better answer, the newer story is — and brevity (up
  // to 10 points) was outweighing recency, so last week's pieces led.
  const brevity = entry.date ? 0 : Math.max(0, 40 - Math.min(title.length, 40)) / 4;

  return Math.round((total + brevity) * (entry.weight ?? 1) + recency(entry, now));
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The sections a result can land in, with the Albanian heading each is shown
 * under. Order here is only the tiebreak — groups are ordered by how well their
 * best item scored, so an exact topic match leads even though articles are the
 * bulk of the index.
 */
export const GROUPS = [
  { kind: "person", label: "PERSONA" },
  { kind: "artikull", label: "ARTIKUJ" },
  { kind: "vend", label: "VENDE" },
  { kind: "tema", label: "TEMA" },
  { kind: "kategori", label: "KATEGORI" },
  { kind: "media", label: "MEDIA" },
  { kind: "vizito", label: "VIZITO" },
  // Last on purpose. A prediction market that shares a word with the query is
  // the weakest answer on a news site, and it was outranking the reporting.
  { kind: "treg", label: "TREGU" },
];

const GROUP_ORDER = new Map(GROUPS.map((g, i) => [g.kind, i]));

/**
 * Rank entries, drop non-matches, and gather them into display sections.
 *
 * @param {readonly SearchResult[]} entries
 * @param {string} query
 * @param {{ perGroup?: number, total?: number }} [opts]
 * @returns {{ kind: string, label: string, items: SearchResult[] }[]}
 */
export function search(entries, query, opts = {}) {
  const perGroup = opts.perGroup ?? 4;
  const total = opts.total ?? 20;
  const now = opts.now ?? Date.now();
  const queryTerms = searchTerms(query);
  if (!queryTerms.length) return [];

  const scored = [];
  for (const entry of entries ?? []) {
    if (!entry) continue;
    const score = scoreEntry(queryTerms, entry, now);
    if (score > 0) scored.push({ ...entry, score });
  }

  const byKind = new Map();
  for (const item of scored) {
    const kind = item.kind ?? "artikull";
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(item);
  }

  const groups = [];
  for (const [kind, items] of byKind) {
    // Equal scores: newer first (rounding can merge stories days apart),
    // then alphabetical so the order is stable.
    items.sort(
      (a, b) =>
        b.score - a.score ||
        (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0) ||
        a.title.localeCompare(b.title)
    );
    const meta = GROUPS.find((g) => g.kind === kind);
    groups.push({
      kind,
      label: meta?.label ?? kind.toUpperCase(),
      best: items[0].score,
      items: items.slice(0, perGroup),
    });
  }

  // Tregu is pinned last regardless of how well it scored. Everything else is
  // ordered by its best match, which is what puts a country ahead of the
  // articles that merely mention it — but a prediction market outranking the
  // reporting is never the right answer on a news site, and it did.
  const pinnedLast = (kind) => (kind === "treg" ? 1 : 0);
  groups.sort(
    (a, b) =>
      pinnedLast(a.kind) - pinnedLast(b.kind) ||
      b.best - a.best ||
      (GROUP_ORDER.get(a.kind) ?? 99) - (GROUP_ORDER.get(b.kind) ?? 99)
  );

  // Trim to the overall cap without letting one group eat the whole overlay.
  let remaining = total;
  const out = [];
  for (const g of groups) {
    if (remaining <= 0) break;
    const items = g.items.slice(0, remaining);
    remaining -= items.length;
    out.push({ kind: g.kind, label: g.label, items });
  }
  return out;
}

/**
 * What to offer when nothing matched.
 *
 * A dead end is the one outcome a search must not produce, so this returns the
 * entries closest to the query by shared word-prefix — enough to say "we do not
 * have that, but we have these".
 *
 * @param {readonly SearchResult[]} entries
 * @param {string} query
 * @param {number} [limit]
 * @returns {SearchResult[]}
 */
export function nearest(entries, query, limit = 5) {
  const queryTerms = searchTerms(query);
  if (!queryTerms.length) return [];

  const scored = [];
  for (const entry of entries ?? []) {
    if (!entry) continue;
    // Navigational destinations only: suggesting a single article for a query
    // nothing matched is noise, while a topic or a section is a way onward.
    if (entry.kind === "artikull") continue;
    const title = fold(entry.title ?? "");
    if (!title) continue;

    // The stem has to be most of the word, not merely its opening. At three
    // characters "dialogu" suggested "Diario Área Campo de Gibraltar", which is
    // a correct prefix match and a useless answer — a suggestion that shares
    // only a syllable reads as the search malfunctioning.
    const floor = (term) => Math.max(4, Math.ceil(term.length * 0.6));

    let best = 0;
    for (const term of queryTerms) {
      const min = floor(term);
      for (let len = Math.min(term.length, title.length); len >= min; len--) {
        const stem = term.slice(0, len);
        if (title.startsWith(stem) || title.includes(` ${stem}`)) {
          best = Math.max(best, len);
          break;
        }
      }
    }
    if (best > 0) scored.push({ ...entry, score: best });
  }

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

/**
 * Does the query read as a question rather than a lookup?
 *
 * Used only to surface the Pyet 383 route more prominently — never to withhold
 * results, because a question-shaped query is still a search.
 *
 * @param {string} query
 * @returns {boolean}
 */
export function looksLikeQuestion(query) {
  const raw = String(query ?? "").trim();
  if (!raw) return false;
  if (raw.endsWith("?")) return true;
  const first = fold(raw).split(" ")[0];
  // Albanian interrogatives and the "a ..." yes/no opener.
  return [
    "a", "pse", "si", "kush", "cili", "cila", "cilat", "cilet",
    "kur", "ku", "sa", "cfare", "cka", "ckajane",
  ].includes(first);
}

/**
 * The closest results when nothing matches every term.
 *
 * The results page must never be a dead end. For a query of several words an
 * entry qualifies when it matches at least half of them (at least one), ranked
 * by how many it matches, then by how well. Articles count here, unlike in
 * nearest(): these are "the closest we have", shown as such.
 *
 * @param {readonly SearchResult[]} entries
 * @param {string} query
 * @param {{ limit?: number, now?: number }} [opts]
 * @returns {SearchResult[]}
 */
export function closest(entries, query, opts = {}) {
  const limit = opts.limit ?? 20;
  const now = opts.now ?? Date.now();
  const queryTerms = searchTerms(query);
  if (!queryTerms.length) return [];
  const needed = Math.max(1, Math.ceil(queryTerms.length / 2));
  const scored = [];
  for (const entry of entries ?? []) {
    if (!entry) continue;
    const text = foldEntry(entry);
    if (!text.title && !text.body) continue;
    let hits = 0;
    let total = 0;
    for (const term of queryTerms) {
      const s = scoreFolded(term, text);
      if (s > 0) {
        hits++;
        total += s;
      }
    }
    if (hits < needed) continue;
    scored.push({ entry, hits, score: Math.round(total * (entry.weight ?? 1) + recency(entry, now)) });
  }
  scored.sort((a, b) => b.hits - a.hits || b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return scored.slice(0, limit).map(({ entry, score }) => ({ ...entry, score }));
}
