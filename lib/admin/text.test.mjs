import assert from "node:assert/strict";
import test from "node:test";

import { decodeEntities } from "./text.ts";

/**
 * Citation titles reach the dossier review straight from scraped pages, so the
 * approver was reading "Kosovo&#039;s" where the source said "Kosovo's". Both
 * of these forms are present in live dosje_citations rows.
 */

test("zero-padded decimal entities decode", () => {
  assert.equal(
    decodeEntities("Kosovo and Serbia Sign &#039;Historic&#039; Deal"),
    "Kosovo and Serbia Sign 'Historic' Deal",
  );
});

test("hex entities decode", () => {
  assert.equal(
    decodeEntities("Kosov&#xeb;&#x27;s North"),
    "Kosovë's North",
  );
});

test("the named set decodes", () => {
  assert.equal(decodeEntities("a &lt;b&gt; &quot;c&quot; &apos;d&apos;"), 'a <b> "c" \'d\'');
});

test("a double-escaped ampersand keeps its literal entity", () => {
  // Decoding &amp; first would wrongly turn this into an apostrophe; the source
  // wrote the characters "&#39;" and meant them.
  assert.equal(decodeEntities("AT&amp;T"), "AT&T");
  assert.equal(decodeEntities("&amp;#39;"), "&#39;");
});

test("text with no entities is unchanged, and empty input is safe", () => {
  assert.equal(decodeEntities("Marrëveshja historike"), "Marrëveshja historike");
  assert.equal(decodeEntities(""), "");
});

test("a lone ampersand or a malformed entity is left alone", () => {
  assert.equal(decodeEntities("R&D"), "R&D");
  assert.equal(decodeEntities("100 &# 39;"), "100 &# 39;");
});

test("an out-of-range numeric entity is left alone rather than throwing", () => {
  // String.fromCodePoint raises RangeError above U+10FFFF. This runs inside a
  // server component over scraped titles, so a throw here 500s the page.
  assert.equal(decodeEntities("bad &#x110000; entity"), "bad &#x110000; entity");
  assert.equal(decodeEntities("bad &#1114112; entity"), "bad &#1114112; entity");
});

test("a lone surrogate half is left alone", () => {
  assert.equal(decodeEntities("&#xD800;"), "&#xD800;");
});

test("valid astral characters still decode", () => {
  assert.equal(decodeEntities("&#x1F600;"), "\u{1F600}");
});
