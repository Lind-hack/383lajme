import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Run = { run_key: string; status: string; details: Record<string, unknown> | null; error: string | null; started_at: string; finished_at: string | null };

function summarize(runs: Run[] | null, cadenceSeconds: number) {
  const latest = runs?.[0] ?? null;
  const lastSuccessful = (runs ?? []).find((run) => run.status === "succeeded" && run.finished_at) ?? null;
  const lastAt = lastSuccessful?.finished_at ? new Date(lastSuccessful.finished_at).getTime() : 0;
  const ageMs = lastAt ? Date.now() - lastAt : null;
  const status = latest?.status === "failed" ? "failed" : ageMs === null || ageMs > cadenceSeconds * 2_500 ? "stale" : ageMs <= cadenceSeconds * 1_250 ? "active" : "healthy";
  return { cadence_seconds: cadenceSeconds, status, last_successful_refresh: lastSuccessful?.finished_at ?? null, latest_run: latest };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const select = "run_key,status,details,error,started_at,finished_at";
  const [llmResult, liveResult] = await Promise.all([
    admin.from("market_automation_runs").select(select).eq("action", "reprice").order("started_at", { ascending: false }).limit(20),
    admin.from("market_automation_runs").select(select).eq("action", "tregu_live").order("started_at", { ascending: false }).limit(20),
  ]);
  const error = llmResult.error ?? liveResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    llm_refresh: summarize(llmResult.data as Run[] | null, 120),
    tregu_live: summarize(liveResult.data as Run[] | null, 300),
  }, { headers: { "Cache-Control": "no-store" } });
}
