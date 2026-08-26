import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { repriceMarketSkipReason } from "./tregu-automation.mjs";

test("a market closed after the open scan is recorded as skipped before AI scoring or an oracle write", () => {
  const now = new Date("2026-07-15T20:00:00.000Z");

  assert.equal(repriceMarketSkipReason({ status: "closed", closes_at: "2026-07-15T21:00:00.000Z" }, now), "skipped_closed");
  assert.equal(repriceMarketSkipReason({ status: "resolved", closes_at: "2026-07-15T21:00:00.000Z" }, now), "skipped_closed");
  assert.equal(repriceMarketSkipReason({ status: "open", closes_at: "2026-07-15T19:59:59.000Z" }, now), "skipped_closed");
  assert.equal(repriceMarketSkipReason({ status: "open", closes_at: "2026-07-15T21:00:00.000Z" }, now), null);

  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const preflight = automation.indexOf("repriceMarketSkipReason(currentMarket, now)");
  assert.ok(preflight >= 0);
  assert.ok(preflight < automation.indexOf("scoreMarketWithAI(item.market as Market, item.evidence)", preflight));
  assert.ok(preflight < automation.indexOf('admin.rpc("apply_news_oracle"', preflight));
  assert.match(automation, /status:\s*"skipped_closed"/);
});

test("every open market scan persists a non-secret result while no-evidence scans cannot call the AI or oracle", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const plan = readFileSync(new URL("./tregu-automation.mjs", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0017_tregu_market_scan_status.sql", import.meta.url), "utf8");

  assert.doesNotMatch(plan, /\.filter\(\(item\) => item\.evidence\.length > 0\)/);
  assert.match(automation, /last_checked_at:\s*now\.toISOString\(\)/);
  assert.match(automation, /last_scan_result:\s*scan/);
  const noEvidence = automation.indexOf('status: "no_fresh_evidence"');
  assert.ok(noEvidence >= 0);
  assert.ok(noEvidence < automation.indexOf("scoreMarketWithAI(item.market as Market, item.evidence)", noEvidence));
  assert.match(automation, /open_markets_scanned/);
  assert.match(automation, /markets_checked/);
  assert.match(automation, /markets_with_evidence/);
  assert.match(automation, /updates_applied/);
  assert.match(automation, /skipped_closed/);
  assert.match(migration, /add column if not exists last_checked_at/i);
  assert.match(migration, /add column if not exists last_scan_result/i);
});

test("deadline RPCs are guarded to open binary general-news markets and report only a persisted change", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const eligibility = automation.indexOf("isEligibleNewsDeadlineMarket(currentMarket)");
  const settlement = automation.indexOf('admin.rpc("apply_news_deadline_settlement"');
  const decay = automation.indexOf('admin.rpc("apply_news_deadline_decay"');

  assert.ok(eligibility >= 0 && eligibility < settlement);
  assert.ok(eligibility < decay);
  assert.match(automation, /before_state/);
  assert.match(automation, /after_state/);
  assert.match(automation, /deadlineChange\("deadline_settlement"\)/);
  assert.match(automation, /deadlineChange\("deadline_decay"\)/);
  assert.match(automation, /if \(!stateChanged && afterProbability === deadlineBefore\.probability\) return null/);
});

test("football template checks distinguish unchanged from refreshed odds", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(automation, /const unchanged\s*=\s*\[\]/);
  assert.match(automation, /const refreshed\s*=\s*\[\]/);
  assert.match(automation, /unchanged_markets\s*:\s*unchanged/);
  assert.match(automation, /refreshed_markets\s*:\s*refreshed/);
  assert.doesNotMatch(automation, /recalibrated_markets/);
});
