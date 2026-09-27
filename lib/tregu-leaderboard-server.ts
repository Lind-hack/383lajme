import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeaderboardRewardNotification } from "@/lib/tregu-live-email";
import { LEADERBOARD_PRIZES, leaderboardPeriodLabel, type LeaderboardKind, type LeaderboardReward } from "@/lib/tregu-leaderboard";

/**
 * Freezes any leaderboard period that has just ended, then emails the admin
 * every pending reward that has not been announced yet.
 *
 * Safe to run on every 5-minute tick: the lock is a no-op once a period is
 * recorded, and a reward is emailed once, by whichever run claims it — a failed
 * send is retried on the next tick instead of the winners being forgotten.
 */
export async function runLeaderboardPayouts() {
  const admin = createAdminClient();
  if (!admin) return { locked: 0, notified: 0, skipped: "supabase-not-configured" };

  let locked = 0;
  for (const kind of Object.keys(LEADERBOARD_PRIZES) as LeaderboardKind[]) {
    const { data, error } = await admin.rpc("tregu_lock_leaderboard_period", {
      p_kind: kind,
      p_prizes: [...LEADERBOARD_PRIZES[kind]],
    });
    if (error) throw new Error(`leaderboard lock (${kind}): ${error.message}`);
    locked += (data as unknown[] | null)?.length ?? 0;
  }

  // Leagues whose window has closed: private pots are paid out as approved
  // gifts straight away; public prizes join the pending rows below.
  const { data: settled, error: settleError } = await admin.rpc("tregu_settle_due_leagues");
  if (settleError) throw new Error(`league settlement: ${settleError.message}`);
  locked += (settled as unknown[] | null)?.length ?? 0;

  // Claim before sending: the primary cron and the GitHub backup can overlap,
  // and only the run whose UPDATE marks a row gets to email it. A failed send
  // releases the claim so the next tick retries.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error } = await admin
    .from("tregu_leaderboard_rewards")
    .update({ notified_at: claimedAt })
    .eq("status", "pending")
    .is("notified_at", null)
    .select("*");
  if (error) throw new Error(`leaderboard rewards: ${error.message}`);

  const rewards = ((claimed ?? []) as LeaderboardReward[]).sort(
    (a, b) => a.period_end.localeCompare(b.period_end) || a.period_kind.localeCompare(b.period_kind) || a.place - b.place
  );
  if (!rewards.length) return { locked, notified: 0 };

  try {
    await sendLeaderboardRewardNotification({
      rewards: rewards.map((r) => ({
        period_kind: r.period_kind,
        periodLabel: r.league_name ?? leaderboardPeriodLabel(r.period_kind, r.period_start, r.period_end),
        place: r.place,
        display_name: r.display_name,
        profit: Number(r.profit),
        prize: Number(r.prize),
      })),
    });
  } catch (sendError) {
    await admin
      .from("tregu_leaderboard_rewards")
      .update({ notified_at: null })
      .in("id", rewards.map((r) => r.id))
      .eq("notified_at", claimedAt);
    throw sendError;
  }

  return { locked, notified: rewards.length };
}
