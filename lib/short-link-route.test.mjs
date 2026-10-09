import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as shortLinks from "./short-link.mjs";

const source = readFileSync(new URL("../app/a/[code]/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const article = { slug: "published-telegram-story" };
const dependencies = {
  "next/server": { NextResponse: { redirect(url, status) { return { location: url.href, status }; } } },
  "@/lib/db": { getArticles: async () => [article] },
  "@/lib/short-link.mjs": shortLinks,
};
const context = { exports: {}, URL, require: name => dependencies[name] };
vm.runInNewContext(compiled, context);
const get = code => context.exports.GET({ url: "https://localhost:8080/a/test" }, { params: Promise.resolve({ code }) });

test("a posted short link redirects to the public article behind Railway's proxy", async () => {
  const response = await get(shortLinks.shortCode(article.slug));
  assert.equal(response.status, 307);
  assert.equal(response.location, "https://383ks.com/article/published-telegram-story");
});

test("unknown and empty short codes resolve to the public homepage", async () => {
  assert.equal((await get("unknown")).location, "https://383ks.com/");
  assert.equal((await get("")).location, "https://383ks.com/");
});
