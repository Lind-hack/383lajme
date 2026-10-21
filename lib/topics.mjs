import { matchTopic, MIN_TOPIC_SCORE } from "./dosje-match.mjs";
/**
 * Dosje: the standing topics 383 covers continuously, and the timeline each one
 * carries.
 *
 * A topic has two halves. The milestones below are authored history - the fixed
 * points a reader needs to make sense of today's story, most of which predate
 * this archive entirely. The recent half is the archive itself: articles match a
 * topic by its surface forms, so nothing has to be tagged by hand and every
 * story published from here on joins its dossier automatically.
 *
 * EDITORIAL NOTE: the milestone text is a first draft written from well-known
 * public record. Dates and framing must be checked by an editor before this is
 * treated as reference material. Prefer deleting an entry you cannot verify over
 * publishing one you are unsure of - a dossier is only worth having if it is
 * right.
 */

/** Lowercase, accent-tolerant comparison key. */
function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .replaceAll("\u00eb", "e")
    .replaceAll("\u00e7", "c")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The hand-written dossiers lived here until 2026-10-21. They were unsourced,
 * and every dossier is now created and kept by the daily verified run
 * (scripts/run-dosje-daily.mjs, migration 0115) and read from the database.
 * The old six survive only as a test fixture (topics-legacy.fixture.mjs).
 *
 * Kept as an empty export so the helpers below, which fall back to it when no
 * universe is passed, keep their signatures.
 */
export const TOPICS = [];

const BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

export function topicBySlug(slug) {
  return BY_SLUG.get(String(slug ?? "")) ?? null;
}

function formHits(article, topic) {
  const hay = " " + fold((article?.title ?? "") + " " + (article?.excerpt ?? "") + " " + (article?.category ?? "")) + " ";
  return (topic?.forms ?? []).filter((form) => {
    const f = fold(form);
    return f.length > 2 && hay.includes(" " + f + " ");
  }).length;
}

/**
 * Whether an article belongs to a topic. Matches whole words inside the folded
 * title, excerpt and category, so "bruksel" hits "Brukselit" while a short form
 * can never match the middle of an unrelated word.
 */
export function articleMatchesTopic(article, topic, universe) {
  if (!article || !topic) return false;
  // A story belongs in one file only when that file is its unique best topic,
  // so the universe it competes in has to be the whole set of subjects — not
  // only the six written into this file. Callers with a database connection
  // pass the union; the default keeps this function pure for its tests.
  const match = matchTopic(article, universe?.length ? universe : TOPICS);
  return Boolean(match && match.topic.slug === topic.slug && match.score >= MIN_TOPIC_SCORE);
}

/**
 * The dossier an article belongs to, or none.
 *
 * This delegates to lib/dosje-match.mjs rather than scoring surface forms
 * itself, because there were two answers to this question and the one readers
 * got was the wrong one. The old rule attached a dossier on any single form
 * hit, so "nato" alone pinned the Kosovo KFOR file to a NATO summit in Ankara,
 * "shba" pinned the diaspora file to an embassy notice in Tirana, and a tie
 * was broken by whichever topic sat first in the array.
 *
 * The better rule was written, tested, and wired only to the automation job
 * that maps articles for research — so every property it guaranteed was false
 * on the page. One implementation now, used by both.
 */
export function topicForArticle(article, universe) {
  const m = matchTopic(article, universe?.length ? universe : TOPICS);
  return m ? m.topic : null;
}

export function articlesForTopic(slug, articles, universe) {
  const pool = universe?.length ? universe : TOPICS;
  const topic = pool.find((t) => t.slug === String(slug ?? "")) ?? topicBySlug(slug);
  if (!topic) return [];
  return (articles ?? [])
    .filter((a) => articleMatchesTopic(a, topic, pool))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
}

