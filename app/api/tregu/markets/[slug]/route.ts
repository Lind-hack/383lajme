import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: market, error } = await supabase
    .from("markets")
    .select("*")
    .eq("slug", slug)
    .in("status", ["open", "closed", "resolved"])
    .single();

  if (error || !market) {
    return NextResponse.json({ error: "Tregu nuk u gjet" }, { status: 404 });
  }

  const [{ data: snapshots }, { data: trades }, { data: activity }, { data: related }] =
    await Promise.all([
      supabase
        .from("market_snapshots")
        .select("*")
        .eq("market_id", market.id)
        .order("created_at", { ascending: true })
        .limit(200),
      // Full trade tape (ascending) — the chart's price history.
      supabase
        .from("market_trades")
        .select("id, action, side, coins, shares, price_yes, created_at")
        .eq("market_id", market.id)
        .order("created_at", { ascending: true })
        .limit(500),
      // Most recent trades with trader display names — the activity feed.
      supabase
        .from("market_trades")
        .select("id, action, side, coins, shares, price_yes, created_at, profiles(display_name)")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("markets")
        .select("slug, question, category, q_yes, q_no, b, closes_at")
        .eq("category", market.category)
        .eq("status", "open")
        .neq("id", market.id)
        .order("updated_at", { ascending: false })
        .limit(3),
    ]);

  let position = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: positions } = await supabase
      .from("positions")
      .select("*")
      .eq("market_id", market.id)
      .eq("user_id", user.id);
    position = positions ?? [];
  }

  const currentProb = lmsrPriceYes(market.q_yes, market.q_no, market.b);

  // Weekly delta: current price vs the last known price from >= 7 days ago
  // (trade tape first, snapshots as fallback for pre-0003 markets).
  const weekAgo = Date.now() - 7 * 86_400_000;
  const history = [
    ...(snapshots ?? []).map((s) => ({ t: new Date(s.created_at).getTime(), p: s.market_prob })),
    ...(trades ?? []).map((t) => ({ t: new Date(t.created_at).getTime(), p: t.price_yes })),
  ].sort((a, b) => a.t - b.t);
  const before = history.filter((h) => h.t <= weekAgo);
  const baseline = before.length > 0 ? before[before.length - 1].p : history[0]?.p ?? null;
  const weeklyDelta = baseline === null ? null : currentProb - baseline;

  const traders = new Set(
    (activity ?? []).map((t) => JSON.stringify(t.profiles)).filter(Boolean)
  );
  // Distinct traders across the full tape needs user ids; the public feed only
  // carries display names, so count distinct via a dedicated head query.
  const { count: tradeCount } = await supabase
    .from("market_trades")
    .select("id", { count: "exact", head: true })
    .eq("market_id", market.id);

  const relatedWithProb = (related ?? []).map((m) => ({
    slug: m.slug,
    question: m.question,
    category: m.category,
    prob: lmsrPriceYes(m.q_yes, m.q_no, m.b),
    volume: m.q_yes + m.q_no,
    closesAt: m.closes_at,
  }));

  return NextResponse.json({
    market: { ...market, market_prob: currentProb },
    snapshots: snapshots ?? [],
    trades: trades ?? [],
    activity: activity ?? [],
    related: relatedWithProb,
    weeklyDelta,
    tradeCount: tradeCount ?? 0,
    tradersApprox: traders.size,
    position,
  });
}
