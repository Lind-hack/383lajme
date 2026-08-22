import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { runRepriceAutomation } from "@/lib/tregu-automation-server";
import { sendTreguLiveNotification } from "@/lib/tregu-live-email";
import { hasEvidenceBackedRepriceChanges } from "@/lib/tregu-live-email-content.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) {
    return NextResponse.json({ error: "TREGU_AUTOMATION_SECRET (or CRON_SECRET) is required." }, { status: 500 });
  }
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runRepriceAutomation();
    if (!result.skipped && "email_updates" in result && hasEvidenceBackedRepriceChanges(result)) {
      await sendTreguLiveNotification({ kind: "news_update", runKey: result.runKey, changes: result.email_updates });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
