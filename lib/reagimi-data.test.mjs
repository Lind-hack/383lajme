import assert from "node:assert/strict";
import test from "node:test";

import {
  REACTIONS,
  isReactionKey,
  reactionLabel,
  dateKeyInKosovo,
  shiftDateKey,
  previousDateKey,
  formatAlbanianDate,
  relativeDayLabel,
  emptyCounts,
  tallyReactions,
  reactionPercentages,
  formatCount,
  THOUSANDS_SEPARATOR,
  reactionCountLabel,
  advanceStreak,
  activeStreak,
  parseStreak,
  pickFallbackArticle,
  viewFromRecord,
  viewFromArticle,
  resolveView,
  youtubeId,
  thumbnailCandidates,
} from "./reagimi-data.ts";

// ── vocabulary ───────────────────────────────────────────────────────────────

test("reaction vocabulary is five stable keys matching the DB CHECK constraint", () => {
  assert.deepEqual(
    REACTIONS.map((r) => r.key),
    ["zemerim", "dyshim", "qesharake", "dakord", "shprese"]
  );
  for (const r of REACTIONS) {
    assert.ok(r.label.length > 0, `${r.key} needs an Albanian label`);
    assert.ok(r.icon.length > 0, `${r.key} needs an icon`);
  }
});

test("isReactionKey rejects anything outside the vocabulary", () => {
  assert.equal(isReactionKey("dakord"), true);
  assert.equal(isReactionKey("nope"), false);
  assert.equal(isReactionKey(""), false);
  assert.equal(isReactionKey(null), false);
  assert.equal(isReactionKey(undefined), false);
  assert.equal(isReactionKey(7), false);
  assert.equal(isReactionKey({}), false);
});

test("reactionLabel falls back to the key rather than rendering undefined", () => {
  assert.equal(reactionLabel("zemerim"), "Zemërim");
  assert.equal(reactionLabel("unknown"), "unknown");
});

// ── dates ────────────────────────────────────────────────────────────────────

