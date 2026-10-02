// Unit tests for the tone module's pure functions.
//
// The Python side (tools/test_tone_scraper.py) covers the pipeline that
// produces the data; this covers the code that reads it. The two share a
// definition of "confident" and of the index arithmetic, and both are
// asserted here against the same numbers the scraper uses.
//
// Node 24 strips TypeScript types natively, so these import the .ts modules
// directly rather than duplicating them into .mjs.

import assert from "node:assert/strict";
import test from "node:test";

import { titleKeywords, getTopics, summarizeToneHistory, summarizeToday, getDailyStories, CURRENT_STANCE_VERSION, withoutOutletSuffix } from "./tone-data.ts";
import {
  coverageOf,
  formatAge,
  toneLabel,
  toneFill,
  verdictSentence,
  flagToCode,
  formatArticleDate,
  BAND,
} from "./tone-scale.ts";

/* ── titleKeywords ─────────────────────────────────────────────────────── */

test("titleKeywords keeps Albanian words whole", () => {
  // The bug this exists for: /\W+/ classes ë and ç as non-word characters,
  // so "kundër" split into "kund" + "r" and topic labels came out as stems.
  const words = titleKeywords("Kundër pavarësisë së Kosovës");
  assert.ok(words.has("kundër"), "kundër must survive as one token");
  assert.ok(words.has("pavarësisë"), "pavarësisë must survive as one token");
  assert.ok(!words.has("kund"), "no diacritic-truncated fragments");
});

test("titleKeywords drops short words and punctuation", () => {
  const words = titleKeywords("BE-ja dhe SHBA: një marrëveshje e re");
  assert.ok(words.has("marrëveshje"));
  assert.ok(!words.has("dhe"), "3-letter words are below the length floor");
  assert.ok(![...words].some((w) => w.includes(":")), "punctuation is stripped");
});

/* ── getTopics ─────────────────────────────────────────────────────────── */

/** Builds a cache whose entries are all recent enough to be in-window. */
function cacheOf(titles) {
  const now = new Date().toISOString();
  const articles = {};
  titles.forEach(([albanianTitle, sentiment, country], i) => {
    articles[`k${i}`] = {
      key: `k${i}`,
      title: albanianTitle,
      albanianTitle,
      translated: true,
      url: `https://example.com/${i}`,
      googleNewsUrl: "",
      imageUrl: null,
      imageAttempts: 0,
      outlet: "Test Post",
      country: country ?? "Gjermani",
      sentiment,
      date: "2026-08-14",
      firstSeen: now,
      lastSeen: now,
    };
  });
  return { version: 1, articles };
}

test("getTopics returns nothing without a cache", () => {
  assert.deepEqual(getTopics(null), []);
  assert.deepEqual(getTopics({ version: 1, articles: {} }), []);
});

test("getTopics drops clusters below minArticles", () => {
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "neutral"],
    ["Parlamenti diskutoi buxhetin", "neutral"],
  ]);
  assert.equal(getTopics(cache, { minArticles: 4 }).length, 0);
  assert.ok(getTopics(cache, { minArticles: 2 }).length > 0);
});

test("getTopics folds inflected forms into one cluster", () => {
  // Albanian is heavily inflected and there is no stemmer here; the 6-char
  // fold is what makes parlamenti/parlamentin/parlamentare one subject.
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "neutral"],
    ["Parlamentin e pret një votim", "neutral"],
    ["Zgjedhjet parlamentare nisin", "neutral"],
    ["Parlamentit i mungon kuorumi", "neutral"],
  ]);
  const topics = getTopics(cache, { minArticles: 4 });
  assert.equal(topics.length, 1, "all four are one topic, not four");
  assert.equal(topics[0].count, 4);
});

test("getTopics excludes the kosov* family from labels", () => {
  // It appears in nearly every headline, so unchecked it is the only cluster
  // and the label says nothing.
  const cache = cacheOf([
    ["Kosova nënshkroi marrëveshjen tregtare", "neutral"],
    ["Kosovës i hapet marrëveshja tregtare", "neutral"],
    ["Marrëveshja tregtare hyn në fuqi për Kosovën", "neutral"],
    ["Kosova pret marrëveshjen tregtare", "neutral"],
  ]);
  const topics = getTopics(cache, { minArticles: 4 });
  assert.equal(topics.length, 1);
  assert.ok(
    !/kosov/i.test(topics[0].label),
    `label must not be built from the kosov* family, got "${topics[0].label}"`
  );
});

