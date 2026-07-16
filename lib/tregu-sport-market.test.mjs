import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSportMarketPlan,
  normalizeEspnSummary,
  previewSportMarketBet,
  sportOutcomePrices,
} from "./tregu-sport-market.mjs";
import { findFlashscoreMatch, mergeFlashscoreWithEspn, parseFlashscoreStats } from "./flashscore-live-stats.mjs";

const market = {
  id: "england-argentina",
  status: "open",
  b: 400,
  sport_outcomes: [
    { key: "home", label: "England", team: "England" },
    { key: "draw", label: "Draw" },
    { key: "away", label: "Argentina", team: "Argentina" },
  ],
  outcome_quantities: { home: 0, draw: 0, away: 0 },
  live_event: { provider: "espn", event_id: "760515", league: "fifa.world", sport: "soccer", home_team: "England", away_team: "Argentina" },
};

function summary(overrides = {}) {
  return {
    header: { competitions: [{
      date: "2026-07-15T19:00:00.000Z",
      status: { type: { name: "STATUS_IN_PROGRESS", shortDetail: "63'" } },
      competitors: [
        { homeAway: "home", score: "1", team: { displayName: "England" } },
        { homeAway: "away", score: "0", team: { displayName: "Argentina" } },
      ],
    }] },
    boxscore: {
      teams: [
        { team: { displayName: "England" }, statistics: [{ name: "totalShots", displayName: "Total Shots", displayValue: "9" }, { name: "shotsOnTarget", displayName: "Shots on Target", displayValue: "4" }, { name: "possessionPct", displayName: "Possession", displayValue: "57%" }, { name: "expectedGoals", displayName: "xG", displayValue: "1.12" }] },
        { team: { displayName: "Argentina" }, statistics: [{ name: "totalShots", displayName: "Total Shots", displayValue: "5" }, { name: "shotsOnTarget", displayName: "Shots on Target", displayValue: "1" }, { name: "possessionPct", displayName: "Possession", displayValue: "43%" }] },
      ],
      players: [{ team: { displayName: "England" }, statistics: [{ athletes: [{ athlete: { displayName: "Player One" }, starter: true }] }] }],
    },
    ...overrides,
  };
}

test("ESPN summary normalization retains only supplied official live metrics and lineups", () => {
  const event = normalizeEspnSummary({ provider: "espn", event_id: "760515", league: "fifa.world", sport: "soccer" }, summary());
  assert.equal(event.detail, "63'");
  assert.deepEqual(event.metrics.England, { shots: 9, shots_on_target: 4, possession: 57, xg: 1.12 });
  assert.deepEqual(event.metrics.Argentina, { shots: 5, shots_on_target: 1, possession: 43 });
  assert.deepEqual(event.starting_lineups.England, ["Player One"]);
  assert.equal("xg" in event.metrics.Argentina, false);
});

test("Flashscore is supplemental: public-match discovery, returned xG merge, and unavailable fallback never fabricate metrics", () => {
  const match = findFlashscoreMatch("~AA÷AbCd1234¬AE÷England¬AF÷Argentina¬", "England", "Argentina");
  assert.equal(match.source_url, "https://www.flashscore.com/match/AbCd1234/");
  assert.deepEqual(parseFlashscoreStats("1.24 Expected Goals 0.48 9 Shots 5 4 Shots on Target 1 55% Possession 45% 6 Corners 2", "England", "Argentina"), { England: { xg: 1.24, shots: 9, shots_on_target: 4, possession: 55, corners: 6 }, Argentina: { xg: 0.48, shots: 5, shots_on_target: 1, possession: 45, corners: 2 } });
  const espn = { fetched_at: "2026-07-15T19:00:00Z", metrics: { England: { shots: 1 }, Argentina: { shots: 4 } } };
  const merged = mergeFlashscoreWithEspn(espn, { metrics: { England: { xg: 1.24 }, Argentina: { xg: 0.48 } }, audit: { retrieved_at: "2026-07-15T19:01:00Z", availability: "available" } });
  assert.equal(merged.metrics.England.xg, 1.24);
  assert.equal(merged.metric_sources.England.xg, "flashscore");
  const unavailable = mergeFlashscoreWithEspn(espn, { metrics: {}, audit: { retrieved_at: "2026-07-15T19:01:00Z", availability: "unavailable", reason: "matching_public_event_not_found" } });
  assert.equal("xg" in unavailable.metrics.England, false);
  assert.equal(unavailable.supplemental.flashscore.reason, "matching_public_event_not_found");
});

