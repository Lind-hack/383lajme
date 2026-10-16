import assert from "node:assert/strict";
import test from "node:test";

import { authPublicOrigin } from "./auth-public-origin.ts";

test("keeps callbacks on either public hostname so host-only cookies survive", () => {
  for (const host of ["383ks.com", "www.383ks.com"]) {
    assert.equal(authPublicOrigin(new URL(`https://${host}/auth/callback`), "https://www.383ks.com"), `https://${host}`);
    assert.equal(authPublicOrigin(new URL("http://localhost:8080/auth/callback"), "https://www.383ks.com", host), `https://${host}`);
  }
});
test("does not trust unrelated forwarded hosts or credentials", () => {
  for (const host of ["evil.com", "383ks.com.evil.com", "evil383ks.com", "evil@383ks.com", "383ks.com:444", "383ks.com, evil.com"]) {
    assert.equal(authPublicOrigin(new URL("http://localhost:8080/auth/callback"), "https://www.383ks.com", host), "https://www.383ks.com");
  }
});

test("uses the configured public site instead of Railway's internal request origin", () => {
  assert.equal(
    authPublicOrigin(
      new URL("https://localhost:8080/auth/callback?code=test"),
      "https://383lajme-oracle-preview.up.railway.app/"
    ),
    "https://383lajme-oracle-preview.up.railway.app"
  );
});

test("falls back to the request origin when no public site is configured", () => {
  assert.equal(
    authPublicOrigin(new URL("https://www.383ks.com/auth/callback"), ""),
    "https://www.383ks.com"
  );
});

test("does not accept a non-http public origin", () => {
  assert.equal(
    authPublicOrigin(new URL("https://www.383ks.com/auth/callback"), "javascript:alert(1)"),
    "https://www.383ks.com"
  );
});
