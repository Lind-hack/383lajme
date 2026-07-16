import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes, lmsrThreeOutcomePrices } from "@/lib/tregu";
import { sportOutcomePrices } from "@/lib/tregu-sport-market.mjs";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

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
    query = query.in("status", ["open", "stale", "closed", "resolved"]);
  }
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const markets = (data ?? []).map((m) => ({
    ...m,
    market_prob: m.market_type === "three_outcome" ? (m.outcome_quantities ? sportOutcomePrices(m).england : lmsrThreeOutcomePrices(m).england) : lmsrPriceYes(m.q_yes, m.q_no, m.b),
    three_outcome_prices: m.market_type === "three_outcome" ? (m.outcome_quantities ? sportOutcomePrices(m) : lmsrThreeOutcomePrices(m)) : null,
  }));

  return NextResponse.json({ markets }, { headers: NO_STORE_HEADERS });
}
