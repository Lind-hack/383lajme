import { test } from "node:test";
import assert from "node:assert/strict";
import { marketTradingPhase, tradingClosesAt, tradingPhase } from "./trading-close.mjs";

const NOW = Date.UTC(2026, 9, 1, 18);
const iso = (h) => new Date(NOW + h * 3_600_000).toISOString();

test("a match trades until kickoff, then is live until settled", () => {
  const match = { status: "open", closes_at: iso(6), live_event: { kickoff: iso(1) } };
  assert.equal(tradingClosesAt(match), iso(1));
  assert.equal(marketTradingPhase(match, NOW), "open");
  assert.equal(marketTradingPhase(match, NOW + 2 * 3_600_000), "live");
  assert.equal(marketTradingPhase({ ...match, status: "resolved" }, NOW + 2 * 3_600_000), "closed");
});

test("an F1 race goes live at race_start", () => {
  assert.equal(marketTradingPhase({ status: "open", closes_at: iso(5), live_event: { race_start: iso(-1) } }, NOW), "live");
});

test("a news market past its deadline is closed, not live", () => {
  assert.equal(marketTradingPhase({ status: "open", closes_at: iso(-1) }, NOW), "closed");
  assert.equal(marketTradingPhase({ status: "open", closes_at: iso(3) }, NOW), "open");
});

test("tradingPhase works from a mini card's closesAt", () => {
  assert.equal(tradingPhase({ status: "open", closesAt: iso(-0.5), hasStart: true }, NOW), "live");
  assert.equal(tradingPhase({ status: "open", closesAt: iso(-0.5), hasStart: false }, NOW), "closed");
  assert.equal(tradingPhase({ closesAt: null }, NOW), "open");
});
