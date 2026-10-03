import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, genitive, paperName, paperTitle, defaultTitle, isTitleId, sharedTitle } from "./reader-name.mjs";

test("a name is one clean word, capitalised", () => {
  assert.equal(normalizeName("  lind sylqa "), "Lind");
  assert.equal(normalizeName("ËNDRITA"), "Ëndrita");
  assert.equal(normalizeName("çlirim"), "Çlirim");
  for (const junk of ["", " ", "a", "x".repeat(25), "<script>", "Lind2", null, 7, {}]) {
    assert.equal(normalizeName(junk), "", String(junk));
  }
});

test("names decline by their ending", () => {
  const cases = {
    Lind: "Lindit",
    Arben: "Arbenit",
    Ilir: "Ilirit",
    Driton: "Dritonit",
    Erik: "Erikut",
    Ardi: "Ardit",
    Arta: "Artës",
    Drita: "Dritës",
    Teuta: "Teutës",
    Shqipe: "Shqipes",
    Ëndrita: "Ëndritës",
  };
  for (const [name, gen] of Object.entries(cases)) assert.equal(genitive(name), gen, name);
});

test("an ending we are not sure of gets no genitive rather than a wrong one", () => {
  for (const name of ["Leo", "Eru", "Mary", "", "x"]) assert.equal(genitive(name), null, name);
});

test("the paper is named after the reader, or is simply theirs", () => {
  assert.equal(paperName("lind"), "Gazeta e Lindit");
  assert.equal(paperName("Arta"), "Gazeta e Artës");
  assert.equal(paperName("Leo"), "Gazeta jote");
  assert.equal(paperName(""), "Gazeta jote");
});

test("paper titles agree with their noun", () => {
  assert.equal(paperTitle("Lindi", "gazeta"), "Gazeta e Lindit");
  assert.equal(paperTitle("Lindi", "kurieri"), "Kurieri i Lindit");
  assert.equal(paperTitle("Arta", "perditshmja"), "E Përditshmja e Artës");
  assert.equal(paperTitle("Bruno", "zeri"), "Zëri yt");
  assert.equal(paperTitle("", "lajmetari"), "Lajmëtari yt");
});

test("a reader without a choice gets a title from their name, the same one every time", () => {
  assert.equal(defaultTitle("Lindi"), defaultTitle("lindi"));
  assert.ok(isTitleId(defaultTitle("Lindi")));
  assert.equal(defaultTitle(""), "gazeta");
  assert.equal(paperTitle("Lindi", "nonsense"), paperTitle("Lindi", defaultTitle("Lindi")));
  const spread = new Set(["Lindi", "Arta", "Besa", "Drilon", "Erion", "Fjolla", "Gent", "Hana", "Ilir", "Jeta"].map(defaultTitle));
  assert.ok(spread.size >= 3, `only ${spread.size} titles across ten names`);
});

test("a shared copy without a name names 'a reader', never 'yours'", () => {
  assert.equal(sharedTitle("Lindi", "kurieri"), "Kurieri i Lindit");
  assert.equal(sharedTitle("", "kurieri"), "Kurieri i një lexuesi");
  assert.equal(sharedTitle("", "perditshmja"), "E Përditshmja e një lexuesi");
});
