import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/0037_tregu_f1_race_winner_trading.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/tregu/bet/route.ts", import.meta.url), "utf8");
const sellMigration = readFileSync(new URL("../supabase/migrations/0050_tregu_f1_cash_out.sql", import.meta.url), "utf8");
const sellRoute = readFileSync(new URL("../app/api/tregu/sell/route.ts", import.meta.url), "utf8");

test("F1 trade API accepts the explicit outcomeKey contract and routes only that contract to the F1 RPC", () => {
  assert.match(route, /outcomeKey\?: string/);
  assert.match(route, /body\?\.outcomeKey/);
  assert.match(route, /place_f1_race_winner_bet/);
});

test("F1 trade RPC rejects malformed books before it mutates balances or quantities", () => {
  assert.match(migration, /v_market\.b is null or v_market\.b <= 0/);
  assert.match(migration, /count\(distinct value->>'key'\).*jsonb_array_elements\(v_market\.sport_outcomes\)/s);
  assert.match(migration, /for update/);
  assert.match(migration, /update public\.profiles set coins = coins - p_coins/);
});

test("F1 trade RPC enforces strict live-F1 market identity and a bounded selected-driver movement", () => {
  assert.match(migration, /market_classification <> 'live_f1'/);
  assert.match(migration, /market_type <> 'f1_race_winner'/);
  assert.match(migration, /formula1_dashboard/);
  assert.match(migration, /0\.015001/);
});

test("F1 cash-out uses its own strict atomic RPC", () => {
  assert.match(sellRoute, /body\.kind === "f1_race_winner"/);
  assert.match(sellRoute, /sell_f1_race_winner_shares/);
  assert.match(sellMigration, /market_classification <> 'live_f1'/);
  assert.match(sellMigration, /market_type <> 'f1_race_winner'/);
  assert.match(sellMigration, /formula1_dashboard/);
  assert.match(sellMigration, /from public\.positions[\s\S]*?for update/);
  assert.match(sellMigration, /update public\.profiles[\s\S]*?update public\.positions[\s\S]*?insert into public\.transactions[\s\S]*?insert into public\.market_trades/);
  assert.match(sellMigration, /grant execute on function public\.sell_f1_race_winner_shares/);
});
