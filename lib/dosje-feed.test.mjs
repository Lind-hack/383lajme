import test from "node:test";
import assert from "node:assert/strict";

import { dosjeFeedEntries, dosjeLinkForArticle, isDosjeActivationKey } from "./dosje-feed.mjs";

test("dosjeLinkForArticle returns a clickable dossier destination for a matched article", () => {
  assert.deepEqual(
    dosjeLinkForArticle({
      title: "KFOR hap urën e Ibrit",
      excerpt: "KFOR-i dhe siguria në Kosovë.",
      category: "Kosovë",
    }),
    {
      slug: "kfor",
      title: "KFOR-i në Kosovë",
      href: "/dosje/kfor",
    }
  );
});

test("dosjeLinkForArticle hides the chip for an unrelated article", () => {
  assert.equal(
    dosjeLinkForArticle({
      title: "Brazili padit një platformë bisedash",
      excerpt: "Një çështje teknologjie pa lidhje me temat e Dosjeve.",
      category: "Teknologji",
    }),
    null
  );
});

test("isDosjeActivationKey supports keyboard link activation without treating other keys as clicks", () => {
  assert.equal(isDosjeActivationKey("Enter"), true);
  assert.equal(isDosjeActivationKey(" "), true);
  assert.equal(isDosjeActivationKey("Tab"), false);
  assert.equal(isDosjeActivationKey("Escape"), false);
});

test("dosjeFeedEntries exposes separate article and dossier links for every matched story", () => {
  assert.deepEqual(
    dosjeFeedEntries([
      { slug: "kfor-ura", title: "KFOR hap urën e Ibrit", excerpt: "KFOR-i në Kosovë.", category: "Kosovë" },
      { slug: "pa-dosje", title: "Një lajm teknologjie", excerpt: "Një lajm tjetër.", category: "Teknologji" },
    ]),
    [{
      articleSlug: "kfor-ura",
      articleTitle: "KFOR hap urën e Ibrit",
      dossierSlug: "kfor",
      dossierTitle: "KFOR-i në Kosovë",
      articleHref: "/article/kfor-ura",
      dossierHref: "/dosje/kfor",
    }]
  );
});
