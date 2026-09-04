import assert from "node:assert/strict";
import test from "node:test";

import { SEARCH_FIELDS, orGroupFor, searchTokens } from "./search-terms.ts";

/**
 * Admin article search.
 *
 * The old panel filtered 1,228 client-side rows on title and source only. This
 * runs in Postgres across the body as well, which means the operator's raw
 * text is interpolated into a PostgREST filter — so these tests are as much
 * about the query surviving as about it matching.
 */

test("a comma in the query does not break the filter", () => {
  // PostgREST would read the comma as the end of the or() clause and 400.
  assert.deepEqual(searchTokens("Kosova, Serbia"), ["Kosova", "Serbia"]);
  // No token may carry a separator into the clause it is interpolated into.
  for (const token of searchTokens("Kosova, Serbia")) {
    assert.ok(!/[(),]/.test(token), `token "${token}" would break or()`);
  }
});

test("parentheses are stripped rather than passed through", () => {
  assert.deepEqual(searchTokens("Real (Madrid)"), ["Real", "Madrid"]);
});

test("ilike wildcards typed by the operator are removed", () => {
  // A bare % would otherwise match every row and read as "search is broken".
  assert.deepEqual(searchTokens("50%"), ["50"]);
  assert.deepEqual(searchTokens("a_b"), ["ab"]);
  assert.deepEqual(searchTokens("100%"), ["100"]);
});

test("an apostrophe splits rather than terminating the filter", () => {
  assert.deepEqual(searchTokens("o'brien"), ["o", "brien"]);
});

test("multi-word search yields one token per word, so terms AND together", () => {
  // The behaviour that makes the box usable: both words must appear, but they
  // need not be adjacent. Verified live: kosov=23 rows, serbi=6, together=2.
  assert.deepEqual(searchTokens("kosov serbi"), ["kosov", "serbi"]);
});

test("empty and whitespace-only queries produce no tokens", () => {
  assert.deepEqual(searchTokens(""), []);
  assert.deepEqual(searchTokens("   "), []);
  assert.deepEqual(searchTokens(",,, ((( "), []);
});

test("a pathological query is bounded in both count and length", () => {
  assert.equal(searchTokens("a b c d e f g h i j").length, 6);
  assert.equal(searchTokens("x".repeat(500))[0].length, 40);
});

test("the or() group covers every searchable column exactly once", () => {
  const group = orGroupFor("kosov");
  const clauses = group.split(",");
  assert.equal(clauses.length, SEARCH_FIELDS.length);
  for (const field of SEARCH_FIELDS) {
    assert.ok(clauses.includes(`${field}.ilike.%kosov%`), `missing ${field}`);
  }
});

test("body is searched but is not a column the list returns", () => {
  // The whole point: match on body text without shipping 1.5 MB of it.
  assert.ok(SEARCH_FIELDS.includes("body"));
});
