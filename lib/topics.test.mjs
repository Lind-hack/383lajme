import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPICS,
  topicBySlug,
  topicForArticle,
  articlesForTopic,
  timelineFor,
} from "./topics.mjs";

const article = (over) => ({
  slug: "s",
  title: "",
  excerpt: "",
  category: "Kosovë",
  publishedAt: "2026-08-20",
  ...over,
});

test("every topic is complete enough to render", () => {
  for (const t of TOPICS) {
    assert.match(t.slug, /^[a-z0-9-]+$/, `${t.slug} is not a usable url segment`);
    assert.ok(t.title && t.blurb, `${t.slug} is missing title or blurb`);
    assert.ok(t.forms.length > 0, `${t.slug} has no surface forms`);
    for (const m of t.milestones) {
      assert.ok(m.date && m.title, `${t.slug} has a milestone without a date or title`);
      assert.ok(m.summary && m.why, `${t.slug}: "${m.title}" needs both a summary and a why`);
    }
  }
});

test("topic slugs are unique, since they become urls", () => {
  assert.equal(new Set(TOPICS.map((t) => t.slug)).size, TOPICS.length);
});

test("an article is matched on the words it actually uses", () => {
  const kfor = topicForArticle(article({ title: "Kurti: komunikim me KFOR-in per uren mbi Iber" }));
  assert.equal(kfor?.slug, "kfor");

  const dialog = topicForArticle(article({ title: "Bisedimet ne Bruksel per normalizimin" }));
  assert.equal(dialog?.slug, "dialogu-kosove-serbi");
});

test("matching is accent-tolerant, because headlines carry diacritics", () => {
  const withDiacritics = topicForArticle(article({ title: "Bisedimet në Bruksel për normalizimin" }));
  assert.equal(withDiacritics?.slug, "dialogu-kosove-serbi");
});

test("an unrelated story matches nothing rather than the nearest topic", () => {
  assert.equal(topicForArticle(article({ title: "Cmimet e naftes bien perseri", category: "Ekonomi" })), null);
});

test("a short form never matches inside an unrelated word", () => {
  // "shba" must not fire on "shbardhje", "iber" must not fire on "liberal".
  assert.equal(topicForArticle(article({ title: "Shbardhje e plote e rastit" })), null);
});

test("the timeline runs oldest history first, then this archive", () => {
  const arts = [
    article({ slug: "old", title: "Bruksel: raundi i pare", publishedAt: "2026-08-01" }),
    article({ slug: "new", title: "Bruksel: raundi i dyte", publishedAt: "2026-08-20" }),
  ];
  const tl = timelineFor("dialogu-kosove-serbi", arts);
  const kinds = tl.map((e) => e.kind);
  assert.equal(kinds.indexOf("article") > kinds.lastIndexOf("milestone"), true, "articles must follow milestones");

  const articleEntries = tl.filter((e) => e.kind === "article");
  assert.deepEqual(articleEntries.map((e) => e.slug), ["old", "new"], "oldest first within the archive");
});

test("the article being read is the one marked current", () => {
  const arts = [
    article({ slug: "a", title: "Bruksel nje" }),
    article({ slug: "b", title: "Bruksel dy" }),
  ];
  const tl = timelineFor("dialogu-kosove-serbi", arts, "b");
  const current = tl.filter((e) => e.isCurrent);
  assert.equal(current.length, 1);
  assert.equal(current[0].slug, "b");
});

test("with no matching articles the dossier is still its authored history", () => {
  const tl = timelineFor("kfor", []);
  assert.ok(tl.length > 0);
  assert.ok(tl.every((e) => e.kind === "milestone"));
});

test("an unknown slug yields nothing instead of throwing", () => {
  assert.equal(topicBySlug("nuk-ekziston"), null);
  assert.deepEqual(timelineFor("nuk-ekziston", []), []);
  assert.deepEqual(articlesForTopic("nuk-ekziston", []), []);
});

test("missing or malformed articles do not break matching", () => {
  assert.equal(topicForArticle({}), null);
  assert.equal(topicForArticle({ title: null, excerpt: undefined }), null);
  assert.deepEqual(articlesForTopic("kfor", []), []);
});

test("the page and the automation ask the same question", () => {
  // The bug this pins, and the third of its kind: a better matcher was
  // written, tested, and wired only to the research job. The article page
  // still used the old rule, so every guarantee the new one made was false
  // exactly where a reader would meet it.
  //
  // Under the old rule a single surface form attached a whole dossier: "nato"
  // pinned the Kosovo KFOR file to a NATO summit in Ankara, and "shba" pinned
  // the diaspora file to an embassy notice in Tirana.
  const offTopic = [
    ["Samiti i NATO në Ankara mbyllet me marrëveshje", "Botë"],
    ["NATO dhe Turqia nisin stërvitje të përbashkëta", "Botë"],
    ["Presidenti amerikan Trump viziton Ankara", "Botë"],
    ["Ambasada e SHBA në Tiranë hap konkurs", "Shqipëri"],
  ];
  for (const [title, category] of offTopic) {
    const t = topicForArticle({ slug: "x", title, excerpt: "", category });
    assert.equal(t, null, `"${title}" must not carry a Kosovo dossier`);
  }

  // And the rule still lets real coverage through.
  const onTopic = [
    ["KFOR-i rrit patrullat te ura mbi Ibër në Mitrovicë", "Kosovë", "kfor"],
    ["Kurti dhe Vuçiç takohen në Bruksel për normalizim", "Kosovë", "dialogu-kosove-serbi"],
    ["Kosova aplikon për anëtarësim në BE", "Kosovë", "anetaresimi-ne-be"],
  ];
  for (const [title, category, expected] of onTopic) {
    const t = topicForArticle({ slug: "x", title, excerpt: "", category });
    assert.ok(t, `"${title}" should match a dossier`);
    assert.equal(t.slug, expected, title);
  }
});

test("a vetoed story is kept out of a dossier's own coverage too", () => {
  // The same wrong answer arriving by a side door: articlesForTopic chooses
  // the recent reporting listed inside a dossier, and a looser test there
  // would put a NATO summit in Ankara under the Kosovo file's own coverage.
  const articles = [
    { slug: "ankara", title: "Samiti i NATO në Ankara", excerpt: "", category: "Botë", publishedAt: "2026-08-20" },
    { slug: "iber", title: "KFOR-i patrullon urën mbi Ibër në Mitrovicë", excerpt: "", category: "Kosovë", publishedAt: "2026-08-21" },
  ];
  const picked = articlesForTopic("kfor", articles).map((a) => a.slug);
  assert.deepEqual(picked, ["iber"], "only the Kosovo story belongs to the KFOR file");
});