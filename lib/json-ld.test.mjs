import test from "node:test";
import assert from "node:assert/strict";
import { jsonLdString } from "./json-ld.ts";

/**
 * The article page builds this JSON-LD from `title`, `excerpt` and `body` --
 * text that came from an external news site, went through an LLM rewrite, and
 * was stored without HTML stripped. JSON.stringify does not escape `</script>`,
 * so a value carrying it closed the block early and everything after it was
 * parsed as markup.
 */

test("a closing script tag cannot escape the block", () => {
  const out = jsonLdString({ headline: "</script><script>alert(1)</script>" });
  assert.ok(!out.includes("</script>"), "the literal sequence must not survive");
  assert.ok(!out.includes("<"), "no raw < at all");
  assert.ok(out.includes("\\u003c"));
});

test("the escaped output still parses back to the original value", () => {
  // Escaping must not corrupt the data: < is a valid JSON escape for "<",
  // so a consumer reading the tag gets exactly what was put in.
  const data = {
    headline: "Kosova & Serbia: <b>bisedimet</b>",
    description: "Një thënie me \"thonjëza\" dhe një </script> brenda.",
  };
  assert.deepEqual(JSON.parse(jsonLdString(data)), data);
});

test("an html comment opener cannot start a comment either", () => {
  // <!-- inside a script also changes how the parser reads the rest.
  const out = jsonLdString({ headline: "<!--" });
  assert.ok(!out.includes("<!--"));
});

test("javascript line terminators are escaped", () => {
  // U+2028 and U+2029 are legal in a JSON string but terminate a line in
  // JavaScript source, so an unescaped one breaks the script with no tag at all.
  const out = jsonLdString({ headline: `a\u2028b\u2029c` });
  assert.ok(!out.includes("\u2028") && !out.includes("\u2029"));
  assert.equal(JSON.parse(out).headline, "a\u2028b\u2029c");
});

test("ampersands are escaped, so entity tricks do not survive either", () => {
  const out = jsonLdString({ headline: "&lt;/script&gt;" });
  assert.ok(!out.includes("&"));
  assert.equal(JSON.parse(out).headline, "&lt;/script&gt;");
});

test("ordinary Albanian text is unharmed", () => {
  const data = { headline: "Dialogu Kosovë–Serbi: çështja e asociacionit" };
  assert.deepEqual(JSON.parse(jsonLdString(data)), data);
});
