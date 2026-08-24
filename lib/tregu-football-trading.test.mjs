import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("football detail API merges recorded vector trades, oracle points and the persisted live price", () => {
  const route = source("app/api/tregu/markets/[slug]/route.ts");
  assert.match(route, /\.select\("\*"\)/);
  assert.match(route, /row\.outcome_prices/);
  assert.match(route, /row\.reference_probabilities/);
  assert.match(route, /series\.push\(\{ t: nowT, p:/);
  assert.doesNotMatch(route, /market\.reference_probabilities\?\.\[key\]/);
});

test("football trade slip supports outcome-key cash-out independently of PO/JO", () => {
  const page = source("app/tregu/[slug]/page.tsx");
  const sellRoute = source("app/api/tregu/sell/route.ts");
  assert.match(page, /previewSportOutcomeSell/);
  assert.match(page, /footballHeldOn\(selectedOutcome\.key\)/);
  assert.match(page, /kind: "sport_outcome",\s+outcomeKey: selectedOutcome\.key,\s+shares/s);
  assert.match(page, /disabled=\{!canSellFootball \|\| !footballOutcomeKey\}/);
  assert.match(sellRoute, /body\.kind === "sport_outcome"/);
  assert.match(sellRoute, /sell_sport_market_shares/);
});

test("sport trading migration records full post-trade vectors for buys and sells", () => {
  const sql = source("supabase/migrations/0039_tregu_sport_outcome_sell_and_tape.sql");
  assert.match(sql, /add column if not exists outcome_prices jsonb/i);
  assert.match(sql, /create or replace function public\.place_sport_market_bet/i);
  assert.match(sql, /create or replace function public\.sell_sport_market_shares/i);
  assert.match(sql, /insert into public\.market_trades[\s\S]*'buy'[\s\S]*v_post_prices/i);
  assert.match(sql, /insert into public\.market_trades[\s\S]*'sell'[\s\S]*v_post_prices/i);
  assert.match(sql, /update public\.positions[\s\S]*shares = shares - v_shares/i);
  assert.match(sql, /update public\.profiles[\s\S]*coins = coins \+ v_coins_out/i);
});
