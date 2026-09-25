import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { runLiveF1RaceAutomation } from "@/lib/tregu-automation-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-minute race-day pinger (cron-job.org). Reprices live F1 race-winner
 * markets from the Formula 1 Dashboard once a minute while a race is inside its
 * window, and returns straight away every other minute of the week.
 */
export async function GET(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  try {
    const result = await runLiveF1RaceAutomation();
    return NextResponse.json({ kind: "f1_live", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "f1-live refresh failed", message }, { status: 500 });
  }
}
