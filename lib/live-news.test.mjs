import assert from "node:assert/strict";
import test from "node:test";

import { liveHeadlinesFor, liveNewsSearchUrls, parseLiveNewsRss } from "./live-news.ts";

test("canonical search expansion finds English entity terms for Albanian market questions", () => {
  const urls = liveNewsSearchUrls("Ngushtica e Hormuzit rihapet plotësisht deri më 29 gusht?");
  const queries = urls.map((url) => decodeURIComponent(new URL(url).searchParams.get("q") ?? ""));
  assert.ok(queries.some((query) => query.includes("strait") && query.includes("hormuz")));

  const UkraineUrls = liveNewsSearchUrls("A do të shpallet një armëpushim në luftën midis Rusisë dhe Ukrainës brenda 4 muajve?");
  const ukraineQueries = UkraineUrls.map((url) => decodeURIComponent(new URL(url).searchParams.get("q") ?? ""));
  assert.ok(ukraineQueries.some((query) => query.includes("ceasefire") && query.includes("russia") && query.includes("ukraine")));
});

test("question-specific RSS results are prioritized over broad category headlines", async () => {
  const originalFetch = globalThis.fetch;
  const recent = new Date(Date.now() - 60_000).toUTCString();
  const rss = (titles) => `<rss><channel>${titles.map((title, index) => `<item><title>${title}</title><link>https://news.google.com/rss/articles/${index}-${encodeURIComponent(title)}</link><source>Test Publisher</source><pubDate>${recent}</pubDate></item>`).join("")}</channel></rss>`;
  globalThis.fetch = async (url) => {
    const query = new URL(String(url)).searchParams.get("q") ?? "";
    const titles = query.toLowerCase().includes("nvidia")
      ? ["Nvidia and Hugging Face acquisition talks remain unresolved", "Nvidia weighs next steps for Hugging Face"]
      : Array.from({ length: 10 }, (_, index) => `Broad category headline ${index}`);
    return { ok: true, text: async () => rss(titles) };
  };
  try {
    const headlines = await liveHeadlinesFor("Nvidia nënshkruan marrëveshje për blerjen e Hugging Face deri më 30 gusht?", "ekonomi");
    assert.match(headlines[0]?.title ?? "", /Nvidia/i);
    assert.ok(headlines.some((headline) => /Hugging Face/i.test(headline.title)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RSS parser preserves publisher, timestamp, and source URL", () => {
  const xml = `<rss><channel><item><title><![CDATA[Nvidia and Hugging Face talks continue]]></title><link>https://news.google.com/rss/articles/example</link><source url="https://techcrunch.com">TechCrunch</source><pubDate>Fri, 28 Aug 2026 19:30:00 GMT</pubDate></item></channel></rss>`;
  const headlines = parseLiveNewsRss(xml, Date.parse("2026-08-28T20:00:00.000Z"));
  assert.equal(headlines.length, 1);
  assert.deepEqual(headlines[0], {
    title: "Nvidia and Hugging Face talks continue",
    source: "TechCrunch",
    ageMin: 30,
    url: "https://news.google.com/rss/articles/example",
  });
});
