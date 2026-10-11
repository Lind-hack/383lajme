import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PER_DAY,
  PER_RUN,
  RUN_EVERY_MS,
  coverArtMap,
  coverPrompt,
  isSombre,
  normalizeIndex,
  pickCoverStories,
  platePath,
  runBudget,
  withPlates,
} from "./cover-art.mjs";

const NOW = Date.parse("2026-10-11T08:00:00Z");
const iso = (t) => new Date(t).toISOString();
const story = (slug, extra = {}) => ({
  slug,
  title: "Kurti takon von der Leyen në Bruksel",
  excerpt: "Takimi zgjati një orë.",
  imageUrl: `https://img.example/${slug}.jpg`,
  publishedAt: iso(NOW - 3600_000),
  engagementScore: 5,
  ...extra,
});

test("people are drawn affectionately; sombre stories get the place, never people", () => {
  assert.match(coverPrompt(story("a")), /same people/);
  assert.match(coverPrompt(story("a")), /never mocking/);
  const sad = story("b", { title: "Dy të vdekur në aksident në Ferizaj" });
  assert.ok(isSombre(sad));
  assert.match(coverPrompt(sad), /Remove every person/);
  assert.doesNotMatch(coverPrompt(sad), /same people/);
});

test("only fresh stories with their own photo, not yet drawn, best first", () => {
  const index = withPlates(null, "2026-10-11", [{ slug: "done", path: platePath("2026-10-11", "done") }], NOW - RUN_EVERY_MS * 2);
  const picked = pickCoverStories(
    [
      story("low", { engagementScore: 1 }),
      story("done", { engagementScore: 99 }),
      story("old", { publishedAt: iso(NOW - 40 * 3600_000), engagementScore: 50 }),
      story("nophoto", { imageUrl: "", engagementScore: 40 }),
      story("http", { imageUrl: "http://insecure/x.jpg", engagementScore: 30 }),
      story("top", { engagementScore: 20 }),
    ],
    index,
    { now: NOW, max: 5 }
  );
  assert.deepEqual(picked.map((a) => a.slug), ["top", "low"]);
});

test("runs are spaced and the day is capped", () => {
  assert.equal(runBudget(null, "2026-10-11", NOW), PER_RUN);
  const justRan = withPlates(null, "2026-10-11", [], NOW - 1000);
  assert.equal(runBudget(justRan, "2026-10-11", NOW), 0);
  const full = { ...withPlates(null, "2026-10-11", [], NOW - RUN_EVERY_MS - 1), made: MAX_PER_DAY };
  assert.equal(runBudget(full, "2026-10-11", NOW), 0);
  assert.equal(runBudget(full, "2026-10-12", NOW), PER_RUN, "a new day starts over");
});

test("the index keeps what it made, counts the day, and drops junk and old plates", () => {
  let index = withPlates(null, "2026-10-11", [{ slug: "a", path: platePath("2026-10-11", "a") }], NOW);
  index = withPlates(index, "2026-10-11", [{ slug: "b", path: platePath("2026-10-11", "b") }, { slug: "BAD", path: "x" }], NOW + 1);
  assert.equal(index.made, 3);
  assert.deepEqual(Object.keys(index.items).sort(), ["a", "b"]);
  const later = normalizeIndex(index, NOW + 15 * 24 * 3600_000);
  assert.deepEqual(later.items, {});
  for (const junk of [null, 1, "x", { v: 2 }, { v: 1, items: { "a b": { path: "x", at: "y" } } }]) {
    assert.deepEqual(normalizeIndex(junk, NOW).items, {});
  }
});

test("the public map", () => {
  const index = withPlates(null, "2026-10-11", [{ slug: "a", path: platePath("2026-10-11", "a") }], NOW);
  assert.deepEqual(coverArtMap(index, "https://x.supabase.co/storage/v1/object/public/perty-cover-art", NOW), {
    a: "https://x.supabase.co/storage/v1/object/public/perty-cover-art/2026-10-11/a.webp",
  });
  assert.deepEqual(coverArtMap(index, "", NOW), {});
});
