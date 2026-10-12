import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDIDATES,
  KUIZ_SYSTEM_PROMPT,
  assembleQuiz,
  buildQuizPrompt,
  selectQuizArticles,
  shuffleOptions,
} from "./kuizi-draft.mjs";
import { validateQuestion } from "./kuizi-data.mjs";

const NOW = new Date("2026-10-12T06:30:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600_000).toISOString();

/** Letter tag per article, so answers carry no digits. */
const tag = (n) => "ABCDEFGHIJ"[n];

/** An article whose title states the answer "Opsioni<tag>", so it grounds. */
function article(n, { local = false, hours = 2, title } = {}) {
  return {
    slug: `lajm-${n}`,
    title: title ?? `${local ? "Prishtina" : "Brukseli"} vendos për Opsioni${tag(n)} sot`,
    excerpt: `Përmbledhje e lajmit ${n}.`,
    body: `Teksti i lajmit ${n}.`,
    category: local ? "Kosovo" : "Botë",
    publishedAt: hoursAgo(hours),
  };
}

function candidate(n) {
  return {
    q: `Çfarë u vendos në lajmin me shenjën ${tag(n)}?`,
    options: [`Opsioni${tag(n)}`, "Diçka tjetër krejt", "Një vendim i tretë"],
    correct: 0,
    explain: `Lajmi ${n} prek lexuesit këtu.`,
    trap: "Titulli të çon gabim.",
    slug: `lajm-${n}`,
  };
}

test("only fresh, non-tragic articles are offered, local first", () => {
  const picked = selectQuizArticles(
    [
      article(1, { hours: 30 }),
      article(2),
      article(3, { local: true }),
      article(4, { local: true, title: "Aksident në Prishtinë, dy të plagosur" }),
      { ...article(5), publishedAt: "nuk-eshte-date" },
    ],
    NOW
  );
  assert.deepEqual(picked.map((a) => a.slug), ["lajm-3", "lajm-2"]);
});

test("the prompt carries slugs, local tags and the body the validator checks", () => {
  const prompt = buildQuizPrompt([{ ...article(1, { local: true }), body: "x ".repeat(2000) }]);
  assert.match(prompt, /\[LOKALE\]/);
  assert.match(prompt, /slug: lajm-1/);
  assert.ok(prompt.length < 1200, "body is clipped");
  assert.match(KUIZ_SYSTEM_PROMPT, new RegExp(`${CANDIDATES} pyetje`));
});

test("five valid questions from different articles become the quiz", () => {
  const articles = [1, 2, 3, 4, 5, 6].map((n) => article(n, { local: n <= 2 }));
  const raw = { questions: [3, 4, 5, 6, 1, 2].map((n) => ({ ...candidate(n), difficulty: n % 3 + 1 })) };
  const res = assembleQuiz(raw, articles, "2026-10-12");
  assert.equal(res.ok, true);
  const levels = res.questions.map((q) => q.difficulty);
  assert.deepEqual(levels, [...levels].sort(), "easiest first");
  assert.equal(res.questions.length, 5);
  const slugs = res.questions.map((q) => q.slug);
  assert.equal(new Set(slugs).size, 5);
  assert.ok(slugs.includes("lajm-1") && slugs.includes("lajm-2"), "both local questions kept");

  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  for (const q of res.questions) {
    assert.equal(validateQuestion(q, bySlug).ok, true, "still valid after shuffling");
    assert.equal(q.options[q.correct], `Opsioni${tag(Number(q.slug.split("-")[1]))}`, "index follows the answer");
  }
});

test("refuses rather than pads when too few candidates survive", () => {
  const articles = [1, 2, 3, 4, 5].map((n) => article(n));
  const raw = {
    questions: [
      candidate(1),
      candidate(2),
      candidate(3),
      { ...candidate(4), slug: "e-shpikur" },
      { ...candidate(5), correct: 1 },
      candidate(3),
    ],
  };
  const res = assembleQuiz(raw, articles, "2026-10-12");
  assert.equal(res.ok, false);
  assert.equal(res.rejected.length, 3);
  assert.match(res.rejected.join(" "), /përdorur tashmë/);
});

test("requires local questions when the day has local stories", () => {
  const articles = [1, 2, 3, 4, 5, 6].map((n) => article(n, { local: n === 6 }));
  const raw = { questions: [1, 2, 3, 4, 5].map(candidate) };
  const res = assembleQuiz(raw, articles, "2026-10-12");
  assert.equal(res.ok, false);
  assert.match(res.reason, /lokale/);

  const worldOnly = [1, 2, 3, 4, 5].map((n) => article(n));
  assert.equal(assembleQuiz(raw, worldOnly, "2026-10-12").ok, true, "no local stories, no quota");
});

test("option order is shuffled, stable for a given seed, and keeps the answer", () => {
  const q = candidate(1);
  const a = shuffleOptions(q, "2026-10-12:0:lajm-1");
  const b = shuffleOptions(q, "2026-10-12:0:lajm-1");
  assert.deepEqual(a, b);
  assert.equal(a.options[a.correct], `Opsioni${tag(1)}`);
  const firsts = new Set(
    Array.from({ length: 20 }, (_, i) => shuffleOptions(q, `seed-${i}`).correct)
  );
  assert.ok(firsts.size > 1, "the right answer does not always land in the same place");
});

test("garbage from the model is a refusal, not a crash", () => {
  assert.equal(assembleQuiz(null, [], "2026-10-12").ok, false);
  assert.equal(assembleQuiz({ questions: "x" }, [], "2026-10-12").ok, false);
});

test("generateQuiz refuses a thin day without calling the model", async () => {
  const { generateQuiz } = await import("./kuizi-draft.mjs");
  let called = false;
  const res = await generateQuiz([article(1), article(2)], {
    now: NOW,
    dateKey: "2026-10-12",
    ask: async () => ((called = true), {}),
  });
  assert.equal(res.ok, false);
  assert.equal(called, false);
});

test("generateQuiz passes the selected pool to the model and assembles", async () => {
  const { generateQuiz } = await import("./kuizi-draft.mjs");
  const articles = [1, 2, 3, 4, 5].map((n) => article(n));
  let seenPrompt = "";
  const res = await generateQuiz(articles, {
    now: NOW,
    dateKey: "2026-10-12",
    ask: async (_system, user) => ((seenPrompt = user), { questions: [1, 2, 3, 4, 5].map(candidate) }),
  });
  assert.equal(res.ok, true);
  assert.equal(res.pool, 5);
  assert.match(seenPrompt, /slug: lajm-5/);
});

test("the judge drops trivia and ranks the rest", async () => {
  const { assembleQuiz, parseJudgeScores } = await import("./kuizi-draft.mjs");
  const articles = [1, 2, 3, 4, 5, 6, 7].map((n) => article(n));
  const raw = { questions: [1, 2, 3, 4, 5, 6, 7].map(candidate) };
  const scores = parseJudgeScores({
    scores: [
      { slug: "lajm-1", score: 2 },
      { slug: "lajm-2", score: 5 },
      { slug: "lajm-3", score: 3 },
      { slug: "lajm-4", score: 4 },
      { slug: "lajm-5", score: 1 },
      { slug: "lajm-6", score: 3 },
      { slug: "lajm-7", score: 4 },
      { slug: "x", score: 9 },
    ],
  });
  assert.equal(scores.has("x"), false, "out-of-range score ignored");
  const res = assembleQuiz(raw, articles, "2026-10-12", scores);
  assert.equal(res.ok, true);
  const slugs = res.questions.map((q) => q.slug).sort();
  assert.deepEqual(slugs, ["lajm-2", "lajm-3", "lajm-4", "lajm-6", "lajm-7"]);
  assert.equal(res.rejected.filter((r) => r.startsWith("Gjykatësi")).length, 2);
});

test("a judge that drops too much means no quiz, not a padded one", async () => {
  const { assembleQuiz } = await import("./kuizi-draft.mjs");
  const articles = [1, 2, 3, 4, 5].map((n) => article(n));
  const raw = { questions: [1, 2, 3, 4, 5].map(candidate) };
  const scores = new Map([["lajm-1", 1], ["lajm-2", 5], ["lajm-3", 5], ["lajm-4", 5], ["lajm-5", 5]]);
  assert.equal(assembleQuiz(raw, articles, "2026-10-12", scores).ok, false);
});

test("generateQuiz falls back to the model's order when the judge fails", async () => {
  const { generateQuiz } = await import("./kuizi-draft.mjs");
  const articles = [1, 2, 3, 4, 5].map((n) => article(n));
  let calls = 0;
  const res = await generateQuiz(articles, {
    now: NOW,
    dateKey: "2026-10-12",
    ask: async () => {
      calls += 1;
      if (calls >= 2) throw new Error("judge down");
      return { questions: [1, 2, 3, 4, 5].map(candidate) };
    },
  });
  assert.equal(calls, 3, "generator once, judge twice");
  assert.equal(res.ok, true);
  assert.equal(res.judged, false);
  assert.equal(res.judgeError, "judge down");
});
