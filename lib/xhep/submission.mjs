/**
 * Checks for a Kosova në xhep submission (app/api/xhep/submissions), kept
 * apart from the route so they can be tested without a server.
 *
 * Photos are recognised by their first bytes, never by the type the browser
 * claims: a file named .jpg that is really HTML or SVG is refused.
 */
import { PACK_CITIES } from "./packs.mjs";

export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_STORY = 2000;
/** Submissions one account may send in 24 hours. */
export const DAILY_LIMIT = 5;

/** "jpg", "png" or "webp" from a file's first bytes; null for anything else. */
export function sniffImage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export const CONTENT_TYPE = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * The form's text fields, checked. Returns { ok: true, cityId, story } or
 * { ok: false, code } with code: city | consent | story | empty.
 *
 * @param {{ cityId: unknown, story: unknown, consent: unknown, photoCount: number }} input
 */
export function checkFields({ cityId, story, consent, photoCount }) {
  if (typeof cityId !== "string" || !PACK_CITIES.includes(cityId)) return { ok: false, code: "city" };
  if (consent !== "yes") return { ok: false, code: "consent" };
  const text = typeof story === "string" ? story.trim() : "";
  if (text.length > MAX_STORY) return { ok: false, code: "story" };
  if (photoCount > MAX_PHOTOS) return { ok: false, code: "photos" };
  if (!text && photoCount === 0) return { ok: false, code: "empty" };
  return { ok: true, cityId, story: text };
}
