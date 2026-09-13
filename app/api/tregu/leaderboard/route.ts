import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Prize pools, in 383 Monedha. Rendered on the card and paid out separately. */
export const LEADERBOARD_PRIZES = {
  monthly: [500, 300, 150],
  weekly: [125, 75, 40],
} as const;

type Row = { rank: number; display_name: string; profit: number; is_me: boolean };

/**
 * Monthly and weekly trader boards, ranked on realized trading profit.
 *
 * Both come from one SECURITY DEFINER function (migration 0079) rather than a
 * service-role read: transactions stays RLS'd to its owner, and the function
 * hands back only a name, a rank and a number.
 *
 * The caller's own row rides along in the same result — the function appends it
 * when it falls outside the top N — so "where am I" costs no second query and
 * no client-side stitching.
 */
export async function GET() {
  const supabase = await createClient();

  const [monthly, weekly] = await Promise.all([
    supabase.rpc("tregu_leaderboard", { p_days: 30, p_limit: 5 }),
    supabase.rpc("tregu_leaderboard", { p_days: 7, p_limit: 5 }),
  ]);

  // The migration may not have been applied to this environment yet. That is a
  // deployment state, not a server fault: answer with empty boards so the card
  // still renders its prize structure instead of the floor showing an error
  // where a leaderboard should be.
  const failed = monthly.error || weekly.error;
  if (failed) {
    return NextResponse.json(
      {
        monthly: [],
        weekly: [],
        prizes: LEADERBOARD_PRIZES,
        available: false,
        reason: failed.message,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      monthly: (monthly.data ?? []) as Row[],
      weekly: (weekly.data ?? []) as Row[],
      prizes: LEADERBOARD_PRIZES,
      available: true,
    },
    // Ranks move on every settled trade, and the card shows the visitor their
    // own position, so this is per-user and must not sit in a shared cache.
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
