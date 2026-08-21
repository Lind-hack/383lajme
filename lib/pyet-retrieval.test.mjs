import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentTerms,
  retrieve,
  scoreArticle,
  trimSource,
  validQuestion,
  RELEVANCE_FLOOR,
} from "./pyet-retrieval.mjs";

const ARTICLES = [
  {
    slug: "kurti-buxheti",
    title: "Kurti prezanton buxhetin e ri për 2026",
    body: "Kryeministri Albin Kurti ka prezantuar buxhetin. Rritja e pagave në sektorin publik është pjesë e tij.",
    meta: "2026-08-20",
    category: "Politikë",
  },
  {
    slug: "ramallah-raport",
    title: "Raport nga Ramallahu për situatën humanitare",
    body: "Organizatat ndërkombëtare kanë publikuar një raport nga Ramallahu.",
    meta: "2026-08-19",
    category: "Botë",
  },
  {
    slug: "hena-mision",
    title: "Misioni i ri hapësinor niset drejt Hënës",
    body: "Agjencia hapësinore konfirmoi nisjen e misionit drejt Hënës këtë vit.",
    meta: "2026-08-18",
    category: "Teknologji",
  },
];

test("question words alone carry no retrieval signal", () => {
  assert.deepEqual(contentTerms("Pse ndodhi kjo?"), []);
  assert.deepEqual(contentTerms("Çfarë është kjo dhe si ndodhi?"), []);
  // A real subject survives the stopword filter.
  assert.ok(contentTerms("Pse e prezantoi Kurti buxhetin?").includes("kurti"));
});

test("a question the archive does not cover is refused before any model runs", () => {
  const out = retrieve(ARTICLES, "Sa kushton një biletë avioni për në Tokio?");
  assert.equal(out.grounded, false);
  assert.equal(out.sources.length, 0);
});

test("a question the archive covers retrieves the right article", () => {
  const out = retrieve(ARTICLES, "Çfarë tha Kurti për buxhetin?");
  assert.equal(out.grounded, true);
  assert.equal(out.sources[0].article.slug, "kurti-buxheti");
});

test("'rama' does not match 'Ramallahu'", () => {
  // The recurring false positive in this codebase: a padded substring match
  // treats a Palestinian city as a mention of the Albanian prime minister.
  const ramallah = ARTICLES[1];
  const { score } = scoreArticle(ramallah, ["rama"]);
  assert.equal(score, 0);
});

test("Albanian declension still matches", () => {
  // "Hënës" folds to "henes"; a reader types "hena".
  const { score } = scoreArticle(ARTICLES[2], ["hena"]);
  assert.ok(score > 0, "an inflected form in the body should still match");
});

test("one stray body mention does not clear the floor", () => {
  const article = { title: "Diçka tjetër fare", body: "Një përmendje e vetme e Kurtit këtu." };
  const { score } = scoreArticle(article, ["kurti"]);
  assert.ok(score < RELEVANCE_FLOOR, `expected ${score} to sit under the floor`);
});

test("the article being read is always source #1, even for a question with no terms", () => {
  // "Pse ndodhi kjo?" on an article page refers to the page itself.
  const out = retrieve(ARTICLES, "Pse ndodhi kjo?", { pinnedSlug: "hena-mision" });
  assert.equal(out.grounded, true);
  assert.equal(out.sources[0].article.slug, "hena-mision");
  assert.equal(out.sources[0].pinned, true);
});

test("the pinned article is never also listed as a second source", () => {
  const out = retrieve(ARTICLES, "Çfarë tha Kurti për buxhetin?", { pinnedSlug: "kurti-buxheti" });
  const slugs = out.sources.map((s) => s.article.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("an entity match grounds even when the name is absent from the title", () => {
  const forms = ["albin kurti"];
  const mentionsFn = (article, f) => f.some((form) => article.body.toLowerCase().includes(form));
  const out = retrieve(ARTICLES, "Kush është Albin Kurti?", { entityForms: forms, mentionsFn });
  assert.equal(out.grounded, true);
});

test("source count is capped", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    slug: `a-${i}`,
    title: `Kurti dhe buxheti numër ${i}`,
    body: "Buxheti.",
    meta: "2026-08-01",
  }));
  const out = retrieve(many, "Kurti buxheti", { limit: 6 });
  assert.equal(out.sources.length, 6);
});

test("trimSource cuts on a sentence end and marks the cut", () => {
  const long = { body: `${"Fjali e plotë këtu. ".repeat(200)}` };
  const cut = trimSource(long, 200);
  assert.ok(cut.length < 260);
  assert.ok(cut.endsWith("[…]"));
  assert.ok(cut.includes("."));
});

test("questions are length-bounded", () => {
  assert.equal(validQuestion("po?").ok, false);
  assert.equal(validQuestion("x".repeat(400)).ok, false);
  assert.equal(validQuestion("Pse u rrit buxheti?").ok, true);
});

test("an inflected query reaches a differently inflected article", () => {
  // The reader types the accusative "Kosovën"; the archive carries "Kosovës".
  // Neither is a prefix of the other, so a prefix rule refuses the question.
  const article = { title: "Marrëveshja e re mes Kosovës dhe Serbisë", body: "Detaje." };
  assert.ok(scoreArticle(article, ["kosoven"]).score > 0);
  assert.ok(scoreArticle(article, ["serbine"]).score > 0);
});

test("the looser stem rule still keeps Ramallah and Ramazan away from Rama", () => {
  const a = { title: "Raport nga Ramallahut", body: "Ramazani filloi." };
  assert.equal(scoreArticle(a, ["rama"]).score, 0);
});

test("words that merely start alike do not match", () => {
  const a = { title: "Kosmosi dhe misionet", body: "Asgje tjeter." };
  assert.equal(scoreArticle(a, ["kosoven"]).score, 0);
});

test("a chip question on an article retrieves that article and nothing else", () => {
  // Widening on "shkaku"/"artikullit" buried the pinned piece among unrelated
  // ones and the model declined, telling the reader 383 had nothing on the
  // story they were reading.
  const out = retrieve(ARTICLES, "Pse ndodhi kjo?", { pinnedSlug: "kurti-buxheti" });
  assert.equal(out.sources.length, 1);
  assert.equal(out.sources[0].article.slug, "kurti-buxheti");
});

test("words about the asking are not subjects", () => {
  assert.deepEqual(contentTerms("Cili eshte shkaku sipas artikullit?"), []);
  assert.deepEqual(contentTerms("Cfare rendesie ka ky lajm?"), []);
});

test("an article page never widens past a handful of sources", () => {
  // Chip questions carry generic words that match widely. Left uncapped they
  // surround the pinned article with vocabulary neighbours, and the model
  // declines on a prompt that mostly does not answer the question.
  const many = Array.from({ length: 40 }, (_, i) => ({
    slug: `a-${i}`,
    title: `Rezultat dhe buxheti numër ${i}`,
    body: "Buxheti dhe rezultati.",
    meta: "2026-08-01",
  }));
  many.push({ slug: "pinned", title: "Artikulli i lexuar", body: "Teksti.", meta: "2026-08-02" });
  const out = retrieve(many, "Cfare do te thote ky rezultat per buxhetin?", {
    pinnedSlug: "pinned",
    limit: 6,
  });
  assert.equal(out.sources[0].article.slug, "pinned");
  assert.ok(out.sources.length <= 3, `widened to ${out.sources.length}`);
});

