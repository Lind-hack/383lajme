import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Run = { run_key: string; status: string; details: Record<string, unknown> | null; error: string | null; started_at: string; finished_at: string | null };

const ACTIVITY_WINDOW_MS = 30 * 60 * 1_000;

type MarketActivity = {
  id: string;
  automation: "news" | "sports";
  slug: string;
  status: string;
  provider: string | null;
  fallback_index: number;
  before_probability: number | null;
  after_probability: number | null;
  question: string | null;
  applied_at: string;
  odds_changed: boolean;
  percentage_point_change: number | null;
};

function toActivity(run: Run, result: unknown, index: number, automation: MarketActivity["automation"]): MarketActivity {
  const item = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const email = item.email_update && typeof item.email_update === "object" ? item.email_update as Record<string, unknown> : {};
  const before = typeof email.before_probability === "number" ? email.before_probability : null;
  const after = typeof email.after_probability === "number" ? email.after_probability : null;
  const oddsChanged = before !== null && after !== null && Math.abs(after - before) > 0.00001;
  const appliedAt = typeof email.timestamp === "string" ? email.timestamp : run.finished_at ?? run.started_at;

  return {
    id: `${run.run_key}-${index}`,
    automation,
    slug: typeof email.slug === "string" ? email.slug : String(item.slug ?? ""),
    status: String(item.status ?? "unknown"),
    provider: item.provider ? String(item.provider) : typeof email.provider === "string" ? email.provider : null,
    fallback_index: Number(item.fallback_index ?? 0),
    before_probability: before,
    after_probability: after,
    question: typeof email.question === "string" ? email.question : null,
    applied_at: appliedAt,
    odds_changed: oddsChanged,
    percentage_point_change: oddsChanged ? (after - before) * 100 : null,
  };
}

function toF1Activity(run: Run, update: unknown, index: number): MarketActivity {
  const item = update && typeof update === "object" ? update as Record<string, unknown> : {};
  const before = typeof item.before_probability === "number" ? item.before_probability : null;
  const after = typeof item.after_probability === "number" ? item.after_probability : null;
  const oddsChanged = before !== null && after !== null && Math.abs(after - before) > 0.00001;

  return {
    id: `${run.run_key}-f1-${index}`,
    automation: "sports",
    slug: typeof item.slug === "string" ? item.slug : "",
    status: "applied",
    provider: "formula1_dashboard",
    fallback_index: 0,
    before_probability: before,
    after_probability: after,
    question: typeof item.question === "string" ? item.question : null,
    applied_at: typeof item.timestamp === "string" ? item.timestamp : run.finished_at ?? run.started_at,
    odds_changed: oddsChanged,
    percentage_point_change: oddsChanged ? (after - before) * 100 : null,
  };
}

function activityFromRuns(runs: Run[] | null, automation: MarketActivity["automation"]) {
  const cutoff = Date.now() - ACTIVITY_WINDOW_MS;
  return (runs ?? [])
    .flatMap((run) => {
      const details = (run.details ?? {}) as Record<string, unknown>;
      const results = Array.isArray(details.results) ? details.results : [];
      const generalActivity = results.map((result, index) => toActivity(run, result, index, automation));
      const f1Updates = automation === "sports" && Array.isArray(details.f1_email_updates) ? details.f1_email_updates : [];
      return [...generalActivity, ...f1Updates.map((update, index) => toF1Activity(run, update, index))];
    })
    .filter((activity) => new Date(activity.applied_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
}

function summarize(runs: Run[] | null, cadenceSeconds: number, automation: MarketActivity["automation"]) {
  const latest = runs?.[0] ?? null;
  const lastSuccessful = (runs ?? []).find((run) => run.status === "succeeded" && run.finished_at) ?? null;
  const lastAt = lastSuccessful?.finished_at ? new Date(lastSuccessful.finished_at).getTime() : 0;
  const ageMs = lastAt ? Date.now() - lastAt : null;
  const status = latest?.status === "failed" ? "failed" : ageMs === null || ageMs > cadenceSeconds * 2_500 ? "stale" : ageMs <= cadenceSeconds * 1_250 ? "active" : "healthy";
  const recent_market_activity = activityFromRuns(runs, automation);
  return {
    cadence_seconds: cadenceSeconds,
    status,
    last_successful_refresh: lastSuccessful?.finished_at ?? null,
    latest_run: latest,
    activity_window_minutes: ACTIVITY_WINDOW_MS / 60_000,
    recent_market_activity,
  };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const select = "run_key,status,details,error,started_at,finished_at";
  const [sportsResult, liveResult] = await Promise.all([
    admin.from("market_automation_runs").select(select).eq("action", "live_sports").order("started_at", { ascending: false }).limit(20),
    admin.from("market_automation_runs").select(select).eq("action", "tregu_live").order("started_at", { ascending: false }).limit(20),
  ]);
  const error = sportsResult.error ?? liveResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sports_refresh: summarize(sportsResult.data as Run[] | null, 120, "sports"),
    tregu_live: summarize(liveResult.data as Run[] | null, 300, "news"),
  }, { headers: { "Cache-Control": "no-store" } });
}
