import test from "node:test";
import assert from "node:assert/strict";

import { dosjeLinkForArticle } from "./dosje-feed.mjs";

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
