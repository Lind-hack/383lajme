import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SPARK_POINTS = 28;

interface TapeRow {
  market_id: string;
  price_yes: number;
  created_at: string;
}

interface SnapRow {
  market_id: string;
  market_prob: number;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const category = request.nextUrl.searchParams.get("category");
  const status = request.nextUrl.searchParams.get("status") ?? "open";

  let query = supabase
    .from("markets")
    .select("*")
    .order("closes_at", { ascending: true });

  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["open", "closed", "resolved"]);
  }
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const ids = rows.map((m) => m.id);

  // One tape query for every listed market (sparklines + weekly deltas), the
  // 5-minute cron snapshots (books move between trades, and most books have
  // few or no trades — without snapshots every sparkline collapses to a dot),
  // and one short public feed — the hub's proof the floor is alive.
  const [tapeRes, snapRes, feedRes] = await Promise.all([
    ids.length
      ? supabase
          .from("market_trades")
          .select("market_id, price_yes, created_at")
          .in("market_id", ids)
          .order("created_at", { ascending: true })
          .limit(4000)
      : Promise.resolve({ data: [] as TapeRow[], error: null }),
    ids.length
      ? supabase
          .from("market_snapshots")
          .select("market_id, market_prob, created_at")
          .in("market_id", ids)
          .order("created_at", { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [] as SnapRow[], error: null }),
    supabase
      .from("market_trades")
      .select("action, side, coins, price_yes, created_at, profiles(display_name), markets(question, slug)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const byMarket = new Map<string, TapeRow[]>();
  for (const t of (tapeRes.data ?? []) as TapeRow[]) {
    const arr = byMarket.get(t.market_id);
    if (arr) arr.push(t);
    else byMarket.set(t.market_id, [t]);
  }

  // Fetched newest-first to keep the freshest window under the row cap;
  // reversed here so each market's snapshot tape reads oldest-first.
  const bySnap = new Map<string, SnapRow[]>();
  for (const s of ((snapRes.data ?? []) as SnapRow[]).reverse()) {
    const arr = bySnap.get(s.market_id);
    if (arr) arr.push(s);
    else bySnap.set(s.market_id, [s]);
  }

  const weekAgo = Date.now() - WEEK_MS;

  const markets = rows.map((m) => {
    const prob = lmsrPriceYes(m.q_yes, m.q_no, m.b);
    const tape = byMarket.get(m.id) ?? [];

    // Trades and cron snapshots record the same book price; interleaved by
    // time they form the fullest tape either source can offer.
    const merged = [
      ...tape.map((t) => ({ t: new Date(t.created_at).getTime(), p: t.price_yes })),
      ...(bySnap.get(m.id) ?? []).map((s) => ({ t: new Date(s.created_at).getTime(), p: Number(s.market_prob) })),
    ].sort((a, b) => a.t - b.t);

    // Weekly delta: current prob vs the last known price at/before 7 days ago
    // (or the earliest point if the market is younger than a week).
    let delta7d: number | null = null;
    if (merged.length > 0) {
      let anchor = merged[0].p;
      for (const pt of merged) {
        if (pt.t <= weekAgo) anchor = pt.p;
        else break;
      }
      delta7d = prob - anchor;
    }

    // Downsample the tape to a fixed-width sparkline, always ending at now.
    const prices = merged.map((pt) => pt.p);
    prices.push(prob);
    let spark: number[];
    if (prices.length <= SPARK_POINTS) {
      spark = prices;
    } else {
      spark = [];
      for (let i = 0; i < SPARK_POINTS; i++) {
        spark.push(prices[Math.round((i * (prices.length - 1)) / (SPARK_POINTS - 1))]);
      }
    }

    return {
      ...m,
      market_prob: prob,
      spark,
      delta7d,
      trade_count: tape.length,
    };
  });

  const activity = ((feedRes.data ?? []) as unknown as {
    action: string;
    side: string;
    coins: number;
    price_yes: number;
    created_at: string;
    profiles: { display_name: string | null } | null;
    markets: { question: string; slug: string } | null;
  }[]).map((t) => ({
    name: t.profiles?.display_name ?? "Tregtar",
    action: t.action,
    side: t.side,
    coins: Number(t.coins),
    priceYes: Number(t.price_yes),
    createdAt: t.created_at,
    question: t.markets?.question ?? "",
    slug: t.markets?.slug ?? "",
  }));

  return NextResponse.json({ markets, activity });
}
