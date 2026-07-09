import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";

export const dynamic = "force-dynamic";

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

  const markets = (data ?? []).map((m) => ({
    ...m,
    market_prob: lmsrPriceYes(m.q_yes, m.q_no, m.b),
  }));

  return NextResponse.json({ markets });
}
