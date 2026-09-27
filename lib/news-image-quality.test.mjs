import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Next permits and every article card requests the sharp derivative", () => {
  const config = read("next.config.ts");
  const home = read("components/kryesore-front.tsx");
  const cards = read("components/article-card.tsx");

  assert.match(config, /qualities:\s*\[75, 90\]/);
  assert.equal((home.match(/quality=\{90\}/g) ?? []).length, 3);
  assert.equal((cards.match(/quality=\{90\}/g) ?? []).length, 4);
});

test("homepage crops request more than their narrow visible width", () => {
  const home = read("components/kryesore-front.tsx");

  assert.match(home, /100vw, 960px/);
  assert.match(home, /280px, 320px/);
  assert.match(home, /sizes="300px"/);
  assert.doesNotMatch(home, /sizes="148px"/);
  assert.doesNotMatch(home, /sizes="128px"/);
});
