/**
 * Kuizi i Ditës: five questions on the last 24 hours of 383 news.
 *
 * Pure and unit tested. Everything that decides whether a generated question is
 * fit to publish, how answers score and what the card shows lives here; routes
 * and components only do I/O.
 *
 * The validator's bar comes from what a news quiz can get wrong. A wrong "right
 * answer" teaches a reader something false under 383's name, so a question is
 * refused, never repaired, whenever the article it cites cannot back it up.
 */

import { normalizeQuestion, isHedgeOption } from "./sondazhi-draft.mjs";
import { shiftDateKey } from "./reagimi-data.ts";

export const QUIZ_LENGTH = 5;
export const QUESTION_MIN = 15;
export const QUESTION_MAX = 140;
export const OPTION_MAX = 60;
export const EXPLAIN_MAX = 200;
export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 4;
/**
 * A question's split is shown once this many readers have answered it, always
 * with the count beside it. Below that a percentage is one person's opinion.
 */
export const SPLIT_MIN_ANSWERS = 5;
/** A quiz older than this is not offered at all, even labelled. */
export const STALE_DAYS = 1;

/**
 * @typedef {object} QuizQuestion
 * @property {string} q
 * @property {string[]} options
 * @property {number} correct  index into options
 * @property {string} explain  "Çfarë do të thotë": one line of consequence
 * @property {string} slug     article the question is about
 * @property {string} category
 * @property {1 | 2 | 3} difficulty  the quiz runs easiest first
 * @property {string} trap  why someone would get it wrong (for the admin, not the card)
 */

/**
 * @typedef {object} QuizArticle
 * @property {string} slug
 * @property {string} title
 * @property {string} [excerpt]
 * @property {string} [body]
 * @property {string} [category]
 */

// ─────────────────────────────────────────────────────────────────────────────
// Grounding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every number in a string, separators removed: "1.250 euro" and "1,250" both
 * give "1250", so a figure written differently from the article still matches.
 */
export function numbersIn(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(/\d+(?:[., ]\d{3})*(?:[.,]\d+)?/g)) {
    out.push(m[0].replace(/[., ]/g, ""));
  }
  return out;
}

/** The article text a question may draw on. */
export function articleText(article) {
  return [article?.title, article?.excerpt, article?.body].filter(Boolean).join("\n");
}

/**
 * Words long enough to carry meaning, cut to a five-letter stem. Albanian
 * inflects heavily ("Kurti", "Kurtit", "Kurtin"), so whole-word matching would
 * refuse true answers; a stem is the cheapest honest approximation.
 */
function stems(text) {
  return normalizeQuestion(text)
    .split(" ")
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w))
    .map((w) => w.slice(0, 5));
}

/**
 * True when the article could support this answer: every number it states
 * appears in the article, and a non-numeric answer shares at least one word
 * stem with it. Distractors are allowed to be invented; the right one is not.
 */
