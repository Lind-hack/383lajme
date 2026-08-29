import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildFootballMetricRows,
  buildMarketChart,
  formatOfficialLiveScore,
  getMarketPrices,
  officialMetricsForDisplay,
  shouldStartPollingFallback,
} from "./tregu-market-detail.mjs";
import { formatKosovoDateTime, formatKosovoTime } from "./tregu-local-time.mjs";
import { TRADE_SUCCESS_SOUND_ASSET, TRADE_SUCCESS_SOUND_DURATION_MS, resolveTradeSuccessSoundProfile } from "./tregu-trade-sound.mjs";

test("market detail derives PO and JO from the one LMSR price", () => {
  assert.deepEqual(getMarketPrices(0.63), { po: 0.63, jo: 0.37 });
});

test("market detail keeps trades and verified oracle moves as markers on one market series", () => {
  const chart = buildMarketChart({
    snapshots: [
      { created_at: "2026-07-14T08:00:00Z", market_prob: 0.51, oracle_kind: "trade", volume: 25 },
      { created_at: "2026-07-14T09:00:00Z", market_prob: 0.53, reference_probability: 0.7, oracle_kind: "news_oracle", volume: 25 },
    ],
    currentMarketProbability: 0.54,
  });

  assert.deepEqual(chart.market.map((point) => point.probability), [0.51, 0.53, 0.54]);
  assert.deepEqual(chart.markers.map((marker) => marker.kind), ["trade", "news_oracle"]);
  assert.equal(chart.reference.length, 1);
});

test("market detail only starts a short polling fallback when realtime is unavailable", () => {
  assert.equal(shouldStartPollingFallback("SUBSCRIBED"), false);
  assert.equal(shouldStartPollingFallback("CHANNEL_ERROR"), true);
  assert.equal(shouldStartPollingFallback("TIMED_OUT"), true);
  assert.equal(shouldStartPollingFallback("CLOSED"), true);
});

test("live card metrics preserve supplied values and omit a missing xG instead of inventing one", () => {
  const display = officialMetricsForDisplay({
    England: { possession: 44.5, shots: 1, shots_on_target: 0 },
    Argentina: { possession: 55.5, shots: 2, shots_on_target: 0 },
  });

  assert.deepEqual(display, [
    { team: "England", possession: 44.5, shots: 1, shotsOnTarget: 0, corners: undefined, xg: undefined, sources: {} },
    { team: "Argentina", possession: 55.5, shots: 2, shotsOnTarget: 0, corners: undefined, xg: undefined, sources: {} },
  ]);
});

test("football stat rows show real xG, mark one-sided gaps, and omit absent xG", () => {
  const supplied = buildFootballMetricRows(
    { xg: 1.24, possession: 54, shots: 8 },
    { xg: 0.48, possession: 46, shots: 5 }
  );
  assert.deepEqual(supplied[0], {
    label: "Golat e pritshëm (xG)",
    home: 1.24,
    away: 0.48,
    homeText: "1.24",
    awayText: "0.48",
  });
  const partial = buildFootballMetricRows({ xg: 0.72 }, { shots: 4 });
  assert.equal(partial[0].awayText, "—");
  assert.equal(buildFootballMetricRows({ shots: 3 }, { shots: 2 }).some((row) => /xG/.test(row.label)), false);
});

test("Tregu timestamps use explicit Kosovo local time and numeric Albanian dates", () => {
  const instant = "2026-08-28T22:30:45Z";
  assert.equal(formatKosovoTime(instant, { seconds: true }), "00:30:45");
  assert.match(formatKosovoDateTime(instant), /^29\.08(?:\.|,)?\s*00:30$/);
});

