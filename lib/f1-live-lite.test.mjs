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
  const unchanged = market("PIA", { live_score_state: { key: JSON.stringify({ position: piastri.position, driver_code: piastri.driver_code, gap: piastri.gap, pits: piastri.pits, in_pit: null, laps: null, tyre: null, stint: null, status: null }) } });
  assert.deepEqual(buildF1MarketPlan({ markets: [unchanged], leaderboard }), []);
  assert.throws(() => parseF1LiveLiteLeaderboard("POS DRIVER GAP PITS\n1 Oscar Piastri PIA LEADER 2\n2 Lando Norris NOR +2.481 2"), /race state/i);
});

test("settles only a FINISHED single-race mapped group and resolves exactly one winner", () => {
  const finished = parseF1LiveLiteLeaderboard(liveRender.replace("LIVE", "FINISHED"));
  const settlements = buildF1SettlementPlan({ markets: [market("PIA"), market("NOR"), market("VER")], leaderboard: finished });
  assert.deepEqual(settlements.map((item) => [item.market.id, item.outcome]), [["PIA", "PO"], ["NOR", "JO"], ["VER", "JO"]]);
  assert.deepEqual(buildF1SettlementPlan({ markets: [market("PIA"), { ...market("NOR"), live_event: { provider: "formula1_dashboard", event_id: "other-race", driver_code: "NOR" } }], leaderboard: finished }), []);
});

test("reads the dashboard table by its headers, and the session from the line under the Grand Prix", () => {
  const codes = ["RUS","LEC","PIA","NOR","VER","HAM","ANT","SAI","ALB","GAS","OCO","HUL","BOR","LAW","HAD","STR","ALO","BEA","COL","TSU"];
  const render = (session) => ({
    sessionName: "Azerbaijan Grand Prix",
    // The site menu carries "Race Pace" above the session line.
    text: `Formula 1 Dashboard\nLive Timing\nRace Pace\nPit Stops\nAzerbaijan Grand Prix\n${session}\nAIR\n23.9 °C\nRAIN\n0.4 mm`,
    headers: ["POS", "DRIVER", "GAP", "INT", "LAST", "BEST", "MINI-SECTORS", "LAPS", "PIT", "TYRE"],
    tableRows: codes.map((code, i) => [String(i + 1), code, i ? `+${i}.000` : "—", i ? "+1.000" : "—", "1:45.123", "1:44.000", "", "30", i === 2 ? "IN PIT" : "1", "MEDIUM Used 12"]),
  });
  const quali = parseF1LiveLiteLeaderboard(render("QUALIFYING\nFINISHED"));
  assert.equal(quali.session_kind, "QUALIFYING");
  const race = parseF1LiveLiteLeaderboard(render("RACE\nLIVE"));
  assert.equal(race.session_kind, "RACE");
  assert.deepEqual(race.weather, { rainfall: 0.4 });
  assert.deepEqual(
    { ...race.rows[2] },
    { driver: "PIA", driver_code: "PIA", position: 3, gap: "+2.000", interval: "+1.000", last_lap: "1:45.123", laps: 30, pits: null, in_pit: true, tyre: "MEDIUM", tyre_age: 12, status: null }
  );
  assert.equal(race.rows[1].pits, 1);
});