test("dateKeyInKosovo returns a YYYY-MM-DD key", () => {
  assert.match(dateKeyInKosovo(new Date("2026-08-16T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("dateKeyInKosovo rolls at Kosovo midnight, not UTC midnight", () => {
  // 22:30 UTC on 16 Aug is already 00:30 on 17 Aug in Kosovo (CEST, UTC+2).
  // The shipped DailyPoll uses toISOString() and would still say the 16th here.
  assert.equal(dateKeyInKosovo(new Date("2026-08-16T22:30:00Z")), "2026-08-17");
  assert.equal(dateKeyInKosovo(new Date("2026-08-16T21:59:00Z")), "2026-08-16");
});

test("dateKeyInKosovo handles winter offset (CET, UTC+1)", () => {
  assert.equal(dateKeyInKosovo(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
  assert.equal(dateKeyInKosovo(new Date("2026-01-15T22:30:00Z")), "2026-01-15");
});

test("shiftDateKey crosses months, years and leap days without DST drift", () => {
  assert.equal(shiftDateKey("2026-08-16", 1), "2026-08-17");
  assert.equal(shiftDateKey("2026-08-31", 1), "2026-09-01");
  assert.equal(shiftDateKey("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDateKey("2028-02-28", 1), "2028-02-29"); // 2028 is a leap year
  assert.equal(shiftDateKey("2027-02-28", 1), "2027-03-01");
  // Across the European DST switch (last Sunday of March 2026 = the 29th).
  assert.equal(shiftDateKey("2026-03-28", 1), "2026-03-29");
  assert.equal(shiftDateKey("2026-03-29", 1), "2026-03-30");
});

test("previousDateKey is the inverse of a one-day shift", () => {
  assert.equal(previousDateKey("2026-08-16"), "2026-08-15");
  assert.equal(previousDateKey("2026-01-01"), "2025-12-31");
});

test("formatAlbanianDate renders Albanian weekday and month names", () => {
  // 2026-08-16 is a Sunday.
  assert.equal(formatAlbanianDate("2026-08-16"), "E diel, 16 gusht");
  assert.equal(formatAlbanianDate("2026-08-17"), "E hënë, 17 gusht");
  assert.equal(formatAlbanianDate("2026-01-01"), "E enjte, 1 janar");
  assert.equal(formatAlbanianDate("2026-12-25"), "E premte, 25 dhjetor");
});

test("formatAlbanianDate returns empty string for malformed input rather than NaN", () => {
  assert.equal(formatAlbanianDate(""), "");
  assert.equal(formatAlbanianDate("not-a-date"), "");
});

test("relativeDayLabel says Sot / Dje and otherwise the full date", () => {
  assert.equal(relativeDayLabel("2026-08-16", "2026-08-16"), "Sot");
  assert.equal(relativeDayLabel("2026-08-15", "2026-08-16"), "Dje");
  assert.equal(relativeDayLabel("2026-08-10", "2026-08-16"), "E hënë, 10 gusht");
});

// ── tally ────────────────────────────────────────────────────────────────────

test("emptyCounts has a zero for every reaction", () => {
  const c = emptyCounts();
  assert.equal(Object.keys(c).length, REACTIONS.length);
  assert.ok(Object.values(c).every((v) => v === 0));
});

test("tallyReactions counts and picks the top reaction", () => {
  const t = tallyReactions([
    { reaction: "zemerim" },
    { reaction: "zemerim" },
    { reaction: "dakord" },
  ]);
  assert.equal(t.total, 3);
  assert.equal(t.counts.zemerim, 2);
  assert.equal(t.counts.dakord, 1);
  assert.equal(t.top, "zemerim");
});

test("tallyReactions ignores rows outside the vocabulary", () => {
  const t = tallyReactions([{ reaction: "zemerim" }, { reaction: "sabotage" }, { reaction: "" }]);
  assert.equal(t.total, 1);
  assert.equal(t.top, "zemerim");
});

test("tallyReactions on an empty list has no top", () => {
  const t = tallyReactions([]);
  assert.equal(t.total, 0);
  assert.equal(t.top, null);
});

test("tallyReactions breaks ties in declaration order, so the UI is stable", () => {
  const t = tallyReactions([{ reaction: "dakord" }, { reaction: "zemerim" }]);
  assert.equal(t.top, "zemerim"); // zemerim is declared first
});

test("reactionPercentages always sums to exactly 100", () => {
  // 3 reactions across 5 buckets is the classic case that naive rounding renders as 99%.
  const cases = [
    [{ reaction: "zemerim" }, { reaction: "dyshim" }, { reaction: "qesharake" }],
    [
      { reaction: "zemerim" },
      { reaction: "dyshim" },
      { reaction: "qesharake" },
      { reaction: "dakord" },
      { reaction: "shprese" },
      { reaction: "shprese" },
    ],
  ];
  for (const rows of cases) {
    const pct = reactionPercentages(tallyReactions(rows));
    const sum = Object.values(pct).reduce((a, b) => a + b, 0);
    assert.equal(sum, 100, `expected 100, got ${sum}`);
  }
});

test("reactionPercentages is all zeros when nobody has reacted", () => {
  const pct = reactionPercentages(tallyReactions([]));
  assert.ok(Object.values(pct).every((v) => v === 0));
});

test("reactionPercentages gives a lone reaction 100 percent", () => {
  const pct = reactionPercentages(tallyReactions([{ reaction: "dakord" }]));
  assert.equal(pct.dakord, 100);
});

test("formatCount groups thousands with a NO-BREAK space, not a plain one", () => {
  assert.equal(THOUSANDS_SEPARATOR, " ");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(42), "42");
  assert.equal(formatCount(999), "999", "no separator below four digits");
  assert.equal(formatCount(1249), "1 249");
  assert.equal(formatCount(1000000), "1 000 000");
  assert.equal(formatCount(-5), "0", "negative counts clamp rather than render a minus");
  assert.equal(formatCount(12.7), "12", "fractional counts truncate");
  // Guard the actual regression: a plain space would let the number wrap mid-value.
  assert.ok(!formatCount(1249).includes(" "), "must not contain a plain space");
});

test("reactionCountLabel handles zero, one and many in Albanian", () => {
  assert.equal(reactionCountLabel(0), "Bëhu i pari që reagon");
  assert.equal(reactionCountLabel(1), "1 person reagoi");
  assert.equal(reactionCountLabel(1249), "1 249 reaguan");
});

// ── streak ───────────────────────────────────────────────────────────────────

test("advanceStreak starts at one with no history", () => {
  assert.deepEqual(advanceStreak(null, "2026-08-16"), { lastDate: "2026-08-16", count: 1 });
});

test("advanceStreak increments on consecutive days", () => {
  const d1 = advanceStreak(null, "2026-08-14");
  const d2 = advanceStreak(d1, "2026-08-15");
  const d3 = advanceStreak(d2, "2026-08-16");
  assert.equal(d3.count, 3);
  assert.equal(d3.lastDate, "2026-08-16");
});

test("advanceStreak does not double count the same day", () => {
  const first = advanceStreak(null, "2026-08-16");
  assert.deepEqual(advanceStreak(first, "2026-08-16"), first);
});

test("advanceStreak resets after a missed day", () => {
  const stale = { lastDate: "2026-08-10", count: 9 };
  assert.deepEqual(advanceStreak(stale, "2026-08-16"), { lastDate: "2026-08-16", count: 1 });
});

test("activeStreak only counts today or yesterday", () => {
  assert.equal(activeStreak({ lastDate: "2026-08-16", count: 4 }, "2026-08-16"), 4);
  assert.equal(activeStreak({ lastDate: "2026-08-15", count: 4 }, "2026-08-16"), 4);
  assert.equal(activeStreak({ lastDate: "2026-08-14", count: 4 }, "2026-08-16"), 0);
  assert.equal(activeStreak(null, "2026-08-16"), 0);
});

test("parseStreak survives absent, malformed and legacy-shaped localStorage", () => {
  assert.equal(parseStreak(null), null);
  assert.equal(parseStreak(""), null);
  assert.equal(parseStreak("{{{"), null);
  assert.equal(parseStreak("null"), null);
  assert.equal(parseStreak('"a string"'), null);
  assert.equal(parseStreak("[]"), null);
  assert.equal(parseStreak('{"count":3}'), null); // legacy shape, no lastDate
  assert.equal(parseStreak('{"lastDate":"nope","count":3}'), null);
  assert.equal(parseStreak('{"lastDate":"2026-08-16","count":0}'), null);
  assert.equal(parseStreak('{"lastDate":"2026-08-16","count":"3"}'), null);
  assert.deepEqual(parseStreak('{"lastDate":"2026-08-16","count":3}'), {
    lastDate: "2026-08-16",
    count: 3,
  });
});

// ── selection ────────────────────────────────────────────────────────────────

const article = (over) => ({
  id: "a1",
  slug: "slug-1",
  title: "Headline",
  source: "KosovaPress",
  category: "Kosovo",
  publishedAt: "2026-08-16T09:00:00Z",
  engagementScore: 5,
  ...over,
});

test("pickFallbackArticle only ever returns an article published today", () => {
  const articles = [
    article({ id: "old", publishedAt: "2026-08-11T09:00:00Z", engagementScore: 10 }),
    article({ id: "today", publishedAt: "2026-08-16T09:00:00Z", engagementScore: 3 }),
  ];
  const picked = pickFallbackArticle(articles, "2026-08-16");
  assert.equal(picked.id, "today", "a higher-scored stale article must never win");
});

test("pickFallbackArticle returns null when nothing was published today", () => {
  // This is the fix for the shipped "5d" card: no today article means no card.
  const articles = [article({ id: "old", publishedAt: "2026-08-11T09:00:00Z" })];
  assert.equal(pickFallbackArticle(articles, "2026-08-16"), null);
});

test("pickFallbackArticle takes the highest engagement among today's", () => {
  const articles = [
    article({ id: "lo", engagementScore: 2 }),
    article({ id: "hi", engagementScore: 9 }),
    article({ id: "mid", engagementScore: 5 }),
  ];
  assert.equal(pickFallbackArticle(articles, "2026-08-16").id, "hi");
});

test("pickFallbackArticle excludes the hero so the page never repeats itself", () => {
  const articles = [
    article({ id: "hero", engagementScore: 9 }),
    article({ id: "second", engagementScore: 4 }),
  ];
  assert.equal(pickFallbackArticle(articles, "2026-08-16", "hero").id, "second");
});

test("pickFallbackArticle tolerates a missing engagementScore", () => {
  const articles = [article({ id: "none", engagementScore: undefined })];
  assert.equal(pickFallbackArticle(articles, "2026-08-16").id, "none");
});

test("pickFallbackArticle ignores an empty publishedAt", () => {
  assert.equal(pickFallbackArticle([article({ publishedAt: "" })], "2026-08-16"), null);
});

// ── view models ──────────────────────────────────────────────────────────────

const record = {
  reagimiDate: "2026-08-16",
  quote: "Nuk do të ketë asnjë ndryshim.",
  speakerName: "Emri Mbiemri",
  speakerRole: "Ministër",
  contextLine: "Pas takimit në Bruksel",
  articleSlug: "takimi-ne-bruksel",
  videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
};

test("viewFromRecord marks the lead as quoted", () => {
  const v = viewFromRecord(record);
  assert.equal(v.source, "curated");
  assert.equal(v.quoted, true);
  assert.equal(v.lead, record.quote);
  assert.equal(v.attributionName, "Emri Mbiemri");
});

test("viewFromArticle is never quoted and attributes the outlet, not a person", () => {
  const v = viewFromArticle(article({ title: "BE: veprimet duhet të shmangen" }), "2026-08-16");
  assert.equal(v.source, "auto");
  assert.equal(v.quoted, false, "a headline must not render as someone's quote");
  assert.equal(v.attributionName, "KosovaPress");
});

test("resolveView prefers the curated record", () => {
  const v = resolveView(record, [article()], "2026-08-16");
  assert.equal(v.source, "curated");
});

test("resolveView falls back to today's article when uncurated", () => {
  const v = resolveView(null, [article()], "2026-08-16");
  assert.equal(v.source, "auto");
});

test("resolveView returns null when uncurated and nothing published today", () => {
  const v = resolveView(null, [article({ publishedAt: "2026-08-01T09:00:00Z" })], "2026-08-16");
  assert.equal(v, null);
});

// ── video ────────────────────────────────────────────────────────────────────

test("youtubeId parses every URL shape the data layer produces", () => {
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/watch?t=3&v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"), "dQw4w9WgXcQ");
});

test("youtubeId returns null for absent or unparseable input", () => {
  assert.equal(youtubeId(null), null);
  assert.equal(youtubeId(undefined), null);
  assert.equal(youtubeId(""), null);
  assert.equal(youtubeId("https://example.com/video"), null);
  assert.equal(youtubeId("https://youtu.be/tooshort"), null);
});

test("thumbnailCandidates prefers 16:9 sources over the letterboxed 4:3 hqdefault", () => {
  const c = thumbnailCandidates("dQw4w9WgXcQ");
  assert.match(c[0], /maxresdefault/);
  assert.match(c[1], /sddefault/);
  assert.match(c[2], /hqdefault/); // last resort only
  assert.equal(c.length, 3);
});
