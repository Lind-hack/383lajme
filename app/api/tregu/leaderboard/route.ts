import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Prize pools, in 383 Monedha. Rendered on the card and paid out separately.
 *  Not exported: a route module may only export handlers and route config, and
 *  Next's generated route types fail the build's type check on anything else. */
const LEADERBOARD_PRIZES = {
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
/** Start of the current calendar month, UTC. */
function monthStart(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

/** Start of the current week, UTC, Monday-based. */
function weekStart(now: Date) {
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day);
}

/** Whole days elapsed since a boundary, floored at 1 — the window the RPC takes. */
function daysSince(from: number, now: Date) {
  return Math.max(1, Math.ceil((now.getTime() - from) / 86_400_000));
}

export async function GET() {
  const supabase = await createClient();
  const now = new Date();

  /* Calendar periods, not rolling ones.
     The card counts down to the end of the month and the end of the week, and
     prizes are paid on those boundaries — so the board has to be measuring the
     same period the clock is showing. A rolling "last 30 days" would keep
     dropping a trader's earliest wins out of the window while the countdown
     implied nothing had reset yet.

     The RPC takes whole days, so the window is the days elapsed since the
     boundary. On the 1st of a month that is a single day, which is correct:
     the month has barely started. */
  const monthOpens = monthStart(now);
  const weekOpens = weekStart(now);
  const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const nextWeek = weekOpens + 7 * 86_400_000;

  const [monthly, weekly] = await Promise.all([
    supabase.rpc("tregu_leaderboard", { p_days: daysSince(monthOpens, now), p_limit: 5 }),
    supabase.rpc("tregu_leaderboard", { p_days: daysSince(weekOpens, now), p_limit: 5 }),
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
        closes: { monthly: nextMonth, weekly: nextWeek },
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
      // Epoch ms. The card counts down to these and refetches when one passes.
      closes: { monthly: nextMonth, weekly: nextWeek },
    },
    // Ranks move on every settled trade, and the card shows the visitor their
    // own position, so this is per-user and must not sit in a shared cache.
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
