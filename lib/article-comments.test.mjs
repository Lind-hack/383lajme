import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BODY,
  avatarColor,
  bodyProblem,
  cleanBody,
  countLabel,
  countsFrom,
  initials,
  isCommentId,
  parseArticleSlugs,
  shortCount,
  threads,
} from "./article-comments.mjs";

test("a body is cleaned before it is judged", () => {
  assert.equal(cleanBody("  hello\r\n\r\n\r\n\r\nthere \u200B "), "hello\n\nthere");
  assert.equal(cleanBody("\u200B\u200B  \n "), null);
  assert.equal(cleanBody(42), null);
  assert.equal(cleanBody("a\u0000b"), "ab");
});

test("empty or too long is refused, never cut", () => {
  assert.ok(bodyProblem("   "));
  assert.equal(bodyProblem("Mirë"), null);
  assert.equal(bodyProblem("x".repeat(MAX_BODY)), null);
  assert.ok(bodyProblem("x".repeat(MAX_BODY + 1)));
  // Emoji count as one each.
  assert.equal(bodyProblem("😂".repeat(MAX_BODY)), null);
});

test("threads: newest first, replies oldest first, orphans dropped", () => {
  const rows = [
    { id: 1, parentId: null, body: "a", createdAt: "2026-10-12T08:00:00Z" },
    { id: 2, parentId: null, body: "b", createdAt: "2026-10-12T09:00:00Z" },
    { id: 3, parentId: 1, body: "r2", createdAt: "2026-10-12T10:00:00Z" },
    { id: 4, parentId: 1, body: "r1", createdAt: "2026-10-12T09:30:00Z" },
    { id: 5, parentId: 99, body: "orphan", createdAt: "2026-10-12T09:30:00Z" },
    { id: "x", parentId: null, body: "junk", createdAt: "2026-10-12T09:30:00Z" },
    null,
  ];
  const out = threads(rows);
  assert.deepEqual(out.map((t) => t.id), [2, 1]);
  assert.deepEqual(out[1].replies.map((r) => r.body), ["r1", "r2"]);
  assert.deepEqual(threads(null), []);
});

test("counts, slugs and ids from storage are untrusted", () => {
  assert.deepEqual(countsFrom([{ article_slug: "a", n: "3" }, { article_slug: "B!", n: 2 }, { article_slug: "c", n: 0 }]), { a: 3 });
  assert.deepEqual(parseArticleSlugs("a,a, b ,<x>"), ["a", "b"]);
  assert.ok(isCommentId(5));
  assert.ok(!isCommentId(0));
  assert.ok(!isCommentId("5"));
});

test("names become a steady round picture", () => {
  assert.equal(initials("Lind Sylqa"), "LS");
  assert.equal(initials("  ana "), "A");
  assert.equal(initials(""), "?");
  assert.equal(avatarColor("Lind"), avatarColor("Lind"));
});

test("counts read naturally", () => {
  assert.equal(countLabel(1), "1 koment");
  assert.equal(countLabel(0), "0 komente");
  assert.equal(countLabel(1200), "1,2 mijë komente");
  assert.equal(shortCount(999), "999");
  assert.equal(shortCount(2000), "2K");
});
