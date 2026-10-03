/**
 * Living Card stamps. A visitor at a real place taps "I'm here"; the server
 * checks one fresh position against the curated coordinates and returns a
 * signed stamp. The location check leaves no trace: coordinates and the
 * request are never stored or logged. Only the stamp travels on, inside the
 * visitor's profile:
 *
 *   <placeId>.<issuedAt base36>.<hmac16>
 *
 * The signature binds place, card seed and time, so a stamp copied onto a
 * different card fails verification.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { PLACES } from "./places.mjs";

/** Phone GPS worse than this can't tell "at the fortress" from "near it". */
export const MAX_ACCURACY_M = 150;

/** Buildings and squares are small; parks, canyons, lakes and mountains are not. */
const WIDE_CATEGORIES = new Set(["Nature", "Waterfall", "Day trip", "Mountain"]);

export function stampRadiusM(place) {
  return WIDE_CATEGORIES.has(place.category.en) ? 1500 : 300;
}

export function distanceM(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(h));
}

const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));

/**
 * Decide a stamp request. Returns { ok: true, placeId } or { ok: false, code }.
 * Codes: unknown_place, no_location, low_accuracy, too_far.
 */
export function checkStamp({ placeId, latitude, longitude, accuracy }) {
  const place = PLACE_BY_ID.get(placeId);
  if (!place) return { ok: false, code: "unknown_place" };
  if (!place.coords) return { ok: false, code: "no_location" };
  if (![latitude, longitude, accuracy].every(Number.isFinite) || accuracy <= 0) return { ok: false, code: "low_accuracy" };
  if (accuracy > MAX_ACCURACY_M) return { ok: false, code: "low_accuracy" };
  const d = distanceM({ lat: latitude, lon: longitude }, place.coords);
  if (d > stampRadiusM(place)) return { ok: false, code: "too_far", distanceM: Math.round(d / 100) * 100 };
  return { ok: true, placeId };
}

function mac(secret, placeId, seed, issued) {
  return createHmac("sha256", secret).update(`${placeId}|${seed}|${issued}`).digest("hex").slice(0, 16);
}

export function signStamp(secret, placeId, seed, now = Date.now()) {
  const issued = Math.floor(now / 1000).toString(36);
  return `${placeId}.${issued}.${mac(secret, placeId, seed, issued)}`;
}

export function verifyStamp(secret, stamp, seed) {
  const m = /^([a-z0-9-]{3,80})\.([0-9a-z]{4,10})\.([0-9a-f]{16})$/.exec(String(stamp));
  if (!m || !PLACE_BY_ID.has(m[1])) return false;
  const expected = Buffer.from(mac(secret, m[1], seed, m[2]));
  const given = Buffer.from(m[3]);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The place id inside a stamp, or null for anything malformed. */
export function stampPlaceId(stamp) {
  const id = /^([a-z0-9-]{3,80})\./.exec(String(stamp))?.[1];
  return id && PLACE_BY_ID.has(id) ? id : null;
}