export function isGrounded(answer, sourceText) {
  const source = String(sourceText ?? "");
  const sourceNumbers = new Set(numbersIn(source));
  const answerNumbers = numbersIn(answer);
  if (answerNumbers.some((n) => !sourceNumbers.has(n))) return false;
  if (answerNumbers.length > 0) return true;

  const sourceStems = new Set(stems(source));
  return stems(answer).some((s) => sourceStems.has(s));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tone
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stories that must never become trivia: deaths, killings, accidents, abuse.
 * Matched on the folded title and excerpt, so case and accents do not matter.
 */
const TRAGEDY_PATTERNS = [
  /\bvdiq\b/, /\bvdekj/, /\bvdesin\b/, /\bvdiqen\b/, /\bhumbi jeten\b/, /\bhumben jeten\b/,
  /\bpa jete\b/, /\bpajete\b/, /\bu vra\b/, /\bvrau\b/, /\bvrasj/, /\bvrare\b/, /\bvrases/,
  /\baksident/, /\btragjed/, /\bviktim/, /\bplagos/, /\bdhunim/, /\bdhunua/, /\babuz/,
  /\bfemicid/, /\bvetevras/, /\bvetvras/, /\bu mbyt/, /\bmbyten\b/, /\bterror/, /\bmasak/,
  /\bkufom/, /\bfunerali?\b/, /\bvarros/, /\bzjarr/, /\bshperth/,
];

/** True when a story is about loss of life or violence and so is no quiz material. */
export function isTragedy(article) {
  const key = normalizeQuestion(`${article?.title ?? ""} ${article?.excerpt ?? ""}`);
  return TRAGEDY_PATTERNS.some((re) => re.test(key));
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate one generated question against the articles it was given.
 *
 * Returns the cleaned question or the reason it was refused. Never repairs:
 * a refused question is cheap to drop, a wrong one is expensive to publish.
 *
 * @param {unknown} raw
 * @param {ReadonlyMap<string, QuizArticle>} articlesBySlug
 * @returns {{ ok: true, question: QuizQuestion } | { ok: false, reason: string }}
 */
export function validateQuestion(raw, articlesBySlug) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Pyetja nuk është objekt." };

  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  if (q.length < QUESTION_MIN) return { ok: false, reason: `Pyetja është shumë e shkurtër (${q.length}).` };
  if (q.length > QUESTION_MAX) return { ok: false, reason: `Pyetja është shumë e gjatë (${q.length}).` };
  if (!q.endsWith("?")) return { ok: false, reason: "Pyetja duhet të mbarojë me pikëpyetje." };
  // "Cili nuk ..." in lowercase is a misreading trap, not a knowledge test.
  if (/^(cili|cila|cilat|cilet|kush) .*\bnuk\b/.test(normalizeQuestion(q)) && !/\bNUK\b/.test(q)) {
    return { ok: false, reason: "Mohimi duhet të shkruhet NUK, që lexuesi ta shohë." };
  }

  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const article = slug ? articlesBySlug.get(slug) : undefined;
  if (!article) return { ok: false, reason: `Slug-u "${slug}" nuk është në lajmet e dhëna.` };
  if (isTragedy(article)) return { ok: false, reason: "Lajm tragjik: nuk bëhet kuiz." };

  const options = Array.isArray(raw.options)
    ? raw.options.filter((o) => typeof o === "string").map((o) => o.trim()).filter(Boolean)
    : [];
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return { ok: false, reason: `Duhen ${MIN_OPTIONS}-${MAX_OPTIONS} opsione.` };
  }
  if (options.some((o) => o.length > OPTION_MAX)) {
    return { ok: false, reason: `Një opsion e kalon ${OPTION_MAX} karaktere.` };
  }
  const seen = new Set();
  for (const o of options) {
    const key = normalizeQuestion(o);
    if (seen.has(key)) return { ok: false, reason: `Opsioni "${o}" përsëritet.` };
    seen.add(key);
    if (isHedgeOption(o) || /^(te gjitha|asnje nga)/.test(key)) {
      return { ok: false, reason: `Opsioni "${o}" nuk është përgjigje.` };
    }
  }

  const correct = raw.correct;
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return { ok: false, reason: "Indeksi i përgjigjes së saktë është i pavlefshëm." };
  }

  // The model must name why someone would get it wrong; no trap, no question.
  const trap = typeof raw.trap === "string" ? raw.trap.trim() : "";
  if (!trap) return { ok: false, reason: "Mungon kurthi: pse do ta gabonte dikush." };

  const explain = typeof raw.explain === "string" ? raw.explain.trim() : "";
  if (!explain) return { ok: false, reason: "Shpjegimi mungon." };
  if (explain.length > EXPLAIN_MAX) return { ok: false, reason: `Shpjegimi e kalon ${EXPLAIN_MAX} karaktere.` };
  // Commentary dressed as context ("Kjo tregon rëndësinë e ...") tells the
  // reader nothing the question did not, and puts a reading in 383's mouth.
  if (/^(kjo|kjo gje|ky lajm|ky takim|ky vendim) (tregon|thekson|deshmon|nenvizon|reflekton)/.test(normalizeQuestion(explain))) {
    return { ok: false, reason: "Shpjegimi është koment, jo fakt." };
  }

  // "Sa ...?" with one number among words is a giveaway: the only number wins.
  if (numbersIn(options[correct]).length > 0 && options.some((o) => numbersIn(o).length === 0)) {
    return { ok: false, reason: "Te pyetjet me numër, çdo opsion duhet të jetë numër." };
  }

  const source = articleText(article);
  if (!isGrounded(options[correct], source)) {
    return { ok: false, reason: `Përgjigjja "${options[correct]}" nuk mbështetet nga artikulli.` };
  }
  // A number in the question or the explanation is a factual claim too.
  const sourceNumbers = new Set(numbersIn(source));
  for (const n of [...numbersIn(q), ...numbersIn(explain)]) {
    if (!sourceNumbers.has(n)) return { ok: false, reason: `Numri ${n} nuk është në artikull.` };
  }

  return {
    ok: true,
    question: {
      q,
      options,
      correct,
      explain,
      slug,
      category: String(article.category ?? ""),
      difficulty: [1, 2, 3].includes(raw.difficulty) ? raw.difficulty : 2,
      trap,
    },
  };
}

