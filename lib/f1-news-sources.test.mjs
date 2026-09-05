import test from "node:test";
import assert from "node:assert/strict";

import {
  F1_FEEDS,
  F1_PUBLISHERS,
  extractF1Penalties,
  parseF1Feed,
  publisherOfUrl,
} from "./f1-news-sources.mjs";

const ROSTER = [{ key: "ANT" }, { key: "NOR" }, { key: "LEC" }, { key: "VER" }];

function feed(items) {
  return (
    "<rss><channel>" +
    items
      .map(
        (item) =>
          "<item><title>" + item.title + "</title><link>" + item.url + "</link>" +
          "<pubDate>" + (item.date ?? new Date().toUTCString()) + "</pubDate></item>"
      )
      .join("") +
    "</channel></rss>"
  );
}

test("only allowlisted motorsport publishers are read", () => {
  assert.equal(publisherOfUrl("https://www.autosport.com/f1/news/x"), "Autosport");
  assert.equal(publisherOfUrl("https://www.formula1.com/en/latest/article/x"), "Formula 1");
  // A random blog reprinting the same claim is not a second publisher.
  assert.equal(publisherOfUrl("https://f1-rumours.example/x"), null);
  assert.equal(publisherOfUrl("not a url"), null);
  assert.equal(publisherOfUrl(""), null);
});

test("every configured feed belongs to an allowlisted publisher", () => {
  for (const url of F1_FEEDS) {
    const host = new URL(url).hostname.replace(/^www\./, "").replace(/^feeds\./, "");
    const known = Object.keys(F1_PUBLISHERS).some((publisher) => host === publisher || host.endsWith("." + publisher));
    assert.ok(known, `${url} is not covered by the publisher allowlist`);
  }
});

test("stale items and unknown publishers drop out of a feed", () => {
  const xml = feed([
    { title: "Fresh", url: "https://www.autosport.com/a" },
    { title: "Ancient", url: "https://www.autosport.com/b", date: new Date(Date.now() - 90 * 86400000).toUTCString() },
    { title: "Unvetted", url: "https://aggregator.example/c" },
  ]);
  const items = parseF1Feed(xml, { maxAgeMin: 60 });
  assert.deepEqual(items.map((item) => item.title), ["Fresh"]);
});

test("a penalty two publishers report is applied in the model's own shape", async () => {
  const headlines = [
    { title: "Antonelli handed 10-place grid penalty", url: "https://www.autosport.com/a", publisher: "Autosport", summary: "" },
    { title: "Antonelli to drop ten places at Monza", url: "https://www.motorsport.com/b", publisher: "Motorsport.com", summary: "" },
  ];
  const llm = async () => ({ events: [{ driver: "ANT", event: "grid_penalty", places: 10, reason: "gearbox", cited: [0, 1] }] });
  const out = await extractF1Penalties({ headlines, roster: ROSTER, llm });

  assert.equal(out.applied.ANT.grid_penalty_places, 10);
  assert.deepEqual(out.applied.ANT.publishers, ["Autosport", "Motorsport.com"]);
  assert.match(out.applied.ANT.source, /autosport\.com/);
  assert.equal(out.pending.length, 0);
});

test("one publisher is reported but never priced", async () => {
  const headlines = [
    { title: "Antonelli handed 10-place grid penalty", url: "https://www.autosport.com/a", publisher: "Autosport", summary: "" },
  ];
  const llm = async () => ({ events: [{ driver: "ANT", event: "grid_penalty", places: 10, reason: "gearbox", cited: [0] }] });
  const out = await extractF1Penalties({ headlines, roster: ROSTER, llm });

  assert.deepEqual(out.applied, {});
  assert.equal(out.pending.length, 1);
  assert.equal(out.pending[0].held_because, "one_publisher");
});

test("a penalty with no stated number of places is refused", async () => {
  const headlines = [
    { title: "Antonelli faces a grid penalty", url: "https://www.autosport.com/a", publisher: "Autosport", summary: "" },
    { title: "Antonelli set for grid drop", url: "https://www.motorsport.com/b", publisher: "Motorsport.com", summary: "" },
  ];
  const llm = async () => ({ events: [{ driver: "ANT", event: "grid_penalty", reason: "unclear", cited: [0, 1] }] });
  const out = await extractF1Penalties({ headlines, roster: ROSTER, llm });
  assert.deepEqual(out.applied, {});
});

test("invented drivers and invented event types are dropped", async () => {
  const headlines = [
    { title: "x", url: "https://www.autosport.com/a", publisher: "Autosport", summary: "" },
    { title: "y", url: "https://www.motorsport.com/b", publisher: "Motorsport.com", summary: "" },
  ];
  const llm = async () => ({
    events: [
      { driver: "ZZZ", event: "grid_penalty", places: 5, cited: [0, 1] },
      { driver: "NOR", event: "bad_weekend_predicted", places: 5, cited: [0, 1] },
    ],
  });
  const out = await extractF1Penalties({ headlines, roster: ROSTER, llm });
  assert.deepEqual(out.applied, {});
  assert.deepEqual(out.pending, []);
});

test("a withdrawal becomes the model's not-starting status", async () => {
  const headlines = [
    { title: "Verstappen withdraws from the Italian GP", url: "https://www.formula1.com/a", publisher: "Formula 1", summary: "" },
    { title: "Verstappen out of Monza", url: "https://www.bbc.co.uk/sport/b", publisher: "BBC Sport", summary: "" },
  ];
  const llm = async () => ({ events: [{ driver: "VER", event: "withdrawal", reason: "illness", cited: [0, 1] }] });
  const out = await extractF1Penalties({ headlines, roster: ROSTER, llm });
  assert.equal(out.applied.VER.status, "out");
});

test("an LLM failure returns no penalties rather than throwing into the run", async () => {
  const headlines = [{ title: "x", url: "https://www.autosport.com/a", publisher: "Autosport", summary: "" }];
  const llm = async () => {
    throw new Error("groq down");
  };
  const out = await extractF1Penalties({ headlines, roster: ROSTER, llm });
  assert.deepEqual(out.applied, {});
  assert.equal(out.reason, "llm_failed");
});