test("getTopics ignores untranslated entries", () => {
  // A topic list in German on an Albanian homepage is worse than a short one.
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "neutral"],
    ["Parlamenti diskutoi buxhetin", "neutral"],
    ["Parlamenti votoi buxhetin", "neutral"],
    ["Parlamenti shtyu buxhetin", "neutral"],
  ]);
  for (const k of ["k0", "k1"]) {
    cache.articles[k].albanianTitle = null;
    cache.articles[k].translated = false;
  }
  assert.equal(getTopics(cache, { minArticles: 4 }).length, 0);
  assert.equal(getTopics(cache, { minArticles: 2 })[0].count, 2);
});

test("getTopics scores a topic on the same scale as a country", () => {
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "positive"],
    ["Parlamenti diskutoi buxhetin", "positive"],
    ["Parlamenti votoi buxhetin", "neutral"],
    ["Parlamenti shtyu buxhetin", "negative"],
  ]);
  const [t] = getTopics(cache, { minArticles: 4 });
  assert.equal(t.positive, 2);
  assert.equal(t.neutral, 1);
  assert.equal(t.negative, 1);
  // 50 + 50 * (2 - 1) / (2 + 1 + 3) — identical to country_index in tone_scraper.py.
  assert.equal(t.index, 58);
});

test("getTopics leads with the ends of the scale, not the neutral bulk", () => {
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "neutral"],
    ["Parlamenti diskutoi buxhetin", "neutral"],
    ["Parlamenti votoi buxhetin", "negative"],
    ["Parlamenti shtyu buxhetin", "positive"],
  ]);
  const [t] = getTopics(cache, { minArticles: 4 });
  assert.equal(t.articles[0].sentiment, "negative");
  assert.equal(t.articles[1].sentiment, "positive");
});

test("getTopics respects the time window", () => {
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "neutral"],
    ["Parlamenti diskutoi buxhetin", "neutral"],
    ["Parlamenti votoi buxhetin", "neutral"],
    ["Parlamenti shtyu buxhetin", "neutral"],
  ]);
  const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
  for (const a of Object.values(cache.articles)) a.firstSeen = old;
  assert.equal(getTopics(cache, { minArticles: 2 }).length, 0);
  assert.ok(getTopics(cache, { minArticles: 2, windowHours: 24 * 60 }).length > 0);
});

test("getTopics honours the limit and sorts by size", () => {
  const cache = cacheOf([
    ["Parlamenti miratoi buxhetin", "neutral"],
    ["Parlamenti diskutoi buxhetin", "neutral"],
    ["Parlamenti votoi buxhetin", "neutral"],
    ["Zgjedhjet nisin nesër", "neutral"],
    ["Zgjedhjet përfunduan sot", "neutral"],
  ]);
  const topics = getTopics(cache, { minArticles: 2, limit: 1 });
  assert.equal(topics.length, 1);
  assert.equal(topics[0].count, 3, "the larger cluster wins the single slot");
});

/* ── coverage and staleness ────────────────────────────────────────────── */

test("coverageOf reports what the index rests on", () => {
  assert.equal(coverageOf({ n: 5, excluded: 70 }), 5 / 75);
  assert.equal(coverageOf({ n: 77, excluded: 0 }), 1);
  assert.equal(coverageOf({ n: 10 }), 1, "a missing field is not zero coverage");
  assert.equal(coverageOf({ n: 0, excluded: 0 }), 0, "no division by zero");
});

test("formatAge speaks Albanian and rounds like a person", () => {
  assert.equal(formatAge(3.2), "3 orësh");
  assert.equal(formatAge(47), "47 orësh");
  assert.equal(formatAge(72), "3 ditësh");
  assert.ok(formatAge(null).length > 0);
});

const row = (date, overrides = {}) => ({
  date,
  overallIndex: 50,
  totalArticles: 100,
  sourceCount: 10,
  countries: { Gjermani: { index: 50, positive: 0, neutral: 100, negative: 0, n: 20, confident: true } },
  headlines: [],
  stanceVersion: 2,
  ...overrides,
});

test("summarizeToneHistory reports no data rather than zeros", () => {
  const s = summarizeToneHistory([]);
  assert.equal(s.hasData, false);
  assert.equal(s.overallIndex, null);
  assert.equal(s.isStale, false);
});

test("summarizeToneHistory flags a stalled pipeline", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(summarizeToneHistory([row(today)]).isStale, false);

  const old = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const stale = summarizeToneHistory([row(old)]);
  assert.equal(stale.isStale, true);
  assert.ok(stale.ageHours > 36);
});

