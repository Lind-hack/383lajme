import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("two-minute sports processor runs the configured Formula 1 Dashboard adapter, audit, settlement, and persisted-change email path", () => {
  const server = source("lib/tregu-automation-server.ts");
  const migration = source("supabase/migrations/0024_tregu_f1_dashboard_oracle.sql");
  const mailer = source("lib/tregu-live-email.ts");

  assert.match(server, /\.eq\("market_classification", "live_f1"\)/);
  assert.match(server, /buildF1MarketPlan\(\{ markets: f1Markets, leaderboard \}\)/);
  assert.match(server, /provider: "formula1_dashboard"/);
  assert.match(server, /event_id: signal\.config\.event_id/);
  assert.match(server, /buildF1SettlementPlan\(\{ markets: f1Markets, leaderboard \}\)/);
  assert.match(server, /kind: "f1_live_update"/);
  assert.match(migration, /https:\/\/app\.formula1dashboard\.com\/live-timing\//);
  assert.match(migration, /market_classification <> 'live_f1'/);
  assert.match(migration, /least\(0\.05/);
  assert.match(mailer, /buildF1LiveEmail/);
});

test("admin approval prevents incorrectly configured live modes from opening", () => {
  const route = source("app/api/admin/tregu/markets/[id]/route.ts");
  assert.match(route, /Live Football kërkon provider ESPN/);
  assert.match(route, /liveEvent\?\.provider !== "formula1_dashboard"/);
  assert.match(route, /driver_code/);
});
