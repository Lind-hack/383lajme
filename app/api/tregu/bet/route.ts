import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BetRequest = {
  marketId?: string;
  side?: string;
  outcomeKey?: string;
  coins?: number;
  kind?: "f1_race_winner";
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as BetRequest | null;
  const coins = Number(body?.coins);
  if (!body?.marketId || !Number.isFinite(coins) || coins <= 0) {
    return NextResponse.json({ error: "Parametra të pavlefshëm" }, { status: 400 });
  }

  if (body.kind === "f1_race_winner") {
    const outcomeKey = String(body?.outcomeKey ?? "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(outcomeKey)) {
      return NextResponse.json({ error: "Piloti i zgjedhur nuk është i vlefshëm" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("place_f1_race_winner_bet", {
      p_market_id: body.marketId,
      p_side: outcomeKey,
      p_coins: coins,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, sharesBought: row?.shares_bought, prices: row?.prices });
  }

  const side = String(body?.side ?? "").trim().toUpperCase();
  if (side !== "PO" && side !== "JO") return NextResponse.json({ error: "Parametra të pavlefshëm" }, { status: 400 });
  const { data, error } = await supabase.rpc("place_bet", { p_market_id: body.marketId, p_side: side, p_coins: coins });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, sharesBought: row?.shares_bought, newPriceYes: row?.new_price_yes });
}
