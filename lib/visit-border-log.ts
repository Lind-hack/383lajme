import { createHash } from "node:crypto";

/**
 * Pure helpers for the border wait history (visit_border_wait_log). The
 * server side lives in lib/visit-border-log-server.ts; this file has no
 * "@/" imports so node --test can load it directly.
 */

export type LoggedWait = {
  crossingId: string;
  entry: { min: number; max: number };
  exit: { min: number; max: number };
  updatedAt: string | null;
};

export type BorderLogRow = {
  crossing_id: string;
  direction: "entry" | "exit";
  min_minutes: number;
  max_minutes: number;
  source_key: string;
  mpb_updated_at: string | null;
  fetched_at: string;
};

/** MPB publishes a sample roughly every 10 minutes; anything sooner is a wasted fetch. */
export const BORDER_LOG_MIN_INTERVAL_MS = 9 * 60 * 1000;

const KOSOVO_TZ = "Europe/Belgrade";

function kosovoWallParts(instantMs: number) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: KOSOVO_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instantMs))
      .map((part) => [part.type, part.value]),
  );
}

/** The Kosovo wall clock at an instant, read back as if it were UTC. */
function kosovoWallAsUtc(instantMs: number) {
  const parts = kosovoWallParts(instantMs);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

/**
 * MPB stamps its table as "DD/MM/YYYY HH:MM:SS" in Kosovo local time.
 * Returns the UTC ISO instant, or null when the text is not that shape or
 * names a wall time that never existed (31/02, a DST spring-forward gap).
 */
export function normalizeMpbUpdatedAt(raw: string | null | undefined): string | null {
  const match = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi, ss = "0"] = match;
  const wallAsUtc = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
  if (!Number.isFinite(wallAsUtc)) return null;
  // Two passes settle the offset across a DST boundary.
  let instant = wallAsUtc - (kosovoWallAsUtc(wallAsUtc) - wallAsUtc);
  instant = wallAsUtc - (kosovoWallAsUtc(instant) - instant);
  // Round trip: the instant must show exactly the wall time MPB printed.
  // Date.UTC silently rolls 31/02 into March and a gap hour into the next.
  if (kosovoWallAsUtc(instant) !== wallAsUtc) return null;
  const expected = new Date(wallAsUtc);
  if (
    expected.getUTCFullYear() !== Number(yyyy) ||
    expected.getUTCMonth() !== Number(mm) - 1 ||
    expected.getUTCDate() !== Number(dd) ||
    expected.getUTCHours() !== Number(hh) ||
    expected.getUTCMinutes() !== Number(mi) ||
    expected.getUTCSeconds() !== Number(ss)
  ) {
    return null;
  }
  return new Date(instant).toISOString();
}

/**
 * One row per crossing and direction. When MPB's stamp is unreadable the
 * source key falls back to a hash of the table plus the 10-minute slot, so
 * an unchanged table still yields one sample per slot instead of none.
 */
export function borderLogRows(waits: readonly LoggedWait[], fetchedAt: string): BorderLogRow[] {
  const fetchedMs = Date.parse(fetchedAt);
  const slot = Number.isFinite(fetchedMs) ? Math.floor(fetchedMs / (10 * 60 * 1000)) : 0;
  const snapshot = createHash("sha256")
    .update(JSON.stringify(waits.map((wait) => [wait.crossingId, wait.entry, wait.exit])))
    .update(`:${slot}`)
    .digest("hex")
    .slice(0, 24);

  return waits.flatMap((wait) => {
    const updated = normalizeMpbUpdatedAt(wait.updatedAt);
    const sourceKey = updated ?? `snapshot:${snapshot}`;
    return (["entry", "exit"] as const).map((direction) => ({
      crossing_id: wait.crossingId,
      direction,
      min_minutes: wait[direction].min,
      max_minutes: wait[direction].max,
      source_key: sourceKey,
      mpb_updated_at: updated,
      fetched_at: fetchedAt,
    }));
  });
}

/** True when the newest stored sample is recent enough that fetching MPB again is pointless. */
export function shouldSkipBorderLog(lastFetchedAt: string | null | undefined, now: Date) {
  const last = lastFetchedAt ? Date.parse(lastFetchedAt) : Number.NaN;
  if (!Number.isFinite(last)) return false;
  return now.getTime() - last < BORDER_LOG_MIN_INTERVAL_MS;
}
