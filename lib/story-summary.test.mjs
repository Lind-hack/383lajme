import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FRESH_MS,
  INDEX_VERSION,
  checkSummary,
  cleanSummaries,
  isSummaryHour,
  noDashes,
  normalizeIndex,
  ownSummary,
  pickStories,
  summaryMap,
  withSummaries,
} from "./story-summary.mjs";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const iso = (t) => new Date(t).toISOString();

const story = {
  slug: "kurti-takon-ministrat",
  title: "Kurti takon ministrat për buxhetin e vitit 2027",
  excerpt: "Kryeministri Albin Kurti mblodhi qeverinë në Prishtinë.",
  body: "Buxheti prej 3.200 milionë eurosh do të votohet në Kuvend javën e ardhshme. Rritja për arsimin është 12%.",
};

test("a summary from the story passes, and keeps its full stop", () => {
  const text = "Kurti mblodhi qeverinë në Prishtinë për buxhetin. Buxheti prej 3.200 milionë eurosh shkon në Kuvend javën e ardhshme, me 12% më shumë për arsimin";
  assert.equal(checkSummary(text, story), `${text}.`);
});

test("a number the story does not have fails", () => {
  assert.equal(checkSummary("Qeveria mblodhi ministrat në Prishtinë. Buxheti prej 4.000 milionë eurosh shkon në Kuvend javën e ardhshme për votim.", story), null);
});

test("numbers match however they are grouped", () => {
  assert.notEqual(checkSummary("Qeveria mblodhi ministrat në Prishtinë. Buxheti prej 3,200 milionë eurosh shkon në Kuvend javën e ardhshme për votim.", story), null);
});

test("a name the story does not have fails, Albanian endings still match", () => {
  assert.equal(checkSummary("Qeveria e Kurtit u mblodh sot me Vučić në Prishtinë. Buxheti shkon në Kuvend javën e ardhshme për votim final.", story), null);
  assert.notEqual(checkSummary("Qeveria e Kurtit u mblodh sot në Prishtinë. Buxheti shkon në Kuvend javën e ardhshme për votim final.", story), null);
});

test("too short, too long, questions and four sentences fail", () => {
  assert.equal(checkSummary("Kurti mblodhi qeverinë.", story), null);
  assert.equal(checkSummary(Array(80).fill("fjalë").join(" "), story), null);
  assert.equal(checkSummary("A do ta kalojë Kuvendi buxhetin e ri që qeveria e Kurtit miratoi sot në Prishtinë?", story), null);
  assert.equal(checkSummary("Qeveria u mblodh sot. Buxheti u miratua sot. Kuvendi voton javën tjetër. Arsimi merr më shumë para.", story), null);
});

test("dashes become commas, also inside a summary", () => {
  assert.equal(noDashes("Kurti foli sot — dhe tha shumë – por pak u kuptua - në fund."), "Kurti foli sot, dhe tha shumë, por pak u kuptua, në fund.");
  assert.equal(noDashes("- Një rresht me vizë"), "Një rresht me vizë");
  assert.equal(noDashes("Rruga Prishtinë-Pejë mbetet e hapur."), "Rruga Prishtinë-Pejë mbetet e hapur.");
  const text = checkSummary("Kurti mblodhi qeverinë në Prishtinë — buxheti shkon në Kuvend javën e ardhshme, me më shumë para për arsimin.", story);
  assert.ok(text && !/[—–]/.test(text));
});

test("only stories that were sent, once each, and only those that pass", () => {
  const raw = {
    summaries: [
      { slug: "kurti-takon-ministrat", text: "Kurti mblodhi qeverinë në Prishtinë. Buxheti shkon në Kuvend javën e ardhshme për votim." },
      { slug: "kurti-takon-ministrat", text: "Një tjetër, që nuk merret parasysh sepse slug-u u përdor tashmë më lart." },
      { slug: "nje-tjeter", text: "Ky lajm nuk u dërgua, ndaj nuk ka si të tregohet këtu në asnjë mënyrë sot." },
    ],
  };
  const out = cleanSummaries(raw, [story]);
  assert.deepEqual([...out.keys()], ["kurti-takon-ministrat"]);
  assert.match(out.get("kurti-takon-ministrat"), /^Kurti mblodhi/);
  assert.equal(cleanSummaries(null, [story]).size, 0);
});

