import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { runArgentinaEnglandPreMatchRefresh } from "@/lib/tregu-pre-match-refresh-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) return NextResponse.json({ error: "TREGU_AUTOMATION_SECRET (or CRON_SECRET) is required." }, { status: 500 });
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body !== null && typeof body !== "object") return NextResponse.json({ error: "Discovery payload must be an object." }, { status: 400 });
  try {
    return NextResponse.json(await runArgentinaEnglandPreMatchRefresh(body ?? {}));
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
