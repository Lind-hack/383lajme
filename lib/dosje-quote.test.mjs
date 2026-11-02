import test from "node:test";
import assert from "node:assert/strict";

import { quoteIsIn } from "./dosje-draft.mjs";

/**
 * Quotes.
 *
 * A quote is what turns a link into evidence, and since every claim now stands
 * on quotes, the match has to be exact about words and forgiving only about
 * typography a reader would never notice: curly vs straight quotes, dashes,
 * spacing and case. Anything that changes a word is a different sentence.
 */

const page =
  "Kosovo’s parliament voted on 3 August 2015 — by 82 votes — to amend the constitution, " +
  "allowing the creation of a special court.";

test("typography is not a difference", () => {
  assert.ok(quoteIsIn("Kosovo's parliament voted on 3 August 2015 - by 82 votes", page));
  assert.ok(quoteIsIn("KOSOVO’S PARLIAMENT   voted on 3 August 2015", page));
});

test("a changed word is a different sentence", () => {
  assert.ok(!quoteIsIn("Kosovo's parliament voted on 3 August 2015 - by 84 votes", page));
  assert.ok(!quoteIsIn("Kosovo's government voted on 3 August 2015", page));
});

test("a scrap too short to prove anything is not a quote", () => {
  assert.ok(!quoteIsIn("3 August 2015", page));
});
