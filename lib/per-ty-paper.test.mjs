import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaper, defaultSectionKeys, describeSection, SECTION_SIZE } from "./per-ty-paper.mjs";
import { normalizePrefs, orderedKeys, moveKey, defaultPrefs, readPrefs, writePrefs } from "./paper-prefs.mjs";

let n = 0;
const item = (reason, kind, primaryKey, keys, extra = {}) => ({
  article: { slug: `s${++n}`, title: "Një titull", excerpt: "Një përmbledhje.", ...extra },
  reason,
  kind,
  primaryKey,
  keys,
});
const KURTI = ["Sepse ndjek Albin Kurti", "person", "person:albin-kurti"];
const SPORT = ["Sepse ndjek Sport", "category", "cat:Sport"];
const TOP = ["Kryesoret e ditës", "top", "top"];
const interests = { v: 1, people: ["albin-kurti"], cities: ["prishtine"], home: "prishtine", categories: ["Sport", "Teknologji"] };
const slugs = (items) => items.map((i) => i.article.slug);

test("default section order: home city, people, other cities, categories", () => {
  const keys = defaultSectionKeys({ v: 1, people: ["albin-kurti"], cities: ["prizren", "prishtine"], home: "prishtine", categories: ["Sport"] });
  assert.deepEqual(keys, ["city:prishtine", "person:albin-kurti", "city:prizren", "cat:Sport"]);
});

test("the lead is the edition's first story and is not repeated anywhere", () => {
  const feed = [item(...KURTI, ["person:albin-kurti", "cat:Sport"]), item(...SPORT, ["cat:Sport"])];
  const paper = buildPaper(feed, interests, null);
  assert.equal(paper.lead, paper.edition[0]);
  const inSections = paper.sections.flatMap((s) => slugs(s.items));
  for (const slug of slugs(paper.edition)) assert.ok(!inSections.includes(slug));
});

test("the edition length follows the reader's choice", () => {
  const feed = Array.from({ length: 20 }, (_, i) => item(`r${i}`, "category", `cat:Sport`, ["cat:Sport"]));
  assert.equal(buildPaper(feed, interests, { ...defaultPrefs(), length: 5 }).edition.length, 5);
  assert.equal(buildPaper(feed, interests, { ...defaultPrefs(), length: 10 }).edition.length, 10);
});

test("a story matching two follows can fill the second section", () => {
  // Three Kurti stories: two go to the edition (two per reason), the third
  // is also Sport. With Kurti hidden, it must reach Sport rather than vanish.
  const feed = [
    item(...KURTI, ["person:albin-kurti"]),
    item(...KURTI, ["person:albin-kurti"]),
    item(...KURTI, ["person:albin-kurti", "cat:Sport"]),
  ];
  const paper = buildPaper(feed, interests, { ...defaultPrefs(), hidden: ["person:albin-kurti"] });
  const sport = paper.sections.find((s) => s.key === "cat:Sport");
  assert.deepEqual(slugs(sport.items), [feed[2].article.slug]);
});

test("nothing appears twice across sections", () => {
  const shared = item(...KURTI, ["person:albin-kurti", "cat:Sport"]);
  const filler = Array.from({ length: 7 }, (_, i) => item(`top${i}`, "top", "top", []));
  const paper = buildPaper([...filler, shared], interests, null);
  const all = paper.sections.flatMap((s) => slugs(s.items));
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.filter((s) => s === shared.article.slug).length, 1);
});

test("sections hold at most SECTION_SIZE stories", () => {
  const feed = [...Array.from({ length: 7 }, (_, i) => item(`top${i}`, "top", "top", [])), ...Array.from({ length: 9 }, () => item(...SPORT, ["cat:Sport"]))];
  const sport = buildPaper(feed, interests, null).sections.find((s) => s.key === "cat:Sport");
  assert.equal(sport.items.length, SECTION_SIZE);
});

test("a thin category is topped up from the shelf, marked, and never duplicated", () => {
  const edition = Array.from({ length: 7 }, (_, i) => item(`top${i}`, "top", "top", []));
  const shelf = { Teknologji: [{ slug: "t1", title: "AI" }, { slug: edition[0].article.slug, title: "dupe" }, { slug: "t2", title: "Çipat" }, { slug: "t3", title: "x" }] };
  const tech = buildPaper(edition, interests, null, { shelf }).sections.find((s) => s.key === "cat:Teknologji");
  assert.deepEqual(slugs(tech.items), ["t1", "t2", "t3"]);
  assert.ok(tech.items.every((i) => i.fromShelf));
});

