import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { runLiveSportsAutomation } from "@/lib/tregu-automation-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await runLiveSportsAutomation());
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
