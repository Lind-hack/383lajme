import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import { borderLogRows, shouldSkipBorderLog } from "@/lib/visit-border-log";

/** Never let a slow MPB page hold the heartbeat's background lane. */
const BORDER_LOG_TIMEOUT_MS = 8_000;

type BorderLogResult =
  | { ok: true; written: number; skipped: number; reason?: "recent_sample" }
  | { ok: false; reason: string };

function withTimeout<T>(work: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Samples the official MPB border waits into visit_border_wait_log, at most
 * once per ~10 minutes, for the Kosova në xhep border forecast. Runs from the
 * live-sports heartbeat as its own background job and never throws.
 */
export async function runBorderWaitLog(now = new Date()): Promise<BorderLogResult> {
  const result = await withTimeout(logOnce(now), BORDER_LOG_TIMEOUT_MS).catch(
    (error): BorderLogResult => ({ ok: false, reason: String(error instanceof Error ? error.message : error) }),
  );
  if (!result.ok || result.written > 0) {
    console.log(`[xhep] border_log ${JSON.stringify(result)}`);
  }
  return result;
}

async function logOnce(now: Date): Promise<BorderLogResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "no_admin_client" };

  const { data: latest, error: latestError } = await admin
    .from("visit_border_wait_log")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return { ok: false, reason: `read_failed:${latestError.message}` };
  if (shouldSkipBorderLog(latest?.fetched_at ?? null, now)) {
    return { ok: true, written: 0, skipped: 0, reason: "recent_sample" };
  }

  const waits = await fetchOfficialBorderWaits();
  const rows = borderLogRows(waits, now.toISOString());
  const { data, error } = await admin
    .from("visit_border_wait_log")
    .upsert(rows, { onConflict: "crossing_id,direction,source_key", ignoreDuplicates: true })
    .select("id");
  if (error) return { ok: false, reason: `insert_failed:${error.message}` };
  const written = data?.length ?? 0;
  return { ok: true, written, skipped: rows.length - written };
}
