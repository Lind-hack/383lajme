import test from "node:test";
import assert from "node:assert/strict";
import { evidenceLink } from "./tregu-evidence.mjs";

test("research evidence links to the publisher, named, never to a 404 article page", () => {
  const story = { url: "https://www.gazetaexpress.com/von-der-leyen-hapi/", slug: "research-11e702c742d34aa835432df2", title: "Von der Leyen", source: "gazetaexpress.com", publishedAt: "2026-10-01T13:35:30+00:00" };
  assert.deepEqual(evidenceLink(story), { href: story.url, external: true, source: "gazetaexpress.com", publishedAt: story.publishedAt });
});

test("no source field: the URL's host names it", () => {
  assert.equal(evidenceLink({ url: "https://www.euronews.al/x", slug: "research-1" }).source, "euronews.al");
});

test("383's own articles stay internal", () => {
  assert.deepEqual(evidenceLink({ slug: "kurti-takim-20261002" }), { href: "/article/kurti-takim-20261002", external: false, source: "383", publishedAt: null });
  assert.equal(evidenceLink({ slug: "kurti-takim", url: "https://383ks.com/article/kurti-takim" }).href, "/article/kurti-takim");
});

test("an unusable URL gives no link rather than a broken one", () => {
  assert.equal(evidenceLink({ slug: "research-2", url: "javascript:alert(1)" }).href, null);
  assert.equal(evidenceLink({ slug: "research-3" }).href, null);
  assert.equal(evidenceLink({ slug: "research-3", source: "kallxo.com" }).source, "kallxo.com");
});
