import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildKuizi, publishKuizi } from "@/lib/kuizi-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Kuizi i Ditës automation.
 *
 * GET  — dry run: the quiz it would publish now (or at ?at=), plus every refusal. Writes
 *        nothing. Used to review prompt changes against real news.
 * POST — generates and publishes today's quiz unless one is already
 *        published. The heartbeat runs the same publishKuizi once a day.
 */

export async function GET(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  // ?at=<ISO> replays an earlier morning's window, for reviewing the prompt
  // against more than one day of news. Dry run only.
  const at = request.nextUrl.searchParams.get("at");
  const now = at ? new Date(at) : new Date();
  if (!Number.isFinite(now.getTime())) {
    return NextResponse.json({ error: "Parametri at nuk është datë." }, { status: 400 });
  }

  try {
    const { dateKey, result } = await buildKuizi(now, { replay: Boolean(at) });
    return NextResponse.json({ dryRun: true, dateKey, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY mungon." }, { status: 500 });
  }
  const outcome = await publishKuizi(supabase, new Date());
  return NextResponse.json(outcome, { status: outcome.status });
}
