import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { runRepriceAutomation } from "@/lib/tregu-automation-server";

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
    return NextResponse.json(await runRepriceAutomation());
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
