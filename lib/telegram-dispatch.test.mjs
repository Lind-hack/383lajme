import { test } from "node:test";
import assert from "node:assert/strict";
import {
  articleUrl,
  escapeHtml,
  renderCaption,
  selectCandidates,
  CAPTION_LIMIT,
} from "./telegram-dispatch.mjs";

function hoursAgo(h, nowMs) {
  return new Date(nowMs - h * 60 * 60 * 1000).toISOString();
}

test("escapeHtml neutralises the three HTML-significant characters", () => {
  assert.equal(escapeHtml(`a & b <c> "d"`), "a &amp; b &lt;c&gt; \"d\"");
});

test("articleUrl builds the canonical production link", () => {
  assert.equal(articleUrl("some-slug"), "https://www.383ks.com/article/some-slug");
});

test("renderCaption bolds the title, keeps a short excerpt whole, links the article", () => {
  const caption = renderCaption({
    slug: "buxheti-2026",
    title: "Kuvendi aprovon buxhetin",
    excerpt: "Votimi kaloi me 71 vota pro.",
  });
  assert.ok(caption.startsWith("<b>Kuvendi aprovon buxhetin</b>\n\n"));
  assert.ok(caption.includes("Votimi kaloi me 71 vota pro."));
  // The bare URL is the point: a reader copying this into WhatsApp must
  // carry the link with them.
  assert.ok(caption.includes("Lexo më shumë: https://www.383ks.com/article/buxheti-2026"));
  assert.ok(!caption.includes("<a href="), "the link must not hide inside an anchor");
});

test("renderCaption stays inside the Telegram caption budget for long articles", () => {
  const caption = renderCaption({
    slug: "gjate",
    title: "Titull i gjatë por jo ekstrem — me disa fjalë dhe vizë",
    excerpt: "Fjali ".repeat(400),
  });
  assert.ok(caption.length <= CAPTION_LIMIT, `caption was ${caption.length}`);
  // The ellipsis marks an honest cut instead of a silent truncation.
  assert.ok(caption.includes("…"));
});

test("renderCaption never tears an escaped entity at the cut point", () => {
  const caption = renderCaption({
    slug: "entitet",
    title: "Rreth P&G dhe <mark>tags</mark>",
    excerpt: "&amp; &lt; &gt; ".repeat(200) + "fundi",
  });
  assert.ok(caption.length <= CAPTION_LIMIT);
  // No dangling "&..." fragment without its closing semicolon before the ellipsis.
  const body = caption.split("\n\n")[1] ?? "";
  assert.ok(!/&[^;&]*…$/.test(body), `torn entity in: ${body.slice(-40)}`);
});

test("renderCaption survives missing title and excerpt", () => {
  const caption = renderCaption({ slug: "vetem-link" });
  assert.ok(caption.includes(articleUrl("vetem-link")));
  assert.ok(caption.length <= CAPTION_LIMIT);
});

function makeArticles(nowMs, count, overrides = {}) {
  return Array.from({ length: count }, (_, i) => ({
    slug: `artikull-${i}`,
    title: `Artikulli ${i}`,
    featured: true,
    publishedAt: hoursAgo(i * 2, nowMs),
    ...overrides,
  }));
}

test("selectCandidates keeps only featured articles inside the freshness window", () => {
  const now = Date.parse("2026-08-22T12:00:00Z");
  const candidates = selectCandidates({
    articles: [
      ...makeArticles(now, 2),
      { slug: "vjeter", featured: true, publishedAt: hoursAgo(40, now) },
      { slug: "jo-featured", featured: false, publishedAt: hoursAgo(1, now) },
      { slug: "pa-date", featured: true, publishedAt: "" },
    ],
    postedSlugs: [],
    nowMs: now,
  });
  assert.deepEqual(
    candidates.map((a) => a.slug),
    ["artikull-0", "artikull-1"]
  );
});

test("selectCandidates skips already-posted slugs", () => {
  const now = Date.now();
  const candidates = selectCandidates({
    articles: makeArticles(now, 4),
    postedSlugs: ["artikull-0", "artikull-2"],
    nowMs: now,
  });
  assert.deepEqual(
    candidates.map((a) => a.slug),
    ["artikull-1", "artikull-3"]
  );
});

test("selectCandidates sorts newest first and respects the per-run cap", () => {
  const now = Date.now();
  const candidates = selectCandidates({
    articles: makeArticles(now, 10),
    postedSlugs: [],
    nowMs: now,
    limit: 3,
  });
  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((a) => a.slug),
    ["artikull-0", "artikull-1", "artikull-2"]
  );
});

test("selectCandidates tolerates unparseable dates without throwing", () => {
  const now = Date.now();
  const candidates = selectCandidates({
    articles: [{ slug: "x", featured: true, publishedAt: "jo-date" }],
    postedSlugs: [],
    nowMs: now,
  });
  assert.equal(candidates.length, 0);
});