test("summarizeToneHistory refuses a delta across the methodology break", () => {
  // 2026-08-10 changed what the index measures. Subtracting across that
  // boundary would report a definition change as a swing in world opinion.
  const dates = ["01", "02", "03", "04", "05", "06", "07", "08"].map((d) => `2026-08-${d}`);
  const mixed = dates.map((d, i) =>
    row(d, { overallIndex: 40 + i, stanceVersion: i === 0 ? 1 : 2 })
  );
  assert.equal(summarizeToneHistory(mixed).weekDelta, null);

  const uniform = dates.map((d, i) => row(d, { overallIndex: 40 + i }));
  assert.equal(summarizeToneHistory(uniform).weekDelta, 7);
});

test("summarizeToneHistory carries excluded through to the countries", () => {
  const s = summarizeToneHistory([
    row("2026-08-14", {
      countries: {
        Greqi: { index: 50, positive: 0, neutral: 100, negative: 0, n: 5, excluded: 70, confident: false },
      },
    }),
  ]);
  assert.equal(s.countries[0].excluded, 70);
  assert.equal(coverageOf(s.countries[0]), 5 / 75);
});

/* ── the scale ─────────────────────────────────────────────────────────── */

test("toneLabel and verdictSentence agree on the neutral middle", () => {
  assert.match(toneLabel(50).toLowerCase(), /neutral/);
  assert.match(verdictSentence(50), /neutral/i);
  assert.notEqual(toneLabel(BAND.lo), toneLabel(BAND.hi));
  assert.equal(verdictSentence(null).includes("Ende"), true);
});

