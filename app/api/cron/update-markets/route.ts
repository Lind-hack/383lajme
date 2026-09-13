import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { runTreguLiveAutomation } from "@/lib/tregu-automation-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Five-minute remote-only VPS heartbeat for the verified-news AI repricer. */
export async function GET(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  try {
    const result = await runTreguLiveAutomation();
    // Persisted email_updates are delivered by the shared VPS outbox sender.
    return NextResponse.json({ kind: "tregu_live", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    // A failed authorized request already has a failed tregu_live audit row when the refresh began.
    // Normal no-evidence/no-change runs and failures intentionally do not send email.
    return NextResponse.json({ error: "tregu-live refresh failed", message }, { status: 500 });
  }
}
