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

  const [{ data: profile }, { data: positions }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("positions")
      .select("*, markets(question, slug, status, outcome, q_yes, q_no, b)")
      .eq("user_id", user.id)
      .gt("shares", 0),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const positionsWithValue = (positions ?? []).map((p) => {
    const m = p.markets as unknown as { q_yes: number; q_no: number; b: number } | null;
    const currentPriceYes = m ? lmsrPriceYes(m.q_yes, m.q_no, m.b) : null;
    const currentValue =
      currentPriceYes === null ? null : p.shares * (p.side === "PO" ? currentPriceYes : 1 - currentPriceYes);
    return { ...p, currentValue };
  });

  return NextResponse.json({
    profile,
    positions: positionsWithValue,
    transactions: transactions ?? [],
  });
}
