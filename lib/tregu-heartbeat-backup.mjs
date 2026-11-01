// The Tregu sports heartbeat's second engine.
//
// Live odds, scores, NBA and Superliga markets all ride on one call:
// /api/automation/tregu/live-sports, which a systemd timer on the VPS makes
// every two minutes. On 2026-10-30 a news-release cleanup deleted the folder
// that timer ran from, and every sports market froze mid-match for two days
// with no alert. This loop lives inside the production web server instead: it
// looks at when the heartbeat last ran and, only if the VPS has gone quiet,
// runs it itself. While the VPS is healthy it never fires.

/** The VPS ticks every 120s; a run older than this means it has stopped. */
export const BACKUP_STALE_AFTER_MS = 150_000;
export const BACKUP_CHECK_EVERY_MS = 30_000;

/** True when the newest live_sports run started too long ago (or never). */
export function heartbeatIsStale(lastStartedAt, now = Date.now()) {
  const at = Date.parse(String(lastStartedAt ?? ""));
  return !Number.isFinite(at) || now - at > BACKUP_STALE_AFTER_MS;
}

/** Only the production server runs the backup; TREGU_HEARTBEAT_BACKUP=0/1 overrides. */
export function backupEnabled(env = process.env) {
  if (env.TREGU_HEARTBEAT_BACKUP === "0") return false;
  if (env.NEXT_PHASE === "phase-production-build") return false;
  if (env.TREGU_HEARTBEAT_BACKUP === "1") return true;
  return env.RAILWAY_ENVIRONMENT_NAME === "production" && env.NODE_ENV === "production";
}

/**
 * One check. `lastRunAt` reads the newest live_sports start, `run` performs the
 * heartbeat. Returns what happened, for logs and tests.
 */
export async function backupTick({ lastRunAt, run, now = () => Date.now(), state = {} }) {
  if (state.running) return "busy";
  const last = await lastRunAt();
  if (!heartbeatIsStale(last, now())) {
    if (state.covering) console.info("[tregu-heartbeat] the VPS heartbeat is back; backup standing down");
    state.covering = false;
    return "healthy";
  }
  if (!state.covering) console.warn(`[tregu-heartbeat] no live_sports run since ${last ?? "ever"}; this server is running it until the VPS returns`);
  state.covering = true;
  state.running = true;
  try {
    await run();
    return "ran";
  } catch (error) {
    console.error("[tregu-heartbeat] backup run failed:", error instanceof Error ? error.message : String(error));
    return "failed";
  } finally {
    state.running = false;
  }
}