/** Words too common to carry meaning when matching a milestone to a photo. */
/**
 * Words that carry no subject.
 *
 * The `length > 3` filter below already removes most short function words, so
 * what matters here are the long ones: ordinary Albanian verbs and nouns that
 * appear in every second headline and therefore match everything. Two of them
 * — "fuqi" and "vendos" — were the entire evidence for pairing the end of the
 * 1999 war with a story about US tariffs on Canada.
 */
const STOP = new Set([
  "sipas", "gjate", "midis", "eshte", "ishte", "ishin", "kete", "kjo",
  "vendos", "vendosi", "vendim", "vendimi", "fuqi", "fuqine", "mbetet",
  "mbeti", "shume", "vitit", "vitin", "viti", "ceshtje", "ceshtjen",
  "pjese", "pjesen", "pasi", "para", "brenda", "jashte", "shpall",
  "shpalli", "merr", "marre", "jep", "dhene", "behet", "bere", "kane",
  "kishte", "kishin", "duke", "tjera", "tjeter", "tjeret", "reja",
  "madh", "madhe", "vogel", "sot", "dje", "sonte", "tani", "kur",
  "raporton", "raportuar", "thote", "thene", "deklaroi", "deklaruar",
  "njofton", "njoftoi", "pret", "pritet", "vazhdon", "vazhduar",
]);

