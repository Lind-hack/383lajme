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

function zoneOffsetMs(instantMs: number) {
  const parts = Object.fromEntries(
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
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instantMs;
}

/**
 * MPB stamps its table as "DD/MM/YYYY HH:MM:SS" in Kosovo local time.
 * Returns the UTC ISO instant, or null when the text is not that shape.
 */
export function normalizeMpbUpdatedAt(raw: string | null | undefined): string | null {
  const match = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi, ss = "0"] = match;
  const day = Number(dd);
  const month = Number(mm);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const wallAsUtc = Date.UTC(Number(yyyy), month - 1, day, hour, minute, second);
  // Two passes settle the offset across a DST boundary.
  let instant = wallAsUtc - zoneOffsetMs(wallAsUtc);
  instant = wallAsUtc - zoneOffsetMs(instant);
  const check = new Date(instant);
  if (Number.isNaN(check.getTime())) return null;
  return check.toISOString();
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
