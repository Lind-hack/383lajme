import test from "node:test";
import assert from "node:assert/strict";
import { findFlashscoreGame, flashscoreObservation, parseFlashscoreBasketball, resetFlashscoreCache } from "./fbk-flashscore.mjs";
import { fetchLinkedFbkLiveStats } from "./fbk-livestats.mjs";
import { buildFbkMarkets } from "./fbk-basketball.mjs";

const at = (iso) => Math.round(Date.parse(iso) / 1000);
const row = (id, fields) => `~AA÷${id}¬` + Object.entries(fields).map(([k, v]) => `${k}÷${v}¬`).join("");
// Shapes copied from the live competition page on 2026-09-29.
const page = [
  row("nX9B319M", { AD: at("2026-09-27T17:00:00Z"), AB: 3, AC: 3, AE: "Golden Eagle Ylli", AF: "Bora", AG: 64, AH: 75, BA: 12, BB: 20, BC: 21, BD: 21, BE: 11, BF: 15, BG: 20, BH: 19 }),
  row("ry1zKMg3", { AD: at("2026-10-03T15:00:00Z"), AB: 2, AC: 23, AE: "Bora", AF: "Rahoveci", AG: 41, AH: 33, BA: 22, BB: 18, BC: 19, BD: 15 }),
  row("jsEldJ1d", { AD: at("2026-10-03T17:30:00Z"), AB: 1, AC: 1, AE: "Bashkimi", AF: "Trepca" }),
].join("");

const fixture = (home, away, kickoff) => ({ provider: "fbk", event_id: `fbk-${home}`, league: "fbk.kosovo", sport: "basketball", home_team: home, away_team: away, kickoff, source_url: "https://www.basketbolli.com/", home_score: null, away_score: null, live_stats_url: null });

test("parses status, scores and the period from quarter scores", () => {
  const rows = parseFlashscoreBasketball(page);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => [r.status, r.period]), [["finished", 4], ["live", 2], ["scheduled", 0]]);
  assert.equal(rows[1].home_score, 41);
});

test("matches federation names with accents and suffixes, by kickoff", () => {
  const rows = parseFlashscoreBasketball(page);
  assert.equal(findFlashscoreGame(fixture("Bora", "Rahoveci 029", "2026-10-03T15:00:00.000Z"), rows)?.id, "ry1zKMg3");
  assert.equal(findFlashscoreGame(fixture("Bashkimi", "Trepça", "2026-10-03T17:30:00.000Z"), rows)?.id, "jsEldJ1d");
  // Same teams, another day: not the same game.
  assert.equal(findFlashscoreGame(fixture("Bora", "Rahoveci 029", "2026-10-10T15:00:00.000Z"), rows), null);
});

test("a live game prices on the score with an estimated clock", () => {
  const rows = parseFlashscoreBasketball(page);
  const game = fixture("Bora", "Rahoveci 029", "2026-10-03T15:00:00.000Z");
  const observed = flashscoreObservation(game, findFlashscoreGame(game, rows), new Date("2026-10-03T15:50:00Z"));
  assert.equal(observed.status, "STATUS_IN_PROGRESS");
  assert.equal(observed.has_official_score, true);
  assert.deepEqual([observed.period, observed.clock_seconds], [2, 300]);
  assert.deepEqual(observed.competitors.map((c) => c.score), [41, 33]);
  assert.equal(observed.source_label, "Flashscore");
});

test("Flashscore never settles: a finished game waits for the federation", () => {
  const rows = parseFlashscoreBasketball(page);
  const game = fixture("Golden Eagle Ylli", "Bora", "2026-09-27T17:00:00.000Z");
  const observed = flashscoreObservation(game, findFlashscoreGame(game, rows), new Date("2026-09-27T19:30:00Z"));
  assert.equal(observed.status, "STATUS_IN_PROGRESS");
  assert.equal(observed.clock_seconds, 0);
  // Once the federation publishes, its final is used and Flashscore adds nothing.
  const published = { ...game, home_score: 64, away_score: 75 };
  assert.equal(flashscoreObservation(published, findFlashscoreGame(published, rows), new Date("2026-09-27T20:00:00Z")), null);
});

test("fetchLinkedFbkLiveStats falls back to Flashscore when LiveStats lists no game", async () => {
  resetFlashscoreCache();
  const game = fixture("Bora", "Rahoveci 029", "2026-10-03T15:00:00.000Z");
  const fetchImpl = async (url) => {
    if (String(url).includes("geniussports")) return new Response(JSON.stringify([]), { status: 200 });
    if (String(url).includes("flashscore")) return new Response(page, { status: 200 });
    throw new Error(`unexpected ${url}`);
  };
  const observed = await fetchLinkedFbkLiveStats(game, { now: new Date("2026-10-03T15:50:00Z"), fetchImpl });
  assert.equal(observed.status, "STATUS_IN_PROGRESS");
  assert.equal(observed.supplemental.fbk.availability, "flashscore_live");
  // Before tip-off nothing is fetched from Flashscore and the schedule stands.
  const early = await fetchLinkedFbkLiveStats(game, { now: new Date("2026-10-03T14:00:00Z"), fetchImpl });
  assert.equal(early.status, "STATUS_SCHEDULED");
});

test("the next round is open all week", () => {
  const games = [fixture("Bora", "Rahoveci 029", "2026-10-03T15:00:00.000Z")].map((g) => ({ ...g, opening_model: { probabilities: { home: 0.6, away: 0.4 }, method: "test" } }));
  assert.equal(buildFbkMarkets(games, { now: new Date("2026-09-29T19:00:00Z") }).length, 1);
  assert.equal(buildFbkMarkets(games, { now: new Date("2026-09-25T19:00:00Z") }).length, 0);
});
