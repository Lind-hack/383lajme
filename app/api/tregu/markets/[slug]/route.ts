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

  const { data: snapshots } = await supabase
    .from("market_snapshots")
    .select("*")
    .eq("market_id", market.id)
    .order("created_at", { ascending: true })
    .limit(200);

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

  return NextResponse.json({
    market: { ...market, market_prob: lmsrPriceYes(market.q_yes, market.q_no, market.b) },
    snapshots: snapshots ?? [],
    position,
  });
}
