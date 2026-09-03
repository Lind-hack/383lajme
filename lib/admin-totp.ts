import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * TOTP, RFC 6238, on Node's own crypto.
 *
 * No dependency: the algorithm is an HMAC over a 30-second counter and a
 * truncation, which is shorter than the code needed to wire a package in. It
 * also means nothing new can go stale or be compromised upstream on a route
 * that guards withdrawals.
 *
 * Enabled by the presence of ADMIN_TOTP_SECRET and by nothing else. Unset, the
 * admin login asks for the password alone -- deliberately, so deploying this
 * cannot lock anybody out before they have enrolled a device.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
/** One step either side, so a code is accepted across a clock skew. */
const WINDOW = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode base32 the way authenticator apps emit it. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  // Dynamic truncation, RFC 4226 section 5.4.
  const offset = digest[digest.length - 1] & 0x0f;
  const bin =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function verifyTotp(
  code: string | undefined | null,
  secretBase32: string,
  now = Date.now()
): boolean {
  if (!secretBase32) return false;
  const supplied = String(code ?? "").replace(/\D/g, "");
  if (supplied.length !== DIGITS) return false;
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (let drift = -WINDOW; drift <= WINDOW; drift += 1) {
    const expected = totpCode(secretBase32, counter + drift);
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Whether a second factor is configured at all. */
export function totpEnabled(): boolean {
  return Boolean((process.env.ADMIN_TOTP_SECRET ?? "").trim());
}

/** The otpauth:// URI an authenticator app scans. */
export function otpauthUri(secretBase32: string, account = "383 admin", issuer = "383"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}
