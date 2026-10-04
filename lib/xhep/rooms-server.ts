import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Server only (service-role client). Shared by the trip-room API routes: the
// database client, token handling,
// and a per-IP limit on creating rooms and joining (in memory, per server
// process — enough to stop a script, not meant as an accounting system).

export function roomsDb() {
  return createAdminClient();
}

export function newToken() {
  return randomBytes(24).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const isToken = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{48}$/.test(value);

const hits = new Map<string, number[]>();
/** True when this IP has done `key` fewer than `max` times in the last hour. */
export function allow(request: NextRequest, key: string, max: number) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export const NO_STORE = { "Cache-Control": "no-store" };
