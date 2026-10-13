import { test } from "node:test";
import assert from "node:assert/strict";
import { keyPoints, sentences, LEAD_CHARS, MAX_CHARS, MAX_POINTS } from "./key-points.mjs";

const body = [
  "Kuvendi i Kosovës u konstituua të martën pas tri seancave të dështuara. Ai votoi kryetarin me 61 vota.",
  "Por opozita nuk mori pjesë në votim. Lista Serbe kërkoi që nënkryetari të zgjidhet nga radhët e saj sipas Kushtetutës.",
  "Gjykata Kushtetuese do të shqyrtojë kërkesën brenda 30 ditësh, tha zëdhënësi i saj.",
  "Seanca e radhës pritet të mbahet javën e ardhshme në Prishtinë, me rend dite të hapur.",
];

test("sentences keep numbers and abbreviations whole", () => {
  assert.deepEqual(sentences("Çmimi u rrit në 1.5 euro. Kjo ndodhi sot!"), ["Çmimi u rrit në 1.5 euro.", "Kjo ndodhi sot!"]);
  assert.deepEqual(sentences(""), []);
});

test("points are whole sentences of the story, in its order, the excerpt's first line leading", () => {
  const excerpt = "Pas muajsh bllokade, deputetët zgjodhën kryesinë e Kuvendit, por një vend mbeti bosh.";
  const pts = keyPoints({ title: "Kuvendi konstituohet", excerpt, paragraphs: body });
  assert.ok(pts.length >= 2 && pts.length <= MAX_POINTS);
  assert.equal(pts[0], excerpt);
  const all = [excerpt, ...body.flatMap(sentences)];
  for (const p of pts) {
    assert.ok(all.includes(p), p);
    assert.ok(p.length <= (p === excerpt ? LEAD_CHARS : MAX_CHARS));
  }
});

test("a sentence that leans on the one before is left out while others remain", () => {
  const pts = keyPoints({ title: "x", excerpt: "", paragraphs: body });
  assert.ok(!pts.some((p) => /^(Ai|Por) /.test(p)), pts.join(" | "));
});

test("no point repeats the headline or another point", () => {
  const same = "Kryeministri reagoi për pagat e gjyqtarëve dhe kritikoi qeverinë e mëparshme.";
  const pts = keyPoints({
    title: "Kryeministri reagoi për pagat e gjyqtarëve",
    excerpt: same,
    paragraphs: [same, "Kryeministri reagoi për pagat e gjyqtarëve dhe kritikoi qeverinë e mëparshme sot.", ...body],
  });
  const lower = pts.map((p) => p.toLowerCase());
  assert.ok(lower.filter((p) => p.includes("pagat e gjyqtarëve")).length <= 1, pts.join(" | "));
  assert.ok(!pts.includes("Kryeministri reagoi për pagat e gjyqtarëve."));
});

test("too little to say: no points, the card keeps its excerpt", () => {
  assert.deepEqual(keyPoints({ title: "t", excerpt: "Shkurt.", paragraphs: ["Po."] }), []);
  assert.deepEqual(keyPoints(null), []);
});
