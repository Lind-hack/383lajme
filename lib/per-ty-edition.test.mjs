import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEdition, readingMinutes, MIN_MINUTES } from "./per-ty-edition.mjs";

let n = 0;
const item = (reason, kind, extra = {}) => ({
  article: { slug: `s${++n}`, title: "Një titull me disa fjalë", excerpt: "Një përmbledhje e shkurtër.", ...extra },
  reason,
  kind,
});
const KURTI = "Sepse ndjek Albin Kurti";
const PRISHTINA = "Nga Prishtina";
const SPORT = "Sepse ndjek Sport";
const TOP = "Kryesoret e ditës";

const slugs = (items) => items.map((i) => i.article.slug);

test("the edition stops at its size", () => {
  const feed = [
    ...Array.from({ length: 4 }, () => item(KURTI, "person")),
    ...Array.from({ length: 4 }, () => item(PRISHTINA, "city")),
    ...Array.from({ length: 4 }, () => item(SPORT, "category")),
    ...Array.from({ length: 4 }, () => item(TOP, "top")),
  ];
  assert.equal(buildEdition(feed).edition.length, 7);
  assert.equal(buildEdition(feed, { size: 5 }).edition.length, 5);
});

test("one reason cannot fill the morning", () => {
  const feed = [...Array.from({ length: 6 }, () => item(KURTI, "person")), item(SPORT, "category"), item(TOP, "top")];
  const { edition } = buildEdition(feed);
  assert.equal(edition.filter((i) => i.reason === KURTI).length, 2);
  assert.deepEqual(
    edition.map((i) => i.reason),
    [KURTI, KURTI, SPORT, TOP]
  );
});

test("the day's general top stories take two slots at most", () => {
  // rankFeed mixes three in; a personal edition is not half general news.
  const feed = [
    item(KURTI, "person"), item(TOP, "top"), item(KURTI, "person"), item(KURTI, "person"),
    item(TOP, "top"), item(PRISHTINA, "city"), item(PRISHTINA, "city"), item(PRISHTINA, "city"),
    item(TOP, "top"), item(SPORT, "category"), item("Sepse ndjek Botë", "category"),
  ];
  const { edition } = buildEdition(feed);
  assert.deepEqual(
    edition.map((i) => i.reason),
    [KURTI, TOP, KURTI, TOP, PRISHTINA, PRISHTINA, SPORT]
  );
});

test("rank order is kept, whatever has been read", () => {
  // The edition knows nothing about reads: the same feed always gives the same
  // list, so opening a story never moves the others.
  const feed = [item(KURTI, "person"), item(PRISHTINA, "city"), item(TOP, "top"), item(SPORT, "category")];
  assert.deepEqual(slugs(buildEdition(feed).edition), slugs(feed));
});

test("nothing is in both the edition and Më shumë", () => {
  const feed = [
    ...Array.from({ length: 5 }, () => item(KURTI, "person")),
    ...Array.from({ length: 5 }, () => item(PRISHTINA, "city")),
    ...Array.from({ length: 5 }, () => item(SPORT, "category")),
  ];
  const { edition, more } = buildEdition(feed);
  const inEdition = new Set(slugs(edition));
  const inMore = more.flatMap((g) => slugs(g.items));
  assert.equal(inMore.filter((s) => inEdition.has(s)).length, 0);
  // And every story is somewhere: 15 in, 15 out.
  assert.equal(inEdition.size + inMore.length, 15);
});

test("a duplicate slug in the feed is shown once", () => {
  const a = item(KURTI, "person");
  const { edition, more } = buildEdition([a, { ...a, reason: PRISHTINA, kind: "city" }]);
  assert.equal(edition.length, 1);
  assert.equal(more.length, 0);
});

test("Më shumë files people, then cities with home first, then topics", () => {
  const feed = [
    ...Array.from({ length: 2 }, () => item(KURTI, "person")),
    ...Array.from({ length: 2 }, () => item(SPORT, "category")),
    ...Array.from({ length: 2 }, () => item(TOP, "top")),
    item("Sepse ndjek Botë", "category"),
    item(KURTI, "person"),
    item("Nga Prizreni", "city"),
    item(PRISHTINA, "city"),
    item(SPORT, "category"),
    item("Sipas asaj që lexon", "learned"),
    item(TOP, "top"),
  ];
  const { more } = buildEdition(feed, { homeFrom: PRISHTINA });
  assert.deepEqual(
    more.map((g) => [g.kind, g.title, g.items.length]),
    [
      ["person", "Albin Kurti", 1],
      ["city", PRISHTINA, 1],
      ["city", "Nga Prizreni", 1],
      ["topics", "Temat e tua", 2],
    ]
  );
});

test("a thin day gives a short edition, not padding", () => {
  const { edition, more } = buildEdition([item(SPORT, "category"), item(TOP, "top")]);
  assert.equal(edition.length, 2);
  assert.equal(more.length, 0);
});

test("an empty or broken feed gives an empty edition", () => {
  for (const feed of [[], null, undefined, [null, { article: null }]]) {
    const out = buildEdition(feed);
    assert.deepEqual(out.edition, []);
    assert.deepEqual(out.more, []);
    assert.equal(out.minutes, MIN_MINUTES);
  }
});

test("reading time counts title and excerpt words, with a floor", () => {
  const words = (k) => Array.from({ length: k }, () => "fjalë").join(" ");
  assert.equal(readingMinutes([]), MIN_MINUTES);
  assert.equal(readingMinutes([{ article: { title: words(50), excerpt: words(50) } }]), MIN_MINUTES);
  assert.equal(readingMinutes([{ article: { title: words(300), excerpt: words(301) } }]), 4);
});
