import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { marketId?: string; side?: "PO" | "JO"; shares?: number }
    | null;

  if (!body?.marketId || !body?.side || !body?.shares || body.shares <= 0) {
    return NextResponse.json({ error: "Parametra të pavlefshëm" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("sell_shares", {
    p_market_id: body.marketId,
    p_side: body.side,
    p_shares: body.shares,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    coinsReceived: row?.coins_received,
    newPriceYes: row?.new_price_yes,
  });
}
