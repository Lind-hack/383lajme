import assert from "node:assert/strict";
import test from "node:test";
import { XHEP_DICT, resolveXhepLang } from "./i18n.ts";

test("the URL wins, then the cookie, then English", () => {
  assert.equal(resolveXhepLang("sq", "en"), "sq");
  assert.equal(resolveXhepLang(["sq", "en"], undefined), "sq");
  assert.equal(resolveXhepLang(undefined, "sq"), "sq");
  assert.equal(resolveXhepLang("de", "sq"), "sq");
  assert.equal(resolveXhepLang(undefined, undefined), "en");
  assert.equal(resolveXhepLang("<script>", "__proto__"), "en");
});

test("both languages carry every key, and none is empty", () => {
  const walk = (node, path = []) =>
    typeof node === "string" ? [[path.join("."), node]] : Object.entries(node).flatMap(([k, v]) => walk(v, [...path, k]));
  const en = new Map(walk(XHEP_DICT.en));
  const sq = new Map(walk(XHEP_DICT.sq));
  assert.deepEqual([...en.keys()].sort(), [...sq.keys()].sort());
  for (const [key, value] of [...en, ...sq]) assert.ok(value.trim().length > 0, key);
});
