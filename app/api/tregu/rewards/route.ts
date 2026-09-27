import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET: the caller's leaderboard prizes that are approved and not yet opened.
 * RLS (migration 0083) already limits rows to the caller's own approved or
 * claimed rewards; this narrows to the ones still waiting to be collected.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ rewards: [] }, { headers: { "Cache-Control": "private, no-store" } });

  const { data, error } = await supabase
    .from("tregu_leaderboard_rewards")
    .select("id, period_kind, period_start, period_end, place, profit, prize, league_name")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("period_end", { ascending: true })
    .order("place", { ascending: true });

  // Not migrated yet is a deployment state: no gifts, not an error on the floor.
  if (error) return NextResponse.json({ rewards: [] }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ rewards: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { id }: collect one prize into the balance. Returns the new balance. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Shpërblim i pavlefshëm" }, { status: 400 });

  const { data, error } = await supabase.rpc("tregu_claim_leaderboard_reward", { p_reward_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, balance: Number(data) });
}
