import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRaceMemory, gapToSeconds, lapTimeToSeconds } from "./f1-race-memory.mjs";
import { buildF1RaceWinnerPlan } from "./f1-live-lite.mjs";

const CODES = ["VER", "LEC", "NOR", "PIA", "RUS", "HAM", "ANT", "SAI", "ALB", "GAS",
  "OCO", "HUL", "BOR", "LAW", "HAD", "STR", "ALO", "BEA", "COL", "TSU"];

const market = {
  id: "race", slug: "baku", status: "open", market_classification: "live_f1", market_type: "f1_race_winner",
  live_event: { provider: "formula1_dashboard", event_id: "baku-2026", race_name: "Test Grand Prix", total_laps: 51 },
  sport_outcomes: CODES.map((key) => ({ key, label: key })),
};

// A frame: the named drivers as given, everyone else strung out behind on no stops.
function frame(lap, named) {
  const rows = [];
  const placed = new Set(Object.keys(named));
  for (const [code, row] of Object.entries(named)) rows.push({ driver_code: code, laps: lap - 1, last_lap: "1:45.000", pits: 0, in_pit: false, ...row });
  let position = rows.length;
  for (const code of CODES) {
    if (placed.has(code)) continue;
    position += 1;
    rows.push({ driver_code: code, position, gap: `+${(30 + position * 2).toFixed(3)}`, laps: lap - 1, last_lap: "1:46.500", pits: 0, in_pit: false });
  }
  rows.sort((a, b) => a.position - b.position);
  return { race: { status: "LIVE", current_lap: lap, total_laps: 51 }, rows, session_name: "Test Grand Prix", session_kind: "RACE", source_url: "test", state_key: `lap-${lap}-${JSON.stringify(named)}` };
}

// Plays frames a minute apart through the real model, carrying state like the database does.
function play(frames) {
  let current = { ...market, live_score_state: null };
  const out = [];
  frames.forEach((leaderboard, index) => {
    const [signal] = buildF1RaceWinnerPlan({ markets: [current], leaderboard, now: 1_800_000_000_000 + index * 60_000 });
    assert.ok(signal, `frame ${index} produced a plan`);
    out.push(signal);
    current = { ...current, live_score_state: signal.state };
  });
  return out;
}

test("reads timing-screen gaps and lap times", () => {
  assert.equal(gapToSeconds("LEADER"), 0);
  assert.equal(gapToSeconds("+4.213"), 4.213);
  assert.equal(gapToSeconds("+1:02.500"), 62.5);
  assert.equal(gapToSeconds("+1 LAP"), 90);
  assert.equal(gapToSeconds("—"), null);
  assert.equal(lapTimeToSeconds("1:43.363"), 103.363);
  assert.equal(lapTimeToSeconds("47.222"), 47.222);
  assert.equal(lapTimeToSeconds("IN PIT"), null);
});

test("an undercut is flagged while it runs and named once it lands", () => {
  const [before, inLane, attempt, leaderIn, landed] = play([
    frame(20, { VER: { position: 1, gap: "LEADER" }, LEC: { position: 2, gap: "+1.500" }, NOR: { position: 3, gap: "+9.000" } }),
    frame(21, { VER: { position: 1, gap: "LEADER" }, NOR: { position: 2, gap: "+9.100" }, LEC: { position: 3, gap: "+19.800", pits: null, in_pit: true } }),
    frame(22, { VER: { position: 1, gap: "LEADER" }, NOR: { position: 2, gap: "+9.300" }, LEC: { position: 3, gap: "+20.400", pits: 1 } }),
    frame(23, { NOR: { position: 1, gap: "LEADER" }, LEC: { position: 2, gap: "+1.200", pits: 1 }, VER: { position: 3, gap: "+2.000", pits: null, in_pit: true } }),
    frame(24, { NOR: { position: 1, gap: "LEADER" }, LEC: { position: 2, gap: "+1.000", pits: 1 }, VER: { position: 3, gap: "+2.300", pits: 1 } }),
  ]);
  assert.equal(inLane.state.insights.LEC, "Në boks tani");
  assert.equal(attempt.state.insights.LEC, "Tenton undercut ndaj VER");
  assert.equal(attempt.state.insights.VER, "Rrezik undercut nga LEC");
  assert.equal(leaderIn.state.insights.VER, "Në boks tani");
  assert.equal(landed.state.insights.LEC, "Undercut ndaj VER (+1.3s)");
  assert.equal(landed.state.insights.VER, "Humbi vendin nga undercut i LEC");
  // Stopping first cost LEC twenty seconds on the timing screen, but VER still
  // owed the same stop, so the market must not have written LEC off.
  assert.ok(attempt.probabilities.LEC > before.probabilities.LEC * 0.5, "LEC kept his chances through the stop");
  assert.ok(landed.probabilities.LEC > landed.probabilities.VER, "the undercut winner is priced ahead");
});

test("an overcut: the car ahead stops first and the one who stayed out comes out in front", () => {
  const frames = play([
    frame(30, { NOR: { position: 1, gap: "LEADER" }, PIA: { position: 2, gap: "+2.000" } }),
    frame(31, { PIA: { position: 1, gap: "LEADER" }, NOR: { position: 2, gap: "+18.500", pits: 1 } }),
    frame(33, { PIA: { position: 1, gap: "LEADER", pits: null, in_pit: true }, NOR: { position: 2, gap: "+0.500", pits: 1 } }),
    frame(34, { PIA: { position: 1, gap: "LEADER", pits: 1 }, NOR: { position: 2, gap: "+0.800", pits: 1 } }),
  ]);
  assert.equal(frames[1].state.insights.PIA, "Tenton overcut ndaj NOR");
  assert.equal(frames[3].state.insights.PIA, "Overcut ndaj NOR (+0.8s)");
  assert.equal(frames[3].state.insights.NOR, "Humbi vendin nga overcut i PIA");
});

test("a leader who still owes his stop is priced against a rival who has made it", () => {
  const [signal] = play([
    frame(40, { VER: { position: 1, gap: "LEADER" }, LEC: { position: 2, gap: "+12.000", pits: 1 } }),
  ]);
  // Twelve seconds behind on the screen, nine ahead once VER's stop is counted.
  assert.ok(signal.probabilities.LEC > signal.probabilities.VER);
  assert.equal(signal.state.insights.VER, "Kryeson me 12.0s · pa ndalesë · i duhet ndalesa");
  assert.equal(signal.state.insights.LEC, "+12.0s nga kreu · 1 ndalesë");
  assert.equal(signal.state.laps_left, 12);
});

test("laps left comes from the leader's completed laps when the lap counter is missing", () => {
  const leaderboard = frame(10, { VER: { position: 1, gap: "LEADER" } });
  const result = advanceRaceMemory(null, { rows: leaderboard.rows, race: { current_lap: null, total_laps: 51 } });
  assert.equal(result.lap, 10);
  assert.equal(result.laps_left, 42);
});

test("does not price the race from a qualifying session under the same name, or twice in one minute", () => {
  const quali = { ...frame(1, { VER: { position: 1, gap: "LEADER" } }), session_kind: "QUALIFYING" };
  assert.deepEqual(buildF1RaceWinnerPlan({ markets: [market], leaderboard: quali }), []);
  const now = 1_800_000_000_000;
  const fresh = { ...market, live_score_state: { key: "old", fetched_at: new Date(now - 20_000).toISOString() } };
  assert.deepEqual(buildF1RaceWinnerPlan({ markets: [fresh], leaderboard: frame(2, { VER: { position: 1, gap: "LEADER" } }), now }), []);
});
