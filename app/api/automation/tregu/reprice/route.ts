import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { runRepriceAutomation } from "@/lib/tregu-automation-server";
import { runLeaderboardPayouts } from "@/lib/tregu-leaderboard-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  // Leaderboard prizes and league settlement ride this heartbeat: it is the
  // one the VPS actually runs (every 15 minutes). They were first hooked only
  // into /api/cron/update-markets, whose external pinger had lapsed, so the
  // first weekly lock never fired. In their own try, so a payout problem never
  // fails the repricer and a repricer failure never holds up a payout.
  let leaderboard: Record<string, unknown>;
  try {
    leaderboard = await runLeaderboardPayouts();
  } catch (error) {
    leaderboard = { error: String(error instanceof Error ? error.message : error) };
  }

  try {
    const result = await runRepriceAutomation();
    // finishRun persists email_updates; the VPS outbox sender retries delivery.
    return NextResponse.json({ ...result, leaderboard, email_delivery: "queued_for_vps" });
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error), leaderboard }, { status: 500 });
  }
}
