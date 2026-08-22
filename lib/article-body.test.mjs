import { test } from "node:test";
import assert from "node:assert/strict";
import { toParagraphs, readingMinutes, looksLikeHtml } from "./article-body.mjs";

test("an HTML body becomes paragraphs, not printed markup", () => {
  // What every article on the site was doing: rendering its own tags.
  const body = "<p>Fjalia e parë.</p><p>Fjalia e dytë.</p>";
  assert.deepEqual(toParagraphs(body), ["Fjalia e parë.", "Fjalia e dytë."]);
});

test("plain-text bodies still split on blank lines", () => {
  assert.deepEqual(toParagraphs("Një.\n\nDy.\n\n\nTre."), ["Një.", "Dy.", "Tre."]);
});

test("entities are decoded", () => {
  assert.deepEqual(toParagraphs("<p>Nj&euml;? &amp; &quot;po&quot; &#39;jo&#39;</p>")[0],
    'Nj&euml;? & "po" \'jo\'');
});

test("inline tags are stripped without gluing words together", () => {
  const [p] = toParagraphs("<p>Kjo <strong>është</strong> e <em>rëndësishme</em>.</p>");
  assert.ok(!p.includes("<"));
  assert.ok(p.includes("është"));
  assert.ok(!/\s{2,}/.test(p), `double spaces left in: ${p}`);
});

test("line breaks inside a paragraph become their own paragraphs", () => {
  assert.deepEqual(toParagraphs("<p>Një<br/>Dy</p>"), ["Një", "Dy"]);
});

test("empty and tag-only bodies produce nothing rather than blank paragraphs", () => {
  assert.deepEqual(toParagraphs(""), []);
  assert.deepEqual(toParagraphs("<p></p><p>   </p>"), []);
  assert.deepEqual(toParagraphs(null), []);
});

test("html is detected only when it is really markup", () => {
  assert.equal(looksLikeHtml("<p>po</p>"), true);
  assert.equal(looksLikeHtml("2 < 3 dhe 4 > 1"), false);
});

test("reading time counts words, not tags", () => {
  const words = Array.from({ length: 400 }, () => "fjalë").join(" ");
  const plain = readingMinutes(words);
  const wrapped = readingMinutes(`<p>${words}</p>`);
  assert.equal(plain, 2);
  assert.equal(wrapped, plain, "markup should not inflate the estimate");
});
