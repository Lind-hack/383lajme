import test from "node:test";
import assert from "node:assert/strict";
import {
  featuredMarketScore,
  isStructuredSportMarket,
  marketVolume,
  normalizeRecordedOutcomeSeries,
  outcomeColor,
  separateOutcomeColors,
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

test("two clubs in the same colour get two different lines", () => {
  // Levante and Athletic Club, both red; the draw stays grey.
  const [home, draw, away] = separateOutcomeColors(["#C8142F", "#777772", "#C8142F"]);
  assert.equal(home, "#C8142F");
  assert.equal(draw, "#777772");
  assert.notEqual(away, "#C8142F");
  assert.equal(away, "#1E5BB8");
  // Near-identical reds count as a clash too; distinct kits are left alone.
  assert.notEqual(separateOutcomeColors(["#C8142F", "#E41E20"])[1], "#E41E20");
  assert.deepEqual(separateOutcomeColors(["#C8142F", "#123456"]), ["#C8142F", "#123456"]);
});

test("team lines stay visible on both themes, keeping their hue", async () => {
  const { themeInk } = await import("./tregu-hub-market.mjs");
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Getafe navy and Cagliari's dark blue disappeared on the dark card.
  for (const kit of ["#00008B", "#1E1B4B", "#C8142F", "#0E7C66"]) {
    assert.ok(ratio(themeInk(kit, "dark"), "#24221F") >= 3, `${kit} on dark`);
    assert.ok(ratio(themeInk(kit, "light"), "#FFFFFF") >= 3, `${kit} on light`);
  }
  // Juventus black and white kits take the theme's ink, never the draw grey.
  assert.equal(themeInk("#000000", "dark"), "#ECE8E1");
  assert.equal(themeInk("#FFFFFF", "light"), "#1F1D1A");
  assert.equal(themeInk("#777772", "dark"), "#777772");
  // A colour that already reads is left exactly as the club publishes it.
  assert.equal(themeInk("#C8142F", "light"), "#C8142F");
  assert.equal(themeInk("not-a-colour", "dark"), "not-a-colour");
});
