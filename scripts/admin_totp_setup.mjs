/**
 * Enrol an authenticator app for the 383 admin dashboard.
 *
 *   node scripts/admin_totp_setup.mjs
 *
 * Prints a fresh base32 secret and the otpauth:// uri to scan. Nothing is
 * written anywhere: the secret goes into Vercel by hand, deliberately, so it
 * never lands in the repo, a shell history file, or a log.
 */
import { randomBytes, createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** 160 bits, which is what RFC 4226 recommends and what apps expect. */
function generateSecret() {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function decode(secret) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of secret.toUpperCase().replace(/=+$/, "")) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function codeFor(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const d = createHmac("sha1", decode(secret)).update(buf).digest();
  const o = d[d.length - 1] & 0x0f;
  const bin = ((d[o] & 0x7f) << 24) | ((d[o + 1] & 0xff) << 16) | ((d[o + 2] & 0xff) << 8) | (d[o + 3] & 0xff);
  return String(bin % 1e6).padStart(6, "0");
}

const secret = generateSecret();
const params = new URLSearchParams({
  secret,
  issuer: "383",
  algorithm: "SHA1",
  digits: "6",
  period: "30",
});
const uri = `otpauth://totp/${encodeURIComponent("383:admin")}?${params}`;

console.log("\n  ADMIN_TOTP_SECRET\n");
console.log("    " + secret);
console.log("\n  Scan this in Google Authenticator, Authy or 1Password:\n");
console.log("    " + uri);
console.log("\n  Or type the secret in by hand, choosing \"time based\".\n");
console.log("  The code right now, to check the app agrees before you rely on it:\n");
console.log("    " + codeFor(secret, Math.floor(Date.now() / 1000 / 30)));
console.log("\n  Then add ADMIN_TOTP_SECRET to Vercel and redeploy. Until that variable");
console.log("  exists the login asks for the password alone, so nothing locks you out");
console.log("  while you are still setting the app up.\n");
