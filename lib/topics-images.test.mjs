import test from "node:test";
import assert from "node:assert/strict";

import { timelineFor } from "./topics.mjs";

/**
 * Image relevance.
 *
 * The dossier once illustrated the 2013 NATO drawdown with a Bitcoin price
 * chart and the March 2004 riots with an unrelated shooting, and captioned both
 * "Nga mbulimi i 383-shit" — which asserts the photograph documents the event.
 * The cause was an assignment loop with no minimum score: every milestone was
 * paired with something as long as the archive had something left.
 *
 * These tests fix the floor in place. A dossier showing fewer pictures is the
 * correct outcome; a dossier showing a wrong one is not.
 */

/** Shaped like a real row from news_articles. */
const article = (over) => ({
  slug: "s",
  title: "",
  excerpt: "",
  category: "Kosovë",
  imageUrl: "https://example.test/i.jpg",
  source: "Test",
  publishedAt: "2026-08-20",
  ...over,
});

/** The actual off-topic stories that were being attached to KFOR history. */
const OFF_TOPIC = [
  article({
    slug: "bitcoin",
    title: "Bitcoin bie nën 90 mijë dollarë pas javës më të keqe të vitit",
    excerpt: "Tregu i kriptomonedhave humbet vlerë pas shitjeve masive.",
    category: "Ekonomi",
    imageUrl: "https://example.test/bitcoin.jpg",
  }),
  article({
    slug: "tarifat",
    title: "SHBA vendos tarifat 50% ndaj Kanadasë, Ottawa zotohet të përgjigjet",
    excerpt: "Masa hyn në fuqi javën e ardhshme sipas Shtëpisë së Bardhë.",
    category: "Botë",
    imageUrl: "https://example.test/tarifat.jpg",
  }),
  article({
    slug: "tesla",
    title: "Tesla prezanton modelin e ri me çmim më të ulët",
    excerpt: "Kompania synon tregun evropian këtë vit.",
    category: "Teknologji",
    imageUrl: "https://example.test/tesla.jpg",
  }),
  article({
    slug: "vdekje",
    title: "Baba e bir gjejnë vdekjen me armë zjarri në Dukagjin",
    excerpt: "Policia ka nisur hetimet për rastin.",
    category: "Kosovë",
    imageUrl: "https://example.test/vdekje.jpg",
  }),
];

const milestones = (slug, articles) =>
  timelineFor(slug, articles).filter((e) => e.kind === "milestone");

test("an off-topic archive gives a dossier no photographs at all", () => {
  const withImages = milestones("kfor", OFF_TOPIC).filter((m) => m.imageUrl);
  assert.deepEqual(
    withImages.map((m) => `${m.title} <- ${m.imageUrl}`),
    [],
    "a Bitcoin, tariff, Tesla or shooting story is not a picture of KFOR history"
  );
});

test("no milestone is ever captioned as documentation by an off-topic story", () => {
  for (const m of milestones("kfor", OFF_TOPIC)) {
    assert.equal(
      m.imageIsSubject ?? false,
      false,
      `"${m.title}" claimed an off-topic photograph as its own subject`
    );
  }
});

test("two generic verbs are not enough to claim a photograph is of the event", () => {
  // "fuqi" and "vendos" are ordinary Albanian words. They were the entire
  // evidence for pairing the end of the 1999 war with a US tariff story.
  const tariffOnly = [OFF_TOPIC[1]];
  for (const m of milestones("dialogu-kosove-serbi", tariffOnly)) {
    assert.equal(m.imageIsSubject ?? false, false, `"${m.title}" matched on filler words`);
  }
});

test("a photograph from the same year as the moment is used, and is credited", () => {
  // trump-dhe-ballkani carries a 2025 moment, so a 2025 article about it is the
  // one case in the current data where a real pairing is possible at all.
  const onTopic = [
    article({
      slug: "trump-ballkan",
      title: "Administrata Trump rikthen vemendjen te Ballkani dhe Kosova",
      excerpt: "Uashingtoni emeron te derguar te posacem per rajonin, thote Shtepia e Bardhe.",
      imageUrl: "https://example.test/trump.jpg",
      source: "Reuters",
      publishedAt: "2025-06-01",
    }),
  ];
  for (const m of milestones("trump-dhe-ballkani", onTopic)) {
    if (!m.imageUrl) continue;
    assert.equal(m.year, "2025", "only the same-year moment may take this photograph");
    assert.ok(m.imageCredit, "an attached photograph must carry a credit");
    assert.ok(m.imageSlug, "an attached photograph must link back to its report");
  }
});

