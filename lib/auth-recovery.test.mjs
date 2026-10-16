import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { authPublicOrigin } from "./auth-public-origin.ts";

function loadConfirm(auth) {
  const source = readFileSync(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, URL,
    require: (name) => {
      if (name === "next/server") return { NextResponse: { redirect: (url) => url } };
      if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth }) };
      if (name === "@/lib/auth-public-origin") return { authPublicOrigin };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports.GET;
}

test("recovery email always lands on the password editor after verification", async () => {
  let verified;
  const get = loadConfirm({ verifyOtp: async (options) => { verified = options; return { error: null }; } });
  const result = await get({ url: "https://www.383ks.com/auth/confirm?token_hash=test-token&type=recovery&next=/", headers: new Headers() });
  assert.equal(result, "https://www.383ks.com/hyr/fjalekalimi?mode=reset");
  assert.equal(verified.type, "recovery");
  assert.equal(verified.token_hash, "test-token");
});

test("expired recovery email returns to reset request with a useful error", async () => {
  const get = loadConfirm({ verifyOtp: async () => ({ error: { message: "expired" } }) });
  assert.equal(await get({ url: "https://www.383ks.com/auth/confirm?token_hash=expired&type=recovery", headers: new Headers() }),
    "https://www.383ks.com/hyr/fjalekalimi?error=recovery");
});

test("ordinary signup confirmation preserves its destination", async () => {
  const get = loadConfirm({ verifyOtp: async () => ({ error: null }) });
  assert.equal(await get({ url: "https://www.383ks.com/auth/confirm?token_hash=test&type=email&next=/tregu", headers: new Headers() }),
    "https://www.383ks.com/tregu");
});

test("missing recovery token never verifies or opens the password editor", async () => {
  const get = loadConfirm({ verifyOtp: async () => { assert.fail("Missing token must not be verified"); } });
  assert.equal(await get({ url: "https://www.383ks.com/auth/confirm?type=recovery", headers: new Headers() }),
    "https://www.383ks.com/hyr/fjalekalimi?error=recovery");
});

test("recovery preserves the public host when the server sees an internal origin", async () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.383ks.com";
  try {
    const get = loadConfirm({ verifyOtp: async () => ({ error: null }) });
    assert.equal(await get({ url: "http://localhost:8080/auth/confirm?token_hash=test&type=recovery", headers: new Headers({ "x-forwarded-host": "383ks.com" }) }),
      "https://383ks.com/hyr/fjalekalimi?mode=reset");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
