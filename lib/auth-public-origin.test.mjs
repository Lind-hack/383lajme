import assert from "node:assert/strict";
import test from "node:test";

import { authPublicOrigin } from "./auth-public-origin.ts";

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
