import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import { borderLogRows, shouldSkipBorderLog } from "@/lib/visit-border-log";

/** Never let a slow MPB page hold the heartbeat's background lane. */
const BORDER_LOG_TIMEOUT_MS = 8_000;

type BorderLogResult =
  | { ok: true; written: number; skipped: number; reason?: "recent_sample" | "recent_attempt" }
  | { ok: false; reason: string };

/**
 * When MPB's stamp stalls, every row is a duplicate and fetched_at never
 * moves, so the DB check alone would refetch MPB on every 2-minute heartbeat.
 * This in-process guard spaces attempts out regardless; a restart only
 * costs one early attempt.
 */
let lastAttemptAt: string | null = null;

/**
 * Samples the official MPB border waits into visit_border_wait_log, at most
 * once per ~10 minutes, for the Kosova në xhep border forecast. Runs from the
 * live-sports heartbeat as its own background job and never throws. Every
 * attempt that reaches MPB logs one line; throttled skips stay silent.
 */
export async function runBorderWaitLog(now = new Date()): Promise<BorderLogResult> {
  if (shouldSkipBorderLog(lastAttemptAt, now)) return { ok: true, written: 0, skipped: 0, reason: "recent_attempt" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${BORDER_LOG_TIMEOUT_MS}ms`)), BORDER_LOG_TIMEOUT_MS);
  const result = await logOnce(now, controller.signal)
    .catch((error): BorderLogResult => ({
      ok: false,
      reason: controller.signal.aborted
        ? String(controller.signal.reason instanceof Error ? controller.signal.reason.message : "aborted")
        : String(error instanceof Error ? error.message : error),
    }))
    .finally(() => clearTimeout(timer));

  if (result.ok && result.reason === "recent_sample") return result;
  console.log(`[xhep] border_log ${JSON.stringify(result)}`);
  return result;
}

async function logOnce(now: Date, signal: AbortSignal): Promise<BorderLogResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "no_admin_client" };

  const { data: latest, error: latestError } = await admin
    .from("visit_border_wait_log")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .abortSignal(signal)
    .maybeSingle();
  if (latestError) return { ok: false, reason: `read_failed:${latestError.message}` };
  if (shouldSkipBorderLog(latest?.fetched_at ?? null, now)) {
    return { ok: true, written: 0, skipped: 0, reason: "recent_sample" };
  }

  lastAttemptAt = now.toISOString();
  const waits = await fetchOfficialBorderWaits({ fresh: true, signal });
  const rows = borderLogRows(waits, now.toISOString());
  const { data, error } = await admin
    .from("visit_border_wait_log")
    .upsert(rows, { onConflict: "crossing_id,direction,source_key", ignoreDuplicates: true })
    .select("id")
    .abortSignal(signal);
  if (error) return { ok: false, reason: `insert_failed:${error.message}` };
  const written = data?.length ?? 0;
  return { ok: true, written, skipped: rows.length - written };
}

