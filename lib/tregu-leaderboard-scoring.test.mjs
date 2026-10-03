import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Rehearsed on PGlite (partial cash-out +75, one side sold while the other is
// held +40, dust after a sell +40 — all three scored 0 under 0083). This pins
// the shape so a later migration cannot quietly go back to "closed markets".
const dir = new URL("../supabase/migrations/", import.meta.url);
const latest = (name) => readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(new URL(f, dir), "utf8"))
  .map((sql) => {
    const start = sql.lastIndexOf(`create or replace function public.${name}(`);
    if (start < 0) return null;
    const body = sql.indexOf("$$", sql.indexOf("as $$", start) + 5);
    return sql.slice(start, body + 2);
  })
  .filter(Boolean).at(-1);

test("the board, lock and prizes score realized P&L, not closed markets", () => {
  const scores = latest("tregu_leaderboard_scores");
  assert.ok(scores.includes("tregu_realized_trades(p_from, p_to)"));
  assert.ok(!scores.includes("positions"));
  const realized = latest("tregu_realized_trades");
  assert.ok(realized.includes("v_cost * v_sold / v_shares"), "average cost on a partial sell");
  assert.ok(realized.includes("pnl := r.amount - v_cost"), "a payout settles the remaining cost");
  assert.ok(realized.includes("v_status = 'resolved' and v_cost > 0.000001"), "a losing side at resolution");
  assert.ok(realized.includes("order by t.user_id, t.market_id, side, t.created_at, t.id"));
});

test("the period lock and the board still read tregu_leaderboard_scores", () => {
  assert.ok(latest("tregu_lock_leaderboard_period").includes("tregu_leaderboard_scores(v_start, v_end)"));
  assert.ok(latest("tregu_leaderboard_board").includes("tregu_leaderboard_scores(b.period_start, b.period_end)"));
});
