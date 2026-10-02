import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, genitive, paperName } from "./reader-name.mjs";

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
