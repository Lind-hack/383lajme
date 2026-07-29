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

test("archived F1 markets retain a complete historical grid and remain visible on the Tregu hub", () => {
  const detailRoute = source("app/api/tregu/markets/[slug]/route.ts");
  const hub = source("app/tregu/page.tsx");
  const archiveFeature = source("components/tregu/f1-archive-feature.tsx");

  assert.match(detailRoute, /const isArchived = market\.status === "closed" \|\| market\.status === "resolved"/);
  assert.match(detailRoute, /status: "ARCHIVED"/);
  assert.match(detailRoute, /: index \+ 1/);
  assert.match(detailRoute, /grid_position: gridPosition/);
  assert.match(hub, /\?status=all/);
  assert.match(hub, /function isF1Archive/);
  assert.match(hub, /<F1ArchiveFeature/);
  assert.match(archiveFeature, /data-f1-archive-feature/);
});

test("news publication relies on GitHub main deployment instead of the stale deploy hook", () => {
  const automation = source("scripts/codex_automation_support.py");
  const packageJson = source("package.json");
  const finalizeBlock = automation.slice(
    automation.indexOf("def finalize("),
    automation.indexOf("\ndef main(")
  );

  assert.doesNotMatch(finalizeBlock, /post_vercel_hook\(/);
  assert.match(finalizeBlock, /VERCEL deploy delegated to the GitHub main integration/);
  assert.match(packageJson, /"prebuild": "node scripts\/verify-production-deployment\.mjs"/);
});
