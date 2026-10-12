import assert from "node:assert/strict";
import test from "node:test";

import {
  QUIZ_LENGTH,
  isAnswerSheet,
  isGrounded,
  isStoredQuiz,
  isTragedy,
  marksLine,
  numbersIn,
  pickDisplayQuiz,
  scoreAnswers,
  scoreVerdict,
  shareText,
  splitPercents,
  splitVerdict,
  splitVisible,
  validateQuestion,
} from "./kuizi-data.mjs";

const ARTICLE = {
  slug: "rryma-shtrenjtohet",
  title: "ZRRE miraton rritjen e çmimit të rrymës me 8 për qind nga 1 nëntori",
  excerpt: "Rregullatori i energjisë vendosi që tarifat për familjet të rriten për 1.250 konsumatorë të mëdhenj.",
  body: "Zyra e Rregullatorit për Energji (ZRRE) miratoi sot rritjen. Kurti tha se Qeveria do të subvencionojë familjet në nevojë.",
  category: "Ekonomi",
};
const BY_SLUG = new Map([[ARTICLE.slug, ARTICLE]]);

const GOOD = {
  q: "Sa për qind rritet çmimi i rrymës nga 1 nëntori?",
  options: ["5 për qind", "8 për qind", "12 për qind"],
  correct: 1,
  explain: "Fatura e familjeve rritet nga 1 nëntori; Qeveria premton subvencione për ata në nevojë.",
  slug: ARTICLE.slug,
  trap: "Shumica mendon se rritja është dyshifrore.",
};

test("numbers are compared without their separators", () => {
  assert.deepEqual(numbersIn("1.250 euro dhe 1,250 dhe 8"), ["1250", "1250", "8"]);
  assert.deepEqual(numbersIn("pa numra"), []);
});

test("a right answer must be backed by the article", () => {
  const text = `${ARTICLE.title} ${ARTICLE.excerpt} ${ARTICLE.body}`;
  assert.equal(isGrounded("8 për qind", text), true);
  assert.equal(isGrounded("9 për qind", text), false, "a number the article never states");
  assert.equal(isGrounded("Kurtit", text), true, "inflected name still matches its stem");
  assert.equal(isGrounded("Osmani", text), false, "a name the article never mentions");
});

test("a well-formed grounded question passes and is trimmed", () => {
  const res = validateQuestion({ ...GOOD, q: `  ${GOOD.q} ` }, BY_SLUG);
  assert.equal(res.ok, true);
  assert.equal(res.question.q, GOOD.q);
  assert.equal(res.question.category, "Ekonomi");
  assert.equal(res.question.difficulty, 2, "missing difficulty defaults to medium");
  assert.equal(validateQuestion({ ...GOOD, difficulty: 3 }, BY_SLUG).question.difficulty, 3);
});

test("questions are refused, never repaired", () => {
  const refuse = (patch, why) => {
    const res = validateQuestion({ ...GOOD, ...patch }, BY_SLUG);
    assert.equal(res.ok, false, why);
  };
  refuse({ slug: "nuk-ekziston" }, "unknown slug");
  refuse({ q: "Sa rritet rryma" }, "no question mark");
  refuse({ options: ["5 për qind", "8 për qind"] }, "too few options");
  refuse({ options: ["5 për qind", "8 për qind", "8 per qind"] }, "duplicate by accent");
  refuse({ options: ["5 për qind", "8 për qind", "Nuk e di"] }, "hedge option");
  refuse({ options: ["5 për qind", "8 për qind", "Të gjitha"] }, "all of the above");
  refuse({ correct: 3 }, "index out of range");
  refuse({ correct: "1" }, "index not an integer");
  refuse({ correct: 0 }, "right answer not in article");
  refuse({ explain: "" }, "no explanation");
  refuse({ explain: "Rritja vlen për 40 mijë familje." }, "number in explain not in article");
  refuse({ q: "A rritet rryma me 20 për qind nga nëntori?" }, "number in question not in article");
  refuse({ options: ["Shumë pak", "8 për qind", "Pak më shumë"] }, "only the right option is a number");
  refuse({ trap: "" }, "no trap named");
  refuse({ q: "Cili institucion nuk e miratoi rritjen e rrymës?" }, "lowercase negation");
});

test("a capitalised NUK question is allowed", () => {
  const res = validateQuestion({ ...GOOD, q: "Cili institucion NUK e kundërshtoi rritjen e rrymës?" }, BY_SLUG);
  assert.equal(res.ok, true);
});

