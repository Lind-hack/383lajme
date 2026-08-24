import test from "node:test";
import assert from "node:assert/strict";
import {
  featuredMarketScore,
  isStructuredSportMarket,
  marketVolume,
  normalizeRecordedOutcomeSeries,
  outcomeColor,
  toExactSeries,
} from "./tregu-hub-market.mjs";

test("independent event books normalize only at recorded timestamps", () => {
  const normalized = normalizeRecordedOutcomeSeries([
    { key: "home", points: [{ t: 10, p: 0.4 }, { t: 30, p: 0.6 }] },
    { key: "draw", points: [{ t: 20, p: 0.4 }] },
  ]);
  assert.deepEqual(normalized.home, [{ t: 20, p: 0.5 }, { t: 30, p: 0.6 }]);
  assert.deepEqual(normalized.draw, [{ t: 20, p: 0.5 }, { t: 30, p: 0.4 }]);
  assert.ok(Object.values(normalized).flat().every((point) => [20, 30].includes(point.t)));
});

test("exact history sorts, clamps and deduplicates without invented points", () => {
  const points = toExactSeries([
    { created_at: "2026-08-23T10:05:00Z", probability: 1.2 },
    { created_at: "2026-08-23T10:00:00Z", probability: 0.42 },
    { created_at: "2026-08-23T10:05:00Z", probability: 0.61 },
    { created_at: "invalid", probability: 0.5 },
  ]);
  assert.deepEqual(points.map((point) => point.p), [0.42, 0.61]);
  assert.equal(points.length, 2);
});

test("native sport books are distinguished from binary compatibility fields", () => {
  const market = {
    market_type: "three_outcome",
    sport_outcomes: [{ key: "home" }, { key: "draw" }, { key: "away" }],
    outcome_probabilities: { home: 0.4, draw: 0.3, away: 0.3 },
    q_yes: 0,
    q_no: 0,
    trade_volume: 325,
  };
  assert.equal(isStructuredSportMarket(market), true);
  assert.equal(marketVolume(market), 325);
});

test("draw stays neutral while verified team colours are preserved", () => {
  assert.equal(outcomeColor({ key: "draw", label: "Barazim", color: "#ff0000" }), "#777772");
  assert.equal(outcomeColor({ key: "home", label: "Kosova", color: "#123ABC" }), "#123ABC");
});

test("pale official team colours derive a visible chart shade", () => {
  assert.equal(outcomeColor({ key: "home", label: "Valencia", color: "#FFFFFF" }, 0), "#8B8B8B");
  assert.equal(outcomeColor({ key: "away", label: "Chelsea", color: "#123456" }, 1), "#123456");
});

test("real recent movement outranks an older static market", () => {
  const now = Date.parse("2026-08-23T12:00:00Z");
  const active = {
    history: [
      { created_at: "2026-08-23T10:00:00Z", probability: 0.4 },
      { created_at: "2026-08-23T11:55:00Z", probability: 0.62 },
    ],
    trade_count: 8,
    trade_volume: 500,
  };
  const staticOld = {
    history: [{ created_at: "2026-08-10T10:00:00Z", probability: 0.5 }],
    trade_count: 0,
    trade_volume: 0,
  };
  assert.ok(featuredMarketScore(active, now) > featuredMarketScore(staticOld, now));
});
