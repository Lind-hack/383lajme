import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPortfolioAnalytics,
  buildRealizedBalanceHistory,
  outcomePrices,
} from "./tregu-portfolio.mjs";

const market = (overrides = {}) => ({
  id: "m1",
  slug: "kampioni",
  question: "Kush fiton?",
  status: "open",
  category: "sport",
  market_type: "f1_race_winner",
  b: 100,
  sport_outcomes: [
    { key: "AAA", label: "Arbër A.", team: "Orange" },
    { key: "BBB", label: "Blerim B.", team: "Ink" },
  ],
  outcome_quantities: { AAA: 30, BBB: 0 },
  ...overrides,
});

test("multi-outcome prices are a stable normalized LMSR book", () => {
  const prices = outcomePrices(market());
  assert.ok(prices.AAA > prices.BBB);
  assert.ok(Math.abs(prices.AAA + prices.BBB - 1) < 1e-12);
});

test("buying an unresolved position does not move realized balance history", () => {
  const analytics = buildPortfolioAnalytics({
    profile: { coins: 900 },
    positions: [{ id: "p1", market_id: "m1", side: "AAA", shares: 125, coins_staked: 100, markets: market() }],
    transactions: [{ id: "t1", market_id: "m1", type: "bet", amount: -100, created_at: "2026-08-20T12:00:00Z", meta: { side: "AAA" }, markets: market() }],
    now: new Date("2026-08-31T12:00:00Z"),
  });
  assert.equal(analytics.stats.realizedBalance, 1000);
  assert.equal(analytics.stats.pnl30d, 0);
  assert.deepEqual(analytics.balanceHistory.map((point) => point.coins), [1000, 1000]);
});

test("a completed trade moves the chart once by its exact realized P/L", () => {
  const closed = market({ status: "resolved", outcome: "AAA", resolved_at: "2026-08-25T15:00:00Z" });
  const analytics = buildPortfolioAnalytics({
    profile: { coins: 1125 },
    positions: [],
    transactions: [
      { id: "t1", market_id: "m1", type: "bet", amount: -100, created_at: "2026-08-20T12:00:00Z", meta: { side: "AAA" }, markets: closed },
      { id: "t2", market_id: "m1", type: "payout", amount: 225, created_at: "2026-08-25T15:00:00Z", meta: { side: "AAA" }, markets: closed },
    ],
    now: new Date("2026-08-31T12:00:00Z"),
  });
  assert.equal(analytics.stats.pnl30d, 125);
  assert.equal(analytics.tradeHistory[0].result, "win");
  assert.equal(analytics.tradeHistory[0].invested, 100);
  assert.equal(analytics.tradeHistory[0].returned, 225);
  assert.deepEqual(analytics.balanceHistory.map((point) => point.coins), [1000, 1125, 1125]);
});

test("losses are represented at settlement even when there is no payout row", () => {
  const closed = market({ status: "resolved", outcome: "BBB", resolved_at: "2026-08-26T18:00:00Z" });
  const analytics = buildPortfolioAnalytics({
    profile: { coins: 900 },
    positions: [],
    transactions: [
      { id: "t1", market_id: "m1", type: "bet", amount: -100, created_at: "2026-08-20T12:00:00Z", meta: { side: "AAA" }, markets: closed },
    ],
    now: new Date("2026-08-31T12:00:00Z"),
  });
  assert.equal(analytics.tradeHistory[0].pnl, -100);
  assert.equal(analytics.tradeHistory[0].result, "loss");
  assert.equal(analytics.stats.pnl30d, -100);
});

test("partial cash-outs and final settlement explain the full Barcelona return", () => {
  const closed = market({ status: "resolved", outcome: "AAA", resolved_at: "2026-09-01T12:00:00Z" });
  const analytics = buildPortfolioAnalytics({
    profile: { coins: 0 }, positions: [], now: new Date("2026-09-01T13:00:00Z"),
    transactions: [
      { market_id: "m1", type: "bet", amount: -645.37, created_at: "2026-08-20T12:00:00Z", meta: { side: "AAA" }, markets: closed },
      { market_id: "m1", type: "sell", amount: 80.50004193011051, created_at: "2026-08-22T12:00:00Z", meta: { side: "AAA" }, markets: closed },
      { market_id: "m1", type: "sell", amount: 244.65246071835605, created_at: "2026-08-24T12:00:00Z", meta: { side: "AAA" }, markets: closed },
      { market_id: "m1", type: "payout", amount: 373.0948475235147, created_at: "2026-09-01T12:00:00Z", meta: { side: "AAA" }, markets: closed },
    ],
  });
  const trade = analytics.tradeHistory[0];
  assert.ok(Math.abs(trade.cashOuts - 325.15250264846657) < 1e-9);
  assert.ok(Math.abs(trade.settlementPayout - 373.0948475235147) < 1e-9);
  assert.ok(Math.abs(trade.returned - 698.2473501719812) < 1e-9);
  assert.ok(Math.abs(trade.pnl - 52.8773501719812) < 1e-9);
});

test("the history helper ignores older realized events outside 30 days", () => {
  const result = buildRealizedBalanceHistory({
    currentCoins: 800,
    openStaked: 200,
    settledTrades: [
      { concludedAt: Date.parse("2026-06-01T00:00:00Z"), pnl: 500, result: "win" },
      { concludedAt: Date.parse("2026-08-20T00:00:00Z"), pnl: -40, result: "loss", slug: "x", question: "X" },
    ],
    now: new Date("2026-08-31T00:00:00Z"),
  });
  assert.equal(result.pnl30d, -40);
  assert.deepEqual(result.history.map((point) => point.coins), [1040, 1000, 1000]);
});
