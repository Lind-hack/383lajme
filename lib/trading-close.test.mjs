import { test } from "node:test";
import assert from "node:assert/strict";
import { closesAtStart, marketCloseLabel, marketTradingPhase, tradingCloseLabel, tradingClosesAt, tradingPhase } from "./trading-close.mjs";

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

test("a match card says it closes at kickoff, counting down to it", () => {
  const match = { closes_at: iso(30), live_event: { kickoff: iso(3 + 1 / 60) } };
  assert.equal(marketCloseLabel(match, { now: NOW }), "Mbyllet kur nis ndeshja · për 3 orë 1 min");
  assert.equal(marketCloseLabel(match, { now: NOW, compact: true }), "Mbyllet në fillim · 3h 1m");
  assert.equal(closesAtStart(match), true);
  assert.equal(marketCloseLabel({ closes_at: iso(5 + 1 / 60), live_event: { race_start: iso(50) } }, { now: NOW }), "Mbyllet për 5 orë 1 min");
  assert.equal(marketCloseLabel({ closes_at: iso(60), live_event: { race_start: iso(50) } }, { now: NOW }), "Mbyllet kur nis gara · për 2 ditë");
});

test("a news card counts down to its deadline", () => {
  assert.equal(tradingCloseLabel({ closesAt: iso(72) }, { now: NOW }), "Mbyllet për 3 ditë");
  assert.equal(tradingCloseLabel({ closesAt: iso(0.5) }, { now: NOW, compact: true }), "Mbyllet 30m");
  assert.equal(tradingCloseLabel({ closesAt: iso(-1) }, { now: NOW }), "Mbyllur");
  assert.equal(tradingCloseLabel({ closesAt: null }, { now: NOW }), null);
  assert.equal(closesAtStart({ closes_at: iso(3) }), false);
  assert.equal(tradingCloseLabel({ closesAt: iso(2) }, { now: NOW, compact: true }), "Mbyllet 2h");
});

test("a Nations League card counts to kickoff, not the settlement window", () => {
  const now = Date.parse("2026-10-01T16:58:30Z");
  const market = { closes_at: "2026-10-02T00:45:00+00:00", live_event: { kickoff: "2026-10-01T18:45Z" } };
  assert.equal(marketCloseLabel(market, { now, compact: true }), "Mbyllet në fillim · 1h 46m");
});
