/**
 * Short links for messaging apps.
 *
 * A canonical article URL runs 70-90 characters, most of it slug. WhatsApp
 * cannot hyperlink text — a plain message shows whatever URL it contains, in
 * full — so a shared story arrives with a wall of hyphenated Albanian above
 * the preview card. /a/<code> is the same story in about 26 characters.
 *
 * The code is derived from the slug rather than stored, so there is no column
 * to migrate, no backfill, and no way for a code and its article to disagree.
 * Every article that has ever existed already has one.
 *
 * The bare domain is deliberate: 383ks.com serves directly, so skipping www
 * costs nothing and saves four characters where they are most visible.
 */

const SHORT_BASE = "https://383ks.com";

/**
 * FNV-1a, 32-bit. Chosen because it is short enough to read, has no
 * dependencies, and — unlike a truncated cryptographic hash — is trivially
 * identical in the redirect route and the message that links to it.
 * Written with Math.imul and >>> 0 so it stays in unsigned 32-bit range
 * rather than drifting into float territory.
 */
export function shortCode(slug) {
  const text = String(slug ?? "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0").slice(-7);
}

/** The short URL a reader can paste anywhere. */
export function shortUrl(slug) {
  return `${SHORT_BASE}/a/${shortCode(slug)}`;
}
