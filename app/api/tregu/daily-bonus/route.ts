import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** What the bonus button shows: locked until a trade today, claimed, and the streak. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signed_in: false });

  const { data, error } = await supabase.rpc("tregu_daily_bonus_status");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? { signed_in: true });
}

/** Claim today's bonus. The amount is rolled in the database, never here. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("tregu_claim_daily_bonus");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = (data ?? {}) as { amount?: number; streak?: number; jackpot?: boolean };
  return NextResponse.json({
    ok: true,
    bonus: Number(result.amount ?? 0),
    streak: Number(result.streak ?? 1),
    jackpot: Boolean(result.jackpot),
  });
}