test("the story's own words stand in: not the headline, two sentences", () => {
  const own = ownSummary({ ...story, excerpt: `${story.title}. ${story.excerpt}` });
  assert.equal(own, "Kryeministri Albin Kurti mblodhi qeverinë në Prishtinë. Buxheti prej 3.200 milionë eurosh do të votohet në Kuvend javën e ardhshme.");
});

test("fresh stories not yet summarised, newest first, at most max", () => {
  const index = normalizeIndex({ v: INDEX_VERSION, items: { a: { t: "x", at: iso(NOW) } } });
  const recent = [
    { slug: "a", title: "A", publishedAt: iso(NOW - 1000) },
    { slug: "b", title: "B", publishedAt: iso(NOW - 5000) },
    { slug: "c", title: "C", publishedAt: iso(NOW - 2000) },
    { slug: "old", title: "Old", publishedAt: iso(NOW - FRESH_MS - 1) },
  ];
  assert.deepEqual(pickStories(recent, index, { now: NOW, max: 5 }).map((a) => a.slug), ["c", "b"]);
  assert.deepEqual(pickStories(recent, index, { now: NOW, max: 1 }).map((a) => a.slug), ["c"]);
});

test("summaries are written in the 06:00 Kosovo hour only, and the index keeps what it is given", () => {
  // October: Kosovo is UTC+2.
  assert.equal(isSummaryHour(Date.parse("2026-10-24T04:00:00Z")), true);
  assert.equal(isSummaryHour(Date.parse("2026-10-24T04:59:00Z")), true);
  assert.equal(isSummaryHour(Date.parse("2026-10-24T05:00:00Z")), false);
  assert.equal(isSummaryHour(Date.parse("2026-10-24T03:59:00Z")), false);
  const next = withSummaries(normalizeIndex(null), [{ slug: "a", text: "Tekst.", by: "dardani" }, { slug: "b", text: "Fjali.", by: "own" }], NOW);
  assert.deepEqual(summaryMap(next), { a: { text: "Tekst.", byDardani: true }, b: { text: "Fjali.", byDardani: false } });
});

test("junk in the stored index is dropped, not trusted", () => {
  const index = normalizeIndex({ v: INDEX_VERSION, items: { "ok-slug": { t: "Mirë.", at: iso(NOW) }, "bad slug!": { t: "x", at: iso(NOW) }, empty: { t: "", at: iso(NOW) }, nodate: { t: "x" } } });
  assert.deepEqual(Object.keys(index.items), ["ok-slug"]);
  assert.deepEqual(normalizeIndex("nonsense").items, {});
});

test("the story's own words skip a sentence that only restates the first", () => {
  const own = ownSummary({
    title: "Wells Fargo kundërshton tregtimin",
    excerpt: "Gjashtë emetues, mes tyre Wells Fargo, kundërshtuan tregtimin e aksioneve të tokenizuara në platformën OKX-ICE.",
    body: "Wells Fargo është ndër gjashtë emetuesit që kundërshtuan tregtimin e aksioneve të tokenizuara në OKX-ICE. Platforma pritet të hapet në janar për investitorët institucionalë.",
  });
  assert.match(own, /Platforma pritet të hapet në janar/);
  assert.doesNotMatch(own, /Wells Fargo është ndër/);
});

test("the model's own commentary is dropped, the facts kept", () => {
  const text = checkSummary("Kurti mblodhi qeverinë në Prishtinë për buxhetin. Buxheti shkon në Kuvend javën e ardhshme për votim. Ky hap synon të rrisë besimin e qytetarëve.", story);
  assert.ok(text && !/Ky hap/.test(text));
  assert.match(text, /^Kurti mblodhi/);
});

test("an index written under an older prompt starts over", () => {
  assert.deepEqual(normalizeIndex({ v: INDEX_VERSION - 1, items: { a: { t: "x", at: iso(NOW) } } }).items, {});
});
