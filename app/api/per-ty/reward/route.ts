import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** PostgREST's "no such function": the migration (supabase/migrations/0117) is not applied. */
function missing(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST202" || /could not find the function/i.test(error?.message ?? "");
}

/**
 * Për ty's daily reward for finishing the paper (supabase/migrations/0117).
 * `available: false` hides the reward entirely, for guests too: no migration
 * yet, or the database is unreachable. The paper never waits on it.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A guest cannot run it, but asking still says whether it exists: the
  // database refuses a guest (42501) only for a function it has.
  const { data, error } = await supabase.rpc("perty_reward_status");
  if (missing(error)) return NextResponse.json({ available: false });
  if (!user) {
    const exists = !error || error.code === "42501" || /permission denied/i.test(error.message ?? "");
    return NextResponse.json(exists ? { available: true, signed_in: false } : { available: false });
  }
  if (error) return NextResponse.json({ available: false });
  return NextResponse.json({ available: true, ...(data ?? { signed_in: true }) });
}

/** Collect today's reward. Amount and the once-a-day limit live in the database. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  const { data, error } = await supabase.rpc("perty_claim_daily_reward");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = (data ?? {}) as { amount?: number; streak?: number; balance?: number };
  return NextResponse.json({
    ok: true,
    amount: Number(result.amount ?? 0),
    streak: Number(result.streak ?? 1),
    balance: Number(result.balance ?? 0),
  });
}