function keywords(text) {
  return new Set(
    fold(text)
      .split(" ")
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

/**
 * A photograph for an authored milestone, taken from this archive's own
 * coverage of the same subject.
 *
 * These are historical events and 383 holds no photograph of most of them, so
 * nothing here claims to be one. The image is the strongest match from the
 * archive on the milestone's own words, and it is always credited to the
 * article it came from — the caption is what keeps an illustration from
 * reading as documentation. A milestone with no decent match gets no image
 * rather than a loose one.
 */
/**
 * One photograph per moment, and never the same one twice.
 *
 * These are historical events and this archive holds no photograph of most of
 * them, so nothing here claims to be one. Every milestone is scored against
 * every article that carries an image, the strongest pairs are assigned first,
 * and an article is spent once it is used — which is what stops a dossier
 * showing the same picture down its whole length, the way a per-milestone
 * search independently picking its own best match would.
 *
 * The topic's own coverage is preferred and scored higher, but the pool is the
 * whole archive: a dossier with four articles to its name cannot give eight
 * moments a distinct picture out of four.
 *
 * Each result carries whether it is genuinely about that moment, because the
 * caption changes accordingly. An uncaptioned illustration beside a historical
 * entry reads as documentation of it.
 */
/**
 * How much shared subject a photograph needs before it may sit beside a
 * moment. Below this the moment shows no photograph, which is the correct
 * outcome: a dossier with fewer pictures is honest, one with a wrong picture
 * is not. Do not lower this to increase coverage.
 */
export const MIN_IMAGE_SCORE = 3;

/**
 * The year a milestone happened, when it is a real year. Some are deliberately
 * vague ("Çdo vit", "Në vijim") and those can never be date-matched.
 */
function milestoneYear(m) {
  const y = String(m?.year ?? "");
  return /^\d{4}$/.test(y) ? y : null;
}

function assignImages(milestones, articles, topic, universe) {
  // Only this dossier's own coverage is eligible. The pool was previously the
  // whole archive, which is how a Bitcoin story became a picture of the 2013
  // NATO drawdown: an unrelated article needed only to share two filler words
  // to outscore the topic bonus.
  // The topic set travels with the call: without it this matched only the
  // hand-written file, and once that emptied it found no photographs at all.
  const pool = articlesForTopic(topic.slug, articles ?? [], universe).filter((a) => a?.imageUrl);
  if (!pool.length) return new Map();

  const pairs = [];
  milestones.forEach((m, mi) => {
    const want = keywords(`${m.title} ${m.tag ?? ""} ${m.summary ?? ""}`);
    pool.forEach((art, ai) => {
      const have = keywords(`${art.title ?? ""} ${art.excerpt ?? ""}`);
      let score = 0;
      for (const w of want) if (have.has(w)) score += 1;
      pairs.push({ mi, ai, score });
    });
  });

  pairs.sort((x, y) => y.score - x.score || x.mi - y.mi || x.ai - y.ai);

  const out = new Map();
  const takenArticle = new Set();
  for (const { mi, ai, score } of pairs) {
    if (out.has(mi) || takenArticle.has(ai)) continue;
    // The floor. Without it the loop assigns every moment something as long as
    // the pool has anything left, so the tail of a dossier receives whatever
    // remains — which is exactly how this failed before.
    if (score < MIN_IMAGE_SCORE) continue;
    const art = pool[ai];

    // The event and the photograph must belong to the same year. This archive
    // begins in 2026 and nearly every milestone predates it, so in practice a
    // historical moment simply has no photograph here — which is the honest
    // result. Words alone cannot make a 2026 picture into a picture of 1999.
    const year = milestoneYear(milestones[mi]);
    if (!year) continue;
    if (String(art.publishedAt ?? "").slice(0, 4) !== year) continue;

    // No anonymous photographs: without a credit and a link back to the report
    // it came from, a reader has no way to check what they are looking at.
    if (!art.source || !art.slug) continue;

    out.set(mi, {
      imageUrl: art.imageUrl,
      imageCredit: art.source,
      imageSlug: art.slug,
    });
    takenArticle.add(ai);
  }
  return out;
}

/**
 * The dossier timeline: authored history oldest-first, then this archive's own
 * coverage, with the article being read marked in place so a reader can see
 * where today sits in the longer story.
 */
export function timelineFor(slug, articles, currentSlug, currentArticle, universe) {
  const current = currentSlug ?? null;
  // The file's entry when there is one, because that is where the hand-written
  // milestones and the photo-scoring context live. A subject that exists only
  // in the database has neither, and gets its history from dosje-entries; what
  // it needs from here is the archive half, which the universe below supplies.
  const topic = topicBySlug(slug) ?? (universe ?? []).find((t) => t.slug === String(slug ?? "")) ?? null;
  if (!topic) return [];

  const picked = assignImages(topic.milestones ?? [], articles, topic, universe);

  const milestones = (topic.milestones ?? []).map((m, i) => ({
    kind: "milestone",
    id: "m:" + m.date + ":" + m.title,
    ...m,
    ...(picked.get(i) ?? {}),
  }));

  // The reader's own article, and nothing published after it.
  //
  // The page hands over the fifty most recent articles, so a reader on an
  // older story found their own piece missing from its own file. And because
  // the list is simply the newest fourteen, the account ran past the story
  // being read and ended on someone else's later report — a file that closes
  // after the page it is attached to reads as though the reader arrived late.
  //
  // Passing the article itself fixes both: it joins the pool whether or not
  // the fetch happened to include it, and it sets the point the account stops.
  const pool = articles ?? [];
  const withCurrent =
    currentArticle?.slug && !pool.some((a) => a?.slug === currentArticle.slug)
      ? [...pool, currentArticle]
      : pool;

  const cutoff = Date.parse(currentArticle?.publishedAt ?? "");
  const upToCurrent = (a) => {
    if (Number.isNaN(cutoff)) return true;
    if (a.slug === currentArticle.slug) return true;
    const at = Date.parse(a.publishedAt ?? "");
    return Number.isNaN(at) || at <= cutoff;
  };

  const recent = articlesForTopic(slug, withCurrent, universe)
    .filter(upToCurrent)
    .slice(0, 14)
    .reverse()
    .map((a) => ({
      kind: "article",
      id: "a:" + a.slug,
      year: String(a.publishedAt ?? "").slice(0, 4),
      date: a.publishedAt,
      tag: a.category,
      title: a.title,
      summary: a.excerpt,
      slug: a.slug,
      imageUrl: a.imageUrl ?? null,
      source: a.source ?? null,
      publishedAt: a.publishedAt ?? null,
      isCurrent: Boolean(current) && a.slug === current,
    }));

  return [...milestones, ...recent];
}
