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
    | {
        marketId?: string;
        side?: "PO" | "JO";
        kind?: "sport_outcome";
        outcomeKey?: string;
        shares?: number;
      }
    | null;

  if (!body?.marketId || !body?.shares || body.shares <= 0) {
    return NextResponse.json({ error: "Parametra të pavlefshëm" }, { status: 400 });
  }

  if (body.kind === "sport_outcome") {
    const outcomeKey = String(body.outcomeKey ?? "").trim();
    if (!/^[a-z0-9_-]{1,40}$/i.test(outcomeKey)) {
      return NextResponse.json({ error: "Rezultati i zgjedhur nuk është i vlefshëm" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("sell_sport_market_shares", {
      p_market_id: body.marketId,
      p_side: outcomeKey,
      p_shares: body.shares,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      ok: true,
      coinsReceived: row?.coins_received,
      prices: row?.prices,
    });
  }

  if (!body.side) {
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
