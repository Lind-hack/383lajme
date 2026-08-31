import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPortfolioAnalytics } from "@/lib/tregu-portfolio.mjs";

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
        .select("*, markets(id, question, slug, status, outcome, resolved_at, category, closes_at, q_yes, q_no, b, market_type, market_classification, live_event, sport_outcomes, outcome_quantities, reference_probabilities)")
        .eq("user_id", user.id)
        .gt("shares", 0),
      supabase
        .from("transactions")
        .select("*, markets(question, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      // Group the complete trade ledger by market. A buy in an unresolved
      // market stays active capital; only settlement or a full sale realizes P/L.
      supabase
        .from("transactions")
        .select("id, type, amount, market_id, meta, created_at, markets(id, question, slug, status, outcome, resolved_at, category, market_type, sport_outcomes)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);

  const analytics = buildPortfolioAnalytics({
    profile,
    positions: positions ?? [],
    transactions: allTx ?? [],
    now: new Date(),
  });

  return NextResponse.json({
    profile,
    positions: analytics.positions,
    transactions: transactions ?? [],
    tradeHistory: analytics.tradeHistory,
    stats: analytics.stats,
    balanceHistory: analytics.balanceHistory,
  });
}