test("a historical moment takes no photograph from a modern archive", () => {
  // This is the honest state of the feature: the archive begins in 2026 and
  // every authored moment predates it, so almost none of them can have a real
  // photograph. Fewer pictures is the correct outcome — the fix for it is a
  // sourced image with a citation, not a loosened match.
  const modern = [
    article({
      slug: "kfor-2026",
      title: "KFOR-i dhe NATO rrisin praninë ushtarake në veri të Kosovës",
      excerpt: "Trupat shtesë dhe siguria në Kosovë sipas NATO-s.",
      imageUrl: "https://example.test/2026.jpg",
      source: "Reuters",
      publishedAt: "2026-08-20",
    }),
  ];
  const imaged = milestones("kfor", modern).filter((m) => m.imageUrl);
  assert.deepEqual(imaged.map((m) => m.title), [], "a 2026 photograph illustrated a pre-2026 event");
});

test("no two moments share a photograph", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    article({
      slug: `kfor-${i}`,
      title: `KFOR-i dhe NATO: zhvillime ushtarake në Kosovë, pjesa ${i}`,
      excerpt: "Trupat e NATO-s dhe siguria në veri të Kosovës.",
      imageUrl: `https://example.test/k${i}.jpg`,
    })
  );
  const used = milestones("kfor", many).map((m) => m.imageUrl).filter(Boolean);
  assert.equal(new Set(used).size, used.length, "a picture was reused across moments");
});

test("assignment is deterministic for identical input", () => {
  const pool = [
    article({
      slug: "a",
      title: "KFOR-i rrit praninë ushtarake në veri të Kosovës",
      excerpt: "NATO dërgon trupa shtesë.",
      imageUrl: "https://example.test/a.jpg",
    }),
    article({
      slug: "b",
      title: "NATO dhe KFOR-i vlerësojnë sigurinë në Kosovë",
      excerpt: "Mandati i forcës mbetet i pandryshuar.",
      imageUrl: "https://example.test/b.jpg",
    }),
  ];
  const once = milestones("kfor", pool).map((m) => m.imageUrl ?? null);
  const twice = milestones("kfor", pool).map((m) => m.imageUrl ?? null);
  assert.deepEqual(once, twice);
});

test("a photograph taken years after the event cannot illustrate it", () => {
  // 383's archive begins in 2026; almost every milestone predates it. A 2026
  // photograph is not a picture of the 1999 deployment no matter how closely
  // its words match, so the year has to gate the pairing.
  const modern = [
    article({
      slug: "kfor-sot",
      title: "KFOR-i vendoset në pozicione të reja në Kosovë",
      excerpt: "NATO dhe trupat e KFOR-it në veri të Kosovës.",
      imageUrl: "https://example.test/modern.jpg",
      publishedAt: "2026-08-20",
    }),
  ];
  const wrongEra = milestones("kfor", modern).filter(
    (m) => m.imageUrl && m.year && /^\d{4}$/.test(m.year) && m.year !== "2026"
  );
  assert.deepEqual(
    wrongEra.map((m) => `${m.year}: ${m.title}`),
    [],
    "a 2026 photograph was attached to a milestone from another year"
  );
});

test("there is no second tier of trust for photographs", async () => {
  // "Foto ilustruese" was the other half of this bug: it let a wrong pairing
  // survive review by looking like a disclaimer. A photograph either is of the
  // event or is absent.
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../components/dosje-section.tsx", import.meta.url), "utf8")
  );
  // The ternary is the thing, not the words: a second branch on the caption is
  // what let a wrong photograph pass as a disclaimed one.
  assert.ok(
    !/\?\s*"Nga mbulimi/.test(src),
    "the caption still branches between a trusted and an untrusted tier"
  );
  assert.ok(
    !/:\s*"Foto ilustruese"/.test(src),
    "the illustrative-photo tier is still rendered"
  );
});
