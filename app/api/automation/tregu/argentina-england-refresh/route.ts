import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { runArgentinaEnglandPreMatchRefresh } from "@/lib/tregu-pre-match-refresh-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (body !== null && typeof body !== "object") return NextResponse.json({ error: "Discovery payload must be an object." }, { status: 400 });
  try {
    return NextResponse.json(await runArgentinaEnglandPreMatchRefresh(body ?? {}));
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
