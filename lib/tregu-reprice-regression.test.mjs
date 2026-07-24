import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRepricePlan, repriceMarketSkipReason } from "./tregu-automation.mjs";

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


test("decisive corroborated evidence reaches the real market graph while ordinary evidence stays bounded", () => {
  const market = {
    id: "rogers", status: "open", category: "sport", source_article_slugs: ["club-confirmation", "reuters-confirmation"],
    q_yes: 400 * Math.log(0.3 / 0.7), q_no: 0, b: 400, last_news_at: null,
  };
  const [item] = buildRepricePlan({
    markets: [market],
    verifiedArticles: [
      { slug: "club-confirmation", category: "Sport", publishedAt: "2026-07-24T09:00:00.000Z", source: "Chelsea FC", title: "Chelsea confirm permanent Morgan Rogers transfer", excerpt: "The player has joined Chelsea on a permanent transfer." },
      { slug: "reuters-confirmation", category: "Sport", publishedAt: "2026-07-24T09:01:00.000Z", source: "Reuters", title: "Chelsea complete Morgan Rogers signing", excerpt: "Reuters confirms the permanent transfer." },
    ],
  });
  const result = item.scoreSuccess({
    probability: 0.01,
    evidence_level: "decisive",
    reasoning: "Dy burime të pavarura konfirmojnë transferimin e përhershëm, i cili e kundërshton kriterin e tregut.",
    cited_slugs: ["club-confirmation", "reuters-confirmation"],
  });

  assert.equal(result.snapshot.market_prob_before, 0.3);
  assert.equal(result.snapshot.market_prob, 0.01);
  assert.equal(result.snapshot.oracle_cap, 0.3);
  assert.equal(result.snapshot.evidence_kind, "decisive");

  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(automation, /title:\s*article\.title/);
  assert.match(automation, /excerpt:\s*article\.excerpt/);
  assert.match(automation, /p_evidence_kind:\s*outcome\.snapshot\.evidence_kind/);
});

test("the evidence-and-trade-impact migration caps a single virtual bet before any ledger write", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0025_tregu_news_evidence_and_trade_impact.sql", import.meta.url), "utf8");
  assert.match(migration, /p_evidence_kind/i);
  assert.match(migration, /decisive/i);
  assert.match(migration, /least\(0\.30/i);
  assert.match(migration, /v_trade_impact\s*>\s*0\.03/i);
  assert.match(migration, /para se të preken bilanci/i);
});