test("stories about death and violence never become trivia", () => {
  assert.equal(isTragedy({ title: "Dy të vdekur në aksident në Ferizaj" }), true);
  assert.equal(isTragedy({ title: "U vra një burrë në Pejë" }), true);
  assert.equal(isTragedy({ title: "Femicid në Prishtinë" }), true);
  assert.equal(isTragedy(ARTICLE), false);
  assert.equal(isTragedy({ title: "Vrapimi i Prishtinës mbledh 3 mijë vrapues" }), false);

  const sad = { ...ARTICLE, slug: "x", title: "Humbi jetën punëtori në kantier, 8 për qind" };
  const res = validateQuestion({ ...GOOD, slug: "x" }, new Map([["x", sad]]));
  assert.equal(res.ok, false);
});

test("stored quizzes need exactly five complete questions", () => {
  const five = Array.from({ length: QUIZ_LENGTH }, () => ({ ...GOOD, category: "" }));
  assert.equal(isStoredQuiz(five), true);
  assert.equal(isStoredQuiz(five.slice(0, 4)), false);
  assert.equal(isStoredQuiz([...five.slice(0, 4), { ...GOOD, correct: 9 }]), false);
  assert.equal(isStoredQuiz(null), false);
});

test("scoring, answer sheets and the share line", () => {
  const quiz = Array.from({ length: 5 }, () => GOOD);
  const { marks, score } = scoreAnswers(quiz, [1, 1, 0, 1, 2]);
  assert.deepEqual(marks, [true, true, false, true, false]);
  assert.equal(score, 3);
  assert.equal(marksLine(marks), "■■□■□");
  assert.equal(isAnswerSheet([1, 1, 0, 1, 2], quiz), true);
  assert.equal(isAnswerSheet([1, 1, 0, 1], quiz), false);
  assert.equal(isAnswerSheet([1, 1, 0, 1, 3], quiz), false);
  assert.equal(scoreAnswers(quiz, null).score, 0);
  assert.equal(
    shareText({ dateLabel: "12 tetor", score, marks, url: "https://383ks.com/kuiz" }),
    "Kuizi i ditës · 12 tetor · 3/5 ■■□■□\nhttps://383ks.com/kuiz"
  );
  assert.ok(scoreVerdict(5) && scoreVerdict(0));
});

test("a split shows only with enough answers, and always sums to 100", () => {
  assert.equal(splitVisible(4), false);
  assert.equal(splitVisible(5), true);
  assert.equal(splitVisible(NaN), false);
  assert.deepEqual(splitPercents([1, 1, 1, 0], 3), { total: 3, pct: [34, 33, 33] });
  assert.deepEqual(splitPercents([0, 0, 0, 0], 3), { total: 0, pct: [0, 0, 0] });
  assert.deepEqual(splitPercents([3, 1, 0, 9], 3).total, 4, "slots past the options are ignored");
  const { pct } = splitPercents([7, 3, 2, 1], 4);
  assert.equal(pct.reduce((a, b) => a + b, 0), 100);
});

test("the split line names the surprise", () => {
  assert.equal(splitVerdict([38, 51, 9, 2], 0, true), "Shumica gaboi. Ti jo.");
  assert.match(splitVerdict([38, 51, 9, 2], 0, false), /kurth/);
  assert.match(splitVerdict([12, 60, 28], 0, true), /Vetëm 12%/);
  assert.match(splitVerdict([85, 10, 5], 0, false), /85%/);
  assert.equal(splitVerdict([55, 30, 15], 0, true), null);
});

test("the card never passes an old quiz off as today's", () => {
  const q = (dateKey) => ({ dateKey });
  assert.deepEqual(pickDisplayQuiz([q("2026-10-12"), q("2026-10-11")], "2026-10-12"), {
    dateKey: "2026-10-12",
    isToday: true,
  });
  assert.deepEqual(pickDisplayQuiz([q("2026-10-11")], "2026-10-12"), {
    dateKey: "2026-10-11",
    isToday: false,
  });
  assert.equal(pickDisplayQuiz([q("2026-10-10")], "2026-10-12"), null, "two days old");
  assert.deepEqual(pickDisplayQuiz([q("2026-10-13"), q("2026-10-12")], "2026-10-12"), {
    dateKey: "2026-10-12",
    isToday: true,
  }, "a future-dated row is skipped");
  assert.equal(pickDisplayQuiz([], "2026-10-12"), null);
});

test("an explanation must add a fact, not commentary", () => {
  const res = validateQuestion(
    { ...GOOD, explain: "Kjo tregon rëndësinë e energjisë për familjet." },
    BY_SLUG
  );
  assert.equal(res.ok, false);
  assert.match(res.reason, /koment/);
});
