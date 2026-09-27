import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LEADERBOARD_PRIZES } from "@/lib/tregu-leaderboard";

export const dynamic = "force-dynamic";

type Row = { rank: number; display_name: string; profit: number; is_me: boolean };

/**
 * Monthly and weekly trader boards.
 *
 * Both come from SECURITY DEFINER functions (migration 0083) rather than a
 * service-role read: transactions stays RLS'd to its owner, and the board
 * hands back only a name, a rank and a number.
 *
 * A trade counts once it is closed — sold out, or its market resolved and paid
 * — and its whole result lands in the period it closed in. Periods run on
 * Kosovo time: the week closes Sunday 24:00, the month on its last day. The
 * database owns those bounds so the countdown here and the prize lock can
 * never disagree about where a period ends.
 */
export async function GET() {
  const supabase = await createClient();

  const [monthly, weekly, monthBounds, weekBounds] = await Promise.all([
    supabase.rpc("tregu_leaderboard_board", { p_kind: "monthly", p_limit: 5 }),
    supabase.rpc("tregu_leaderboard_board", { p_kind: "weekly", p_limit: 5 }),
    supabase.rpc("tregu_period_bounds", { p_kind: "monthly", p_offset: 0 }),
    supabase.rpc("tregu_period_bounds", { p_kind: "weekly", p_offset: 0 }),
  ]);

  // Before migration 0083 is applied the bounds RPC does not exist; fall back to
  // UTC boundaries so the countdown still ticks instead of reading zero.
  const now = new Date();
  const utcWeekEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7) + 7);
  const utcMonthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const endOf = (result: typeof monthBounds, fallback: number) => {
    const row = (result.data as Array<{ period_end?: string }> | null)?.[0];
    return row?.period_end ? new Date(row.period_end).getTime() : fallback;
  };
  const closes = { monthly: endOf(monthBounds, utcMonthEnd), weekly: endOf(weekBounds, utcWeekEnd) };

  // The migration may not have been applied to this environment yet. That is a
  // deployment state, not a server fault: answer with empty boards so the card
  // still renders its prize structure instead of an error.
  const failed = monthly.error || weekly.error || monthBounds.error || weekBounds.error;
  if (failed) {
    return NextResponse.json(
      { monthly: [], weekly: [], prizes: LEADERBOARD_PRIZES, available: false, reason: failed.message, closes },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      monthly: (monthly.data ?? []) as Row[],
      weekly: (weekly.data ?? []) as Row[],
      prizes: LEADERBOARD_PRIZES,
      available: true,
      // Epoch ms. The card counts down to these and refetches when one passes.
      closes,
    },
    // Ranks move on every closed trade, and the card shows the visitor their
    // own position, so this is per-user and must not sit in a shared cache.
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