test("an empty section is still returned, marked empty", () => {
  const paper = buildPaper([], interests, null);
  const tech = paper.sections.find((s) => s.key === "cat:Teknologji");
  assert.equal(tech.empty, true);
  assert.equal(paper.lead, null);
});

test("hidden sections are skipped; hiding all is reported", () => {
  const all = defaultSectionKeys(interests);
  const paper = buildPaper([], interests, { ...defaultPrefs(), hidden: all });
  assert.deepEqual(paper.sections, []);
  assert.equal(paper.allHidden, true);
  assert.equal(buildPaper([], interests, null).allHidden, false);
});

test("the reader's order wins; new follows join at the end in default order", () => {
  const paper = buildPaper([], interests, { ...defaultPrefs(), order: ["cat:Teknologji", "person:albin-kurti", "person:nobody"] });
  assert.deepEqual(
    paper.sections.map((s) => s.key),
    ["cat:Teknologji", "person:albin-kurti", "city:prishtine", "cat:Sport"]
  );
});

test("describeSection derives titles from the canonical lists only", () => {
  assert.equal(describeSection("person:albin-kurti")?.title, "Albin Kurti");
  assert.equal(describeSection("city:prishtine")?.title, "Prishtinë");
  assert.equal(describeSection("cat:Sport")?.href, "/kategori/sport");
  assert.equal(describeSection("cat:<script>"), null);
  assert.equal(describeSection("person:nobody"), null);
  assert.equal(describeSection("learned"), null);
  assert.equal(describeSection(undefined), null);
});

test("junk input does not throw", () => {
  assert.doesNotThrow(() => buildPaper(null, null, "junk", { shelf: { Sport: [null, 3] } }));
  assert.doesNotThrow(() => buildPaper([null, { article: null }], { v: 1, categories: ["Sport"] }, 42));
});

// ── prefs ────────────────────────────────────────────────────────────────────

test("prefs: junk and older shapes fall back to the defaults", () => {
  assert.deepEqual(normalizePrefs(null), defaultPrefs());
  assert.deepEqual(normalizePrefs({ v: 0, style: "nate" }), defaultPrefs());
  const got = normalizePrefs({ v: 1, style: "neon", accent: "blu", length: 8, order: ["cat:Sport", 5, "cat:Sport", "x y"], boxes: { tregu: false, brief: "no" } });
  assert.equal(got.style, "klasike");
  assert.equal(got.accent, "blu");
  assert.equal(got.length, 7);
  assert.deepEqual(got.order, ["cat:Sport"]);
  assert.deepEqual(got.boxes, { brief: true, city: true, tregu: false, numbers: true });
});

test("prefs: orderedKeys and moveKey", () => {
  assert.deepEqual(orderedKeys(["b", "x"], ["a", "b", "c"]), ["b", "a", "c"]);
  assert.deepEqual(moveKey(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveKey(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
});

test("prefs: storage that throws never breaks the page", () => {
  const broken = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  assert.deepEqual(readPrefs(broken), defaultPrefs());
  assert.equal(writePrefs(defaultPrefs(), broken), false);
  const store = new Map();
  const ok = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(writePrefs({ ...defaultPrefs(), style: "nate" }, ok), true);
  assert.equal(readPrefs(ok).style, "nate");
});

test("a second outlet's write-up of a story already shown is skipped", () => {
  const edition = Array.from({ length: 7 }, (_, i) => item(`top${i}`, "top", "top", [], { title: `Lajm i ndryshëm numër ${i} për ${["Tiranën", "Shkupin", "Gjermaninë", "Italinë", "Francën", "Austrinë", "Zvicrën"][i]}` }));
  const city1 = item(...SPORT, ["cat:Sport"], { title: "Manchester City apelon vendimin për 114 akuza financiare" });
  const city2 = item(...SPORT, ["cat:Sport"], { title: "Manchester City kundërshton vendimin për shkelje financiare" });
  const other = item(...SPORT, ["cat:Sport"], { title: "Drita fiton derbin në Gjilan" });
  const sport = buildPaper([...edition, city1, city2, other], interests, null).sections.find((s) => s.key === "cat:Sport");
  assert.deepEqual(slugs(sport.items), [city1.article.slug, other.article.slug]);
});