test("scheduled ESPN event without scores is a successful no-score update that retains kickoff metadata and keeps the market open", () => {
  const scheduled = normalizeEspnSummary(
    { provider: "espn", event_id: "760515", league: "fifa.world", sport: "soccer" },
    summary({
      header: { competitions: [{
        date: "2026-07-15T19:00:00.000Z",
        status: { type: { name: "STATUS_SCHEDULED", shortDetail: "7:00 PM" } },
        competitors: [
          { homeAway: "home", team: { displayName: "England" } },
          { homeAway: "away", team: { displayName: "Argentina" } },
        ],
      }] },
      boxscore: {},
    }),
  );
  const [signal] = buildSportMarketPlan({
    markets: [market],
    events: [scheduled],
    verifiedNews: [{ event_id: "760515", source: "FIFA", url: "https://example.test/pre-match", probabilities: { home: 0.50, draw: 0.28, away: 0.22 } }],
  });

  assert.equal(scheduled.has_official_score, false);
  assert.equal(scheduled.kickoff, "2026-07-15T19:00:00.000Z");
  assert.equal(signal.kind, "no_score");
  assert.equal(signal.close_market, false);
  assert.equal(signal.snapshot, undefined);
  assert.equal(signal.kickoff, "2026-07-15T19:00:00.000Z");
  assert.equal(signal.pre_match_evidence[0].url, "https://example.test/pre-match");
});

