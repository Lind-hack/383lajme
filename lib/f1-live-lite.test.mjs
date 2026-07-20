import assert from "node:assert/strict";
import test from "node:test";
import { buildF1MarketPlan, buildF1SettlementPlan, parseF1LiveLiteLeaderboard } from "./f1-live-lite.mjs";

const liveRender = `
Race · Lap 12/57 · LIVE
POS DRIVER GAP PITS
1 Oscar Piastri PIA LEADER 2
2 Lando Norris NOR +2.481 2
3 Max Verstappen VER +7.004 1
4 Charles Leclerc LEC +12.010 2
`;

function market(driver_code, extra = {}) {
  return { id: driver_code, question: `${driver_code} fiton deri më 1 gusht?`, market_classification: "live_f1", market_type: "binary", live_event: { provider: "formula1_dashboard", event_id: "2026-belgium-grand-prix", driver_code }, status: "open", ...extra };
}

test("parses rendered Formula 1 Dashboard rows, driver codes, and live race state", () => {
  const leaderboard = parseF1LiveLiteLeaderboard(liveRender);
  assert.equal(leaderboard.source_url, "https://app.formula1dashboard.com/live-timing/");
  assert.deepEqual(leaderboard.race, { status: "LIVE", current_lap: 12, total_laps: 57 });
  assert.deepEqual(leaderboard.rows.map((row) => [row.position, row.driver_code, row.gap, row.pits]), [[1, "PIA", "LEADER", 2], [2, "NOR", "+2.481", 2], [3, "VER", "+7.004", 1], [4, "LEC", "+12.010", 2]]);
});

test("F1 plans require explicit market classification, event identity, and stable driver-code mapping", () => {
  const leaderboard = parseF1LiveLiteLeaderboard(liveRender);
  const plan = buildF1MarketPlan({ markets: [market("PIA"), market("VER"), { ...market("NOR"), live_event: { provider: "formula1_dashboard", driver_code: "NOR" } }, { ...market("LEC"), market_classification: "general_news" }], leaderboard });
  assert.deepEqual(plan.map((item) => [item.market.id, item.config.event_id, item.row.driver_code, item.oracle_cap]), [["PIA", "2026-belgium-grand-prix", "PIA", 0.05], ["VER", "2026-belgium-grand-prix", "VER", 0.05]]);
  assert.match(plan[0].reasoning, /Formula 1 Dashboard/);
});

test("does not emit a write for unchanged driver state and rejects an unavailable race state", () => {
  const leaderboard = parseF1LiveLiteLeaderboard(liveRender);
  const piastri = leaderboard.rows[0];
  const unchanged = market("PIA", { live_score_state: { key: JSON.stringify({ position: piastri.position, driver_code: piastri.driver_code, gap: piastri.gap, pits: piastri.pits, tyre: null, stint: null, status: null }) } });
  assert.deepEqual(buildF1MarketPlan({ markets: [unchanged], leaderboard }), []);
  assert.throws(() => parseF1LiveLiteLeaderboard("POS DRIVER GAP PITS\n1 Oscar Piastri PIA LEADER 2\n2 Lando Norris NOR +2.481 2"), /race state/i);
});

test("settles only a FINISHED single-race mapped group and resolves exactly one winner", () => {
  const finished = parseF1LiveLiteLeaderboard(liveRender.replace("LIVE", "FINISHED"));
  const settlements = buildF1SettlementPlan({ markets: [market("PIA"), market("NOR"), market("VER")], leaderboard: finished });
  assert.deepEqual(settlements.map((item) => [item.market.id, item.outcome]), [["PIA", "PO"], ["NOR", "JO"], ["VER", "JO"]]);
  assert.deepEqual(buildF1SettlementPlan({ markets: [market("PIA"), { ...market("NOR"), live_event: { provider: "formula1_dashboard", event_id: "other-race", driver_code: "NOR" } }], leaderboard: finished }), []);
});
