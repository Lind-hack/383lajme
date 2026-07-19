import assert from "node:assert/strict";
import test from "node:test";
import { buildF1MarketPlan, parseF1LiveLiteLeaderboard } from "./f1-live-lite.mjs";

const renderedLeaderboard = `
  POS DRIVER GAP PITS
  1 Oscar Piastri 1:23:45.111 2
  2 Lando Norris +2.481 2
  3 Max Verstappen +7.004 1
  4 Charles Leclerc +12.010 2
`;

test("parses the dynamically rendered official F1 Live Lite leaderboard including positions, gaps, and pits", () => {
  const leaderboard = parseF1LiveLiteLeaderboard(renderedLeaderboard);
  assert.deepEqual(leaderboard.rows, [
    { position: 1, driver: "Oscar Piastri", gap: "1:23:45.111", pits: 2 },
    { position: 2, driver: "Lando Norris", gap: "+2.481", pits: 2 },
    { position: 3, driver: "Max Verstappen", gap: "+7.004", pits: 1 },
    { position: 4, driver: "Charles Leclerc", gap: "+12.010", pits: 2 },
  ]);
  assert.equal(leaderboard.state_key.includes("Oscar Piastri"), true);
});

test("maps only the configured Belgian GP driver binary markets and gives the leader a bounded official reference", () => {
  const leaderboard = parseF1LiveLiteLeaderboard(renderedLeaderboard);
  const plan = buildF1MarketPlan({
    markets: [
      { id: "piastri", slug: "f1-belgjika-spa-fiton-oscar-piastri", q_yes: 0, q_no: 0, b: 100, status: "open" },
      { id: "verstappen", slug: "f1-belgjika-spa-fiton-max-verstappen", q_yes: 0, q_no: 0, b: 100, status: "open" },
      { id: "other", slug: "other-market", q_yes: 0, q_no: 0, b: 100, status: "open" },
    ],
    leaderboard,
  });
  assert.deepEqual(plan.map((item) => [item.market.id, item.row.position, item.reference_probability, item.oracle_cap]), [
    ["piastri", 1, 0.62, 0.05],
    ["verstappen", 3, 0.18, 0.05],
  ]);
  assert.match(plan[0].reasoning, /official F1 Live Lite/i);
});

test("does not emit an oracle write when the official leaderboard state is unchanged", () => {
  const leaderboard = parseF1LiveLiteLeaderboard(renderedLeaderboard);
  const plan = buildF1MarketPlan({
    markets: [{ id: "piastri", slug: "f1-belgjika-spa-fiton-oscar-piastri", live_score_state: { key: leaderboard.state_key }, q_yes: 0, q_no: 0, b: 100, status: "open" }],
    leaderboard,
  });
  assert.deepEqual(plan, []);
});
