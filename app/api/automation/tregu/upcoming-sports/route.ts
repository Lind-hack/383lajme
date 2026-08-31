import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { runF1ChampionshipAutomation, runUpcomingF1TemplateAutomation, runUpcomingFootballTemplateAutomation } from "@/lib/tregu-automation-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) return NextResponse.json({ error: "TREGU_AUTOMATION_SECRET (or CRON_SECRET) is required." }, { status: 500 });
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // OpenF1 blocks unauthenticated global access during live F1 sessions, which
    // must not block football template discovery. F1 failure is reported, not thrown.
    const [f1Result, football] = await Promise.allSettled([
      (async () => ({ race: await runUpcomingF1TemplateAutomation(new Date()), championship: await runF1ChampionshipAutomation(new Date()) }))(),
      runUpcomingFootballTemplateAutomation(new Date()),
    ]);
    if (football.status === "rejected") throw football.reason;
    if (f1Result.status === "rejected") {
      const message = String(f1Result.reason instanceof Error ? f1Result.reason.message : f1Result.reason);
      console.warn(`F1 template automation failed (football templates unaffected): ${message}`);
      return NextResponse.json({ ok: true, f1: { ok: false, error: message }, football: football.value });
    }
    return NextResponse.json({ ok: true, f1: f1Result.value, football: football.value });
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
