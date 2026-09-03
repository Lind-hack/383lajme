import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/**
 * The admin session, as a signed token rather than the password itself.
 *
 * The cookie used to hold ADMIN_SECRET verbatim and every check compared the
 * two strings. That made the cookie a credential: anyone holding it had the
 * password permanently, could set it by hand without ever seeing the login
 * form, and would therefore walk straight past a second factor. It also meant
 * the password travelled with every single admin request.
 *
 * A token carries no secret, cannot be forged without one, and stops working on
 * its own. Rotating ADMIN_SECRET now also invalidates every outstanding
 * session, which is what rotating a credential is supposed to do.
 */

const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h, down from the previous 7 days
export const ADMIN_COOKIE = "admin_auth";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `<issuedAt>.<nonce>.<signature>` */
export function mintAdminSession(secret: string, now = Date.now()): string {
  const payload = `${now}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSession(
  token: string | undefined | null,
  secret: string,
  now = Date.now()
): boolean {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, provided] = parts;

  const issued = Number(issuedAt);
  if (!Number.isFinite(issued)) return false;
  // A future timestamp is either a clock skew or a forgery attempt; neither is
  // a session worth honouring. A small tolerance covers ordinary drift.
  if (issued > now + 60_000) return false;
  if (now - issued > MAX_AGE_MS) return false;

  const expected = sign(`${issuedAt}.${nonce}`, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the lengths are compared first and the result is constant-time
  // only for equal-length inputs -- which is the case that matters.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Shared cookie options, so no call site can quietly ship a weaker one. */
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: MAX_AGE_MS / 1000,
};