test("generic three-way LMSR keeps prices normalized and gives predictable winners limited marginal upside", () => {
  const initial = sportOutcomePrices(market);
  assert.deepEqual(initial, { home: 1 / 3, draw: 1 / 3, away: 1 / 3 });
  const favorite = { ...market, outcome_quantities: { home: 3200, draw: 0, away: 0 } };
  const preview = previewSportMarketBet(favorite, "home", 20);
  assert.equal(preview.shares < 21, true);
  assert.ok(Math.abs(Object.values(preview.prices).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.equal(preview.prices.home > 0.99, true);
});

test("official score, clock, final state, and verified lineup/news inputs drive bounded transparent references", () => {
  const live = normalizeEspnSummary({ provider: "espn", event_id: "760515", league: "fifa.world", sport: "soccer" }, summary());
  const [signal] = buildSportMarketPlan({ markets: [market], events: [live], verifiedNews: [{ event_id: "760515", source: "FA", url: "https://example.test/team-news", probabilities: { home: 0.50, draw: 0.28, away: 0.22 } }] });
  assert.equal(signal.close_market, false);
  assert.equal(signal.kind, "score");
  assert.equal(signal.snapshot.oracle_cap <= 0.10, true);
  assert.equal(signal.snapshot.reference_probabilities.home > signal.snapshot.reference_probabilities.away, true);
  assert.ok(Math.abs(Object.values(signal.snapshot.reference_probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);

  const final = { ...live, status: "STATUS_FULL_TIME", detail: "FT", competitors: [{ ...live.competitors[0], score: 2 }, { ...live.competitors[1], score: 0 }] };
  const [finalSignal] = buildSportMarketPlan({ markets: [market], events: [final] });
  assert.equal(finalSignal.close_market, true);
  assert.equal(finalSignal.snapshot.oracle_cap <= 0.10, true);
  assert.equal(finalSignal.verified_outcome, "home");
  assert.equal(finalSignal.snapshot.reference_probabilities.home < 1, true);
  assert.equal(finalSignal.settlement_due_at.endsWith("Z"), true);
});

test("generic sport migration separates system audit from user 383C trade and settles due winners exactly once", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0011_tregu_generic_sport_market_engine.sql", import.meta.url), "utf8");
  assert.match(sql, /sport_outcomes jsonb/i);
  assert.match(sql, /outcome_quantities jsonb/i);
  assert.match(sql, /official_final_at/i);
  assert.match(sql, /settlement_due_at/i);
  assert.match(sql, /create or replace function public\.apply_sport_market_oracle/i);
  assert.match(sql, /create or replace function public\.settle_due_sport_markets/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /on conflict.*market_id.*user_id.*side/i);
  assert.match(sql, /'sport_oracle'/i);
  assert.match(sql, /update public\.profiles set coins = coins \+ v_position\.shares/i);
  const oracleFunction = sql.slice(sql.indexOf("create or replace function public.apply_sport_market_oracle"), sql.indexOf("create or replace function public.settle_due_sport_markets"));
  assert.doesNotMatch(oracleFunction, /update public\.(profiles|positions)|insert into public\.transactions/i);
});

test("live sport oracle migration clamps every snapshot cap to the existing 10-percent database ceiling without ledger writes", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0014_tregu_live_sport_oracle_cap.sql", import.meta.url), "utf8");
  assert.match(migration, /create or replace function public\.apply_sport_market_oracle/i);
  assert.match(migration, /least\(0\.10, greatest\(0\.001, p_requested_cap\)\)/i);
  assert.doesNotMatch(migration, /alter table public\.market_snapshots/i);
  const oracleFunction = migration.slice(migration.indexOf("create or replace function public.apply_sport_market_oracle"));
  assert.doesNotMatch(oracleFunction, /update public\.(profiles|positions)|insert into public\.transactions/i);
});

test("final settlement accepts only configured lowercase sport winners while binary PO/JO outcomes stay constrained", () => {
  const migrationPath = new URL("../supabase/migrations/0015_tregu_sport_final_outcome_constraint.sql", import.meta.url);
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /drop constraint if exists markets_outcome_check/i);
  assert.match(migration, /market_type = 'binary' and outcome in \('PO', 'JO'\)/i);
  assert.match(migration, /market_type = 'three_outcome'/i);
  assert.match(migration, /event_id'\s*=\s*'760515'/i);
  assert.match(migration, /outcome in \('england', 'draw', 'argentina'\)/i);
  assert.doesNotMatch(migration, /outcome\s+in\s*\([^)]*\*|outcome\s*~|outcome\s+like/i);

  const engine = readFileSync(new URL("../supabase/migrations/0011_tregu_generic_sport_market_engine.sql", import.meta.url), "utf8");
  assert.match(engine, /status = 'closed'/i);
  assert.match(engine, /settlement_due_at <= now\(\)/i);
  assert.match(engine, /status = 'resolved'/i);
  assert.match(engine, /on conflict \(market_id, user_id, side\) do nothing/i);
});

test("two-minute live processor and card expose only verified metrics, lock/countdown, and reduced-motion live state", () => {
  const script = readFileSync(new URL("../scripts/run-tregu-live-sports.mjs", import.meta.url), "utf8");
  const card = readFileSync(new URL("../app/tregu/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(script, /live-sports/);
  assert.match(card, /live_score_state/);
  assert.match(card, /settlement_due_at/);
  assert.match(card, /prefers-reduced-motion/);
  assert.match(card, /Statistikat live \(ESPN zyrtar\{flashscoreAvailable/);
  assert.match(card, /flashscoreAvailable && metrics\.sources\.shots === "flashscore"/);
  assert.match(card, /Flashscore i padisponueshëm/);
});

test("live-sports runner endpoint and audit action accept the processor's exact live_sports action without widening the audit allowlist", () => {
  const migrationPath = new URL("../supabase/migrations/0012_tregu_live_sports_automation_audit.sql", import.meta.url);
  const runner = readFileSync(new URL("../scripts/run-tregu-live-sports.mjs", import.meta.url), "utf8");
  const endpoint = readFileSync(new URL("../app/api/automation/tregu/live-sports/route.ts", import.meta.url), "utf8");
  const processor = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");

  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(runner, /\/api\/automation\/tregu\/live-sports/);
  assert.match(endpoint, /runLiveSportsAutomation/);
  assert.match(processor, /runOfficialSportsRefresh\("live_sports", `live-sports:\$\{twoMinuteRunKey\(now\)\}`, now\)/);
  assert.match(migration, /drop constraint if exists market_automation_runs_action_check/i);
  assert.match(migration, /add constraint market_automation_runs_action_check[\s\S]*action in \('daily_drafts', 'reprice', 'live_sports'\)/i);
  assert.doesNotMatch(migration, /action\s+in\s*\([^)]*\*|action\s*~|action\s+like/i);
});
