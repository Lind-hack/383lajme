import test from "node:test";
import assert from "node:assert/strict";
import { mintAdminSession, verifyAdminSession, ADMIN_COOKIE_OPTIONS } from "./admin-session.ts";
import { totpCode, verifyTotp, base32Decode, otpauthUri } from "./admin-totp.ts";

const SECRET = "a-long-random-admin-secret-value";

/* ── the session token ─────────────────────────────────────────────────────── */

test("a minted session verifies against the secret that signed it", () => {
  assert.equal(verifyAdminSession(mintAdminSession(SECRET), SECRET), true);
});

test("the token never contains the secret", () => {
  // The whole point of the change: the old cookie was the password verbatim.
  assert.ok(!mintAdminSession(SECRET).includes(SECRET));
});

test("a token signed by another secret is refused", () => {
  assert.equal(verifyAdminSession(mintAdminSession("other-secret"), SECRET), false);
});

test("rotating the secret invalidates every outstanding session", () => {
  const issued = mintAdminSession(SECRET);
  assert.equal(verifyAdminSession(issued, SECRET), true);
  assert.equal(verifyAdminSession(issued, SECRET + "-rotated"), false);
});

test("a token older than its lifetime is refused", () => {
  const thirteenHours = 13 * 60 * 60 * 1000;
  const old = mintAdminSession(SECRET, Date.now() - thirteenHours);
  assert.equal(verifyAdminSession(old, SECRET), false);
});

test("a token dated in the future is refused", () => {
  const future = mintAdminSession(SECRET, Date.now() + 10 * 60 * 1000);
  assert.equal(verifyAdminSession(future, SECRET), false);
});

test("a tampered payload no longer matches its signature", () => {
  const [issuedAt, nonce, sig] = mintAdminSession(SECRET).split(".");
  assert.equal(verifyAdminSession(`${Number(issuedAt) + 1}.${nonce}.${sig}`, SECRET), false);
});

test("malformed, empty and missing tokens are all refused", () => {
  for (const bad of ["", "a.b", "a.b.c.d", undefined, null, "....", "notatoken"]) {
    assert.equal(verifyAdminSession(bad, SECRET), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test("an empty secret can never authenticate anyone", () => {
  // Without this, an unset ADMIN_SECRET would make "" === "" and open the door.
  assert.equal(verifyAdminSession(mintAdminSession(""), ""), false);
});

test("the cookie is httpOnly, strict and not permanent", () => {
  assert.equal(ADMIN_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(ADMIN_COOKIE_OPTIONS.sameSite, "strict");
  assert.ok(ADMIN_COOKIE_OPTIONS.maxAge <= 12 * 60 * 60, "12 hours at most");
});

/* ── the second factor ─────────────────────────────────────────────────────── */

// RFC 4226 appendix D: the published vectors for the ASCII secret "12345678901234567890",
// which is base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("totp matches the RFC 4226 published vectors", () => {
  const expected = ["755224", "287082", "359152", "969429", "338314"];
  expected.forEach((code, counter) => {
    assert.equal(totpCode(RFC_SECRET, counter), code, `counter ${counter}`);
  });
});

test("base32 decoding round-trips the RFC secret", () => {
  assert.equal(base32Decode(RFC_SECRET).toString("ascii"), "1234567890123456789012345678901234567890".slice(0, 20));
});

test("the current code verifies and a wrong one does not", () => {
  const now = Date.now();
  const counter = Math.floor(now / 1000 / 30);
  assert.equal(verifyTotp(totpCode(RFC_SECRET, counter), RFC_SECRET, now), true);
  assert.equal(verifyTotp("000000", RFC_SECRET, now), false);
});

test("a code one step either side is accepted, two steps is not", () => {
  const now = Date.now();
  const counter = Math.floor(now / 1000 / 30);
  assert.equal(verifyTotp(totpCode(RFC_SECRET, counter - 1), RFC_SECRET, now), true, "clock skew behind");
  assert.equal(verifyTotp(totpCode(RFC_SECRET, counter + 1), RFC_SECRET, now), true, "clock skew ahead");
  assert.equal(verifyTotp(totpCode(RFC_SECRET, counter + 3), RFC_SECRET, now), false, "not an open window");
});

test("malformed codes are refused rather than throwing", () => {
  const now = Date.now();
  for (const bad of ["", "12345", "1234567", "abcdef", undefined, null]) {
    assert.equal(verifyTotp(bad, RFC_SECRET, now), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test("no configured secret means no code can ever pass", () => {
  assert.equal(verifyTotp("755224", "", Date.now()), false);
});

test("the enrolment uri carries what an authenticator app needs", () => {
  const uri = otpauthUri(RFC_SECRET);
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.ok(uri.includes(`secret=${RFC_SECRET}`));
  assert.ok(uri.includes("digits=6") && uri.includes("period=30"));
});