/**
 * Validate a stored quiz (for reads and admin edits): exactly QUIZ_LENGTH
 * well-formed questions. No article grounding here; that happened at publish.
 *
 * @param {unknown} questions
 * @returns {questions is QuizQuestion[]}
 */
export function isStoredQuiz(questions) {
  return (
    Array.isArray(questions) &&
    questions.length === QUIZ_LENGTH &&
    questions.every(
      (x) =>
        x &&
        typeof x.q === "string" &&
        Array.isArray(x.options) &&
        x.options.length >= MIN_OPTIONS &&
        x.options.length <= MAX_OPTIONS &&
        x.options.every((o) => typeof o === "string") &&
        Number.isInteger(x.correct) &&
        x.correct >= 0 &&
        x.correct < x.options.length &&
        typeof x.explain === "string" &&
        typeof x.slug === "string"
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playing
// ─────────────────────────────────────────────────────────────────────────────

/** True when `answers` is a complete, in-range answer sheet for `quiz`. */
export function isAnswerSheet(answers, quiz) {
  return (
    Array.isArray(answers) &&
    answers.length === quiz.length &&
    answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < quiz[i].options.length)
  );
}

/** Per-question right/wrong and the score. Unanswered counts as wrong. */
export function scoreAnswers(quiz, answers) {
  const marks = quiz.map((question, i) => answers?.[i] === question.correct);
  return { marks, score: marks.filter(Boolean).length };
}

/** "■■■□■": filled for right, hollow for wrong. Characters, not emoji. */
export function marksLine(marks) {
  return marks.map((m) => (m ? "■" : "□")).join("");
}

/**
 * The text a reader shares. No answers in it, so it spoils nothing for the
 * friend who opens the link.
 */
export function shareText({ dateLabel, score, marks, url }) {
  return `Kuizi i ditës · ${dateLabel} · ${score}/${marks.length} ${marksLine(marks)}\n${url}`;
}

/** A question's split is shown only once enough readers answered it. */
export function splitVisible(total) {
  return Number.isFinite(total) && total >= SPLIT_MIN_ANSWERS;
}

/**
 * Whole percentages that add up to exactly 100 (largest remainder), so the
 * bars never read 33 + 33 + 33. Counts beyond `optionCount` are ignored.
 *
 * @param {readonly number[]} counts
 * @param {number} optionCount
 */
export function splitPercents(counts, optionCount) {
  const n = Array.from({ length: optionCount }, (_, i) => Math.max(0, Number(counts?.[i]) || 0));
  const total = n.reduce((a, b) => a + b, 0);
  if (total === 0) return { total, pct: n.map(() => 0) };
  const raw = n.map((c) => (c * 100) / total);
  const pct = raw.map(Math.floor);
  let left = 100 - pct.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    pct[i] += 1;
  }
  return { total, pct };
}

/**
 * The line that makes the split worth looking at. Null when nothing about the
 * room is surprising enough to say.
 *
 * @param {readonly number[]} pct  from splitPercents
 * @param {number} correct
 * @param {boolean} gotIt  whether this reader answered right
 */
export function splitVerdict(pct, correct, gotIt) {
  const right = pct[correct] ?? 0;
  const top = pct.indexOf(Math.max(...pct));
  if (right <= 25 && gotIt) return `Vetëm ${right}% e qëlluan. Ti je njëri prej tyre.`;
  if (top !== correct && gotIt) return "Shumica gaboi. Ti jo.";
  if (top !== correct) return "Nuk je vetëm: shumica ra në të njëjtin kurth.";
  if (right >= 80 && !gotIt) return `${right}% e dinin këtë.`;
  return null;
}

/** Albanian verdict for a score, plain and short. */
export function scoreVerdict(score) {
  if (score >= 5) return "E ndoqe ditën nga afër.";
  if (score >= 3) return "E ke kapur pjesën më të madhe.";
  if (score >= 1) return "Tani e di çfarë humbe.";
  return "Dita të kaloi pa e vënë re. Tani je në rrjedhë.";
}

/**
 * Which quiz the card shows: today's, else the most recent one no older than
 * STALE_DAYS, flagged so the card labels it with its own date. Never presents
 * an old quiz as today's.
 *
 * @template {{ dateKey: string }} T
 * @param {readonly T[]} published  newest first
 * @param {string} todayKey
 * @returns {(T & { isToday: boolean }) | null}
 */
export function pickDisplayQuiz(published, todayKey) {
  const oldest = shiftDateKey(todayKey, -STALE_DAYS);
  for (const quiz of published ?? []) {
    if (!quiz?.dateKey || quiz.dateKey > todayKey) continue;
    if (quiz.dateKey < oldest) return null;
    return { ...quiz, isToday: quiz.dateKey === todayKey };
  }
  return null;
}
