import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { runRepriceAutomation } from "@/lib/tregu-automation-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  try {
    const result = await runRepriceAutomation();
    // finishRun persists email_updates; the VPS outbox sender retries delivery.
    return NextResponse.json({ ...result, email_delivery: "queued_for_vps" });
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
