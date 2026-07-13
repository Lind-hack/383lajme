import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });
  }

  const [{ data: profile }, { data: positions }, { data: transactions }, { data: allTx }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("positions")
        .select("*, markets(question, slug, status, outcome, category, closes_at, q_yes, q_no, b)")
        .eq("user_id", user.id)
        .gt("shares", 0),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      // Full ledger (oldest first) — fuels the 30-day balance chart and
      // lifetime realized P/L. Bets/payouts/sells only; bonuses excluded from P/L.
      supabase
        .from("transactions")
        .select("type, amount, market_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1000),
    ]);

  const positionsWithValue = (positions ?? []).map((p) => {
    const m = p.markets as unknown as { q_yes: number; q_no: number; b: number } | null;
    const currentPriceYes = m ? lmsrPriceYes(m.q_yes, m.q_no, m.b) : null;
    const currentPrice =
      currentPriceYes === null ? null : p.side === "PO" ? currentPriceYes : 1 - currentPriceYes;
    const currentValue = currentPrice === null ? null : p.shares * currentPrice;
    const entryPrice = p.shares > 0 ? (p.coins_staked ?? 0) / p.shares : null;
    const unrealizedPnl =
      currentValue === null ? null : currentValue - (p.coins_staked ?? 0);
    return { ...p, currentPrice, currentValue, entryPrice, unrealizedPnl };
  });

  // --- Stats -----------------------------------------------------------------
  const openValue = positionsWithValue.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const openStaked = positionsWithValue.reduce((s, p) => s + (p.coins_staked ?? 0), 0);
  const openPnl = openValue - openStaked;

  // Lifetime realized P/L per market: payouts + sells received minus bets spent,
  // counted only for markets with no remaining open position (fully settled).
  const openMarketIds = new Set(positionsWithValue.map((p) => p.market_id));
  const perMarket = new Map<string, number>();
  for (const tx of allTx ?? []) {
    if (!tx.market_id) continue;
    if (tx.type === "bet" || tx.type === "payout" || tx.type === "sell") {
      perMarket.set(tx.market_id, (perMarket.get(tx.market_id) ?? 0) + Number(tx.amount));
    }
  }
  let realizedPnl = 0;
  let settledWins = 0;
  let settledCount = 0;
  for (const [marketId, net] of perMarket) {
    if (openMarketIds.has(marketId)) continue;
    realizedPnl += net;
    settledCount += 1;
    if (net > 0) settledWins += 1;
  }
  const winRate = settledCount > 0 ? settledWins / settledCount : null;

  // --- 30-day coin-balance history (from the ledger, ending at current coins) --
  const nowMs = Date.now();
  const windowStart = nowMs - 30 * 86_400_000;
  const ledger = (allTx ?? []).map((tx) => ({
    t: new Date(tx.created_at).getTime(),
    amount: Number(tx.amount),
  }));
  const totalDelta = ledger.reduce((s, e) => s + e.amount, 0);
  const currentCoins = Number(profile?.coins ?? 0);
  let running = currentCoins - totalDelta; // balance before the first recorded tx
  const balanceHistory: { t: number; coins: number }[] = [];
  for (const e of ledger) {
    running += e.amount;
    if (e.t >= windowStart) balanceHistory.push({ t: e.t, coins: running });
  }
  // Anchor both ends so the chart always spans the full window.
  if (balanceHistory.length === 0 || balanceHistory[0].t > windowStart) {
    const startBalance = balanceHistory.length > 0
      ? currentCoins - ledger.filter((e) => e.t >= windowStart).reduce((s, e) => s + e.amount, 0)
      : currentCoins;
    balanceHistory.unshift({ t: windowStart, coins: startBalance });
  }
  balanceHistory.push({ t: nowMs, coins: currentCoins });

  return NextResponse.json({
    profile,
    positions: positionsWithValue,
    transactions: transactions ?? [],
    stats: {
      coins: currentCoins,
      openValue,
      totalValue: currentCoins + openValue,
      openStaked,
      openPnl,
      realizedPnl,
      winRate,
      settledCount,
    },
    balanceHistory,
  });
}