test("trade success audio resolves sport and UEFA competition contexts", () => {
  assert.equal(resolveTradeSuccessSoundProfile({ sportTheme: "football", league: "uefa.champions" }), "champions");
  assert.equal(resolveTradeSuccessSoundProfile({ sportTheme: "football", league: "uefa.europa" }), "europa");
  assert.equal(resolveTradeSuccessSoundProfile({ sportTheme: "football", league: "uefa.europa.conf" }), "conference");
  assert.equal(resolveTradeSuccessSoundProfile({ sportTheme: "f1" }), "f1");
  assert.equal(resolveTradeSuccessSoundProfile({ sportTheme: "basketball" }), "basketball");
  assert.equal(resolveTradeSuccessSoundProfile({ sportTheme: "football", league: "eng.1" }), "football");
  assert.equal(resolveTradeSuccessSoundProfile({}), "default");
  assert.ok(TRADE_SUCCESS_SOUND_DURATION_MS.champions >= 3_000 && TRADE_SUCCESS_SOUND_DURATION_MS.champions <= 5_000);
  assert.ok(TRADE_SUCCESS_SOUND_DURATION_MS.europa >= 3_000 && TRADE_SUCCESS_SOUND_DURATION_MS.europa <= 5_000);
  assert.ok(TRADE_SUCCESS_SOUND_DURATION_MS.conference >= 3_000 && TRADE_SUCCESS_SOUND_DURATION_MS.conference <= 5_000);
  for (const asset of Object.values(TRADE_SUCCESS_SOUND_ASSET)) {
    assert.equal(existsSync(new URL(`../public${asset}`, import.meta.url)), true, `${asset} must be shipped`);
  }
});

test("live card presents a recognized ESPN second-half state with every official score", () => {
  assert.deepEqual(formatOfficialLiveScore({
    status: "STATUS_SECOND_HALF",
    detail: "Second Half 90'+12",
    competitors: [{ team: "England", score: 1 }, { team: "Argentina", score: 2 }],
  }), {
    status: "Second Half 90'+12",
    score: "England 1 — Argentina 2",
    sourceLabel: "ESPN zyrtar",
  });
});

test("live card presents every recognized official phase without losing scheduled or halftime scores", () => {
  const state = (status, detail, scores = [0, 0]) => formatOfficialLiveScore({
    status,
    detail,
    competitors: [{ team: "England", score: scores[0] }, { team: "Argentina", score: scores[1] }],
  });

  assert.equal(state("STATUS_SCHEDULED", "7:00 PM").status, "Scheduled · 7:00 PM");
  assert.equal(state("STATUS_FIRST_HALF", "First Half 45'+1", [1, 0]).status, "First Half 45'+1");
  assert.equal(state("STATUS_HALFTIME", "Halftime", [1, 1]).status, "Halftime");
  assert.equal(state("STATUS_SECOND_HALF", "Second Half 90'+12", [1, 2]).score, "England 1 — Argentina 2");
  assert.equal(state("STATUS_FULL_TIME", "FT", [1, 2]).status, "Full Time · FT");
});

test("realtime migration publishes only the public market read models without applying itself", () => {
  const migrationPath = new URL("../supabase/migrations/0007_tregu_market_detail_realtime.sql", import.meta.url);
  assert.equal(existsSync(migrationPath), true);
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /alter table public\.markets replica identity full/i);
  assert.match(sql, /alter table public\.market_snapshots replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.markets/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.market_snapshots/i);
  assert.doesNotMatch(sql, /apply_news_oracle\(/i);
});

test("related football markets carry and render both team logos", () => {
  const route = readFileSync(new URL("../app/api/tregu/markets/[slug]/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/tregu/[slug]/page.tsx", import.meta.url), "utf8");

  assert.match(route, /closes_at, sport_outcomes/);
  assert.match(route, /sportOutcomes: Array\.isArray\(m\.sport_outcomes\)/);
  assert.match(page, /className="tregu-rel-matchup"/);
  assert.match(page, /className="tregu-rel-team-logo"/);
  assert.match(page, /className="tregu-rel-versus">VS/);
});