test("toneFill is defined across the whole scale and clamps outside it", () => {
  for (const v of [0, 20, 35, 50, 65, 80, 100]) {
    assert.match(toneFill(v), /^#|^rgb/, `no fill for ${v}`);
  }
  assert.equal(toneFill(0), toneFill(BAND.lo), "below the band clamps to its floor");
  assert.equal(toneFill(100), toneFill(BAND.hi), "above the band clamps to its ceiling");
});

test("flagToCode decodes regional indicators and rejects junk", () => {
  assert.equal(flagToCode("🇩🇪"), "DE");
  assert.equal(flagToCode("🇽🇰"), "XK");
  assert.equal(flagToCode(""), "");
  assert.equal(flagToCode("abc"), "");
});

/* ── article dates ─────────────────────────────────────────────────────── */

test("formatArticleDate renders ISO and refuses legacy fragments", () => {
  assert.equal(formatArticleDate("2026-08-09"), "9 gush");
  assert.equal(formatArticleDate("2026-01-31"), "31 jan");
  assert.equal(formatArticleDate("2026-12-01"), "1 dhj");
  // ~200 cached entries predate the scraper's date fix and hold a [:10]
  // slice of the raw RFC-822 string, cut mid-month-name. A missing date
  // costs a reader nothing; a broken one costs the page its credibility.
  assert.equal(formatArticleDate("Sun, 09 Au"), null);
  assert.equal(formatArticleDate("Thu, 06 Au"), null);
  assert.equal(formatArticleDate(""), null);
  assert.equal(formatArticleDate(null), null);
  assert.equal(formatArticleDate("2026-13-01"), null, "an impossible month is not a date");
});

test("a missing stanceVersion stamp cannot fake a clean methodology break", () => {
  // 08-12 and 08-13 were produced under v2 but written before the scraper
  // stamped the field, so they read as v1 between two v2 rows. A delta must
  // still refuse to cross the real boundary at the start of the series.
  const rows = [
    row("2026-08-08", { overallIndex: 39, stanceVersion: 1 }),
    row("2026-08-09", { overallIndex: 51, stanceVersion: 2 }),
    row("2026-08-12", { overallIndex: 52, stanceVersion: 1 }),
    row("2026-08-13", { overallIndex: 52, stanceVersion: 2 }),
  ];
  assert.equal(summarizeToneHistory(rows).weekDelta, null);
});

// ── The daily reading (stance v4) ─────────────────────────────────────────

const v4row = (date, index, extra = {}) => ({
  date, overallIndex: index, totalArticles: 10, sourceCount: 5,
  stanceVersion: CURRENT_STANCE_VERSION, countries: {}, headlines: [], ...extra,
});

test("summarizeToday compares with the previous v4 day, never an older definition", () => {
  const t = summarizeToday([
    { ...v4row("2026-09-27", 51), stanceVersion: 3 },
    v4row("2026-09-29", 46),
    v4row("2026-09-30", 52, { day: { index: 52, positive: 4, neutral: 9, negative: 2, unknown: 0, n: 15, sourceCount: 8 } }),
  ]);
  assert.equal(t.index, 52);
  assert.deepEqual(t.previous, { date: "2026-09-29", index: 46 });
  assert.equal(t.delta, 6);
  assert.deepEqual(t.counts, { positive: 4, neutral: 9, negative: 2 });
  // Seven calendar days ending today; the v3 row and the missing day are gaps.
  assert.deepEqual(t.week.map((d) => d.index), [null, null, null, null, null, 46, 52]);
  assert.equal(t.week[6].date, "2026-09-30");
});

test("summarizeToday reports no delta when there is nothing comparable", () => {
  const t = summarizeToday([{ ...v4row("2026-09-29", 50), stanceVersion: 3 }, v4row("2026-09-30", 44)]);
  assert.equal(t.previous, null);
  assert.equal(t.delta, null);
});

const outletsOf = (articles) => ({
  lastUpdated: "2026-09-30", overallIndex: 50, totalArticles: 0, sourceCount: 0,
  countries: {
    Gjermani: {
      summary: { index: 50, positive: 0, neutral: 0, negative: 0, n: 0, confident: true },
      outlets: articles.map(([outlet, title, sentiment, firstSeen = "2026-09-30", version = CURRENT_STANCE_VERSION]) => ({
        name: outlet, sentiment, articleCount: 1,
        articles: [{ title, albanianTitle: title, url: `https://x/${outlet}/${title}`, date: firstSeen, sentiment, firstSeen, stanceVersion: version }],
      })),
    },
  },
});

test("getDailyStories puts good and bad news first and merges one event across outlets", () => {
  const stories = getDailyStories(outletsOf([
    ["A", "Parlamenti miraton buxhetin e ri", "neutral"],
    ["B", "Kosova fiton ndeshjen ndaj Qipros në Nicosia", "positive"],
    ["C", "Kosova fiton ndeshjen ndaj Qipros në Nicosia sonte", "positive"],
    ["D", "Protesta të dhunshme në veri të Kosovës", "negative"],
    ["E", "Takimi i radhës në Bruksel", "neutral"],
    ["F", "Delegacioni viziton Prishtinën", "neutral"],
  ]), "2026-09-30");
  assert.deepEqual(stories.map((s) => s.sentiment), ["positive", "negative", "neutral", "neutral", "neutral"]);
  assert.equal(stories[0].alsoIn.length, 1, "the two match reports are one story");
});

test("Bota can retain every publisher article while homepage event grouping remains unchanged", () => {
 const data=outletsOf([['A','Kosova fiton ndeshjen ndaj Qipros në Nicosia','positive'],['B','Kosova fiton ndeshjen ndaj Qipros në Nicosia sonte','positive']]);
 assert.equal(getDailyStories(data,'2026-09-30').length,1);
 const all=getDailyStories(data,'2026-09-30',false);
 assert.equal(all.length,2);assert.equal(new Set(all.map(a=>a.url)).size,2);assert.ok(all.every(a=>a.alsoIn.length===0));
});

test("getDailyStories skips labels from an older definition", () => {
  const stories = getDailyStories(outletsOf([
    ["A", "Lajm i vjetër", "neutral", "2026-09-30", 3],
    ["B", "Lajm i ri", "positive"],
  ]), "2026-09-30");
  assert.deepEqual(stories.map((s) => s.title), ["Lajm i ri"]);
});

test("getDailyStories adds yesterday on a thin morning, marked by day", () => {
  const stories = getDailyStories(outletsOf([
    ["A", "Lajmi i sotëm për Kosovën", "negative"],
    ["B", "Lajmi i djeshëm për ekonominë", "positive", "2026-09-29"],
  ]), "2026-09-30");
  assert.deepEqual(stories.map((s) => s.day), ["2026-09-30", "2026-09-29"]);
});

test("withoutOutletSuffix drops only a suffix that names the outlet", () => {
  assert.equal(withoutOutletSuffix("Protestat përfshijnë Kosovën - il Nord Est", "il Nord Est"), "Protestat përfshijnë Kosovën");
  assert.equal(withoutOutletSuffix("Muriqi shënon - on.orf.at", "on.orf.at"), "Muriqi shënon");
  assert.equal(withoutOutletSuffix("Austri - Kosovë 2:0", "Kronen Zeitung"), "Austri - Kosovë 2:0");
});
