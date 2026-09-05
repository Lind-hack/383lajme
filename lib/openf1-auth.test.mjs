import test from "node:test";
import assert from "node:assert/strict";

import { openf1AuthConfigured, openf1Headers, resetOpenF1Token } from "./openf1-auth.mjs";

const CREDS = { OPENF1_CLIENT_ID: "id", OPENF1_CLIENT_SECRET: "secret" };
const tokenResponse = (body, ok = true) => ({ ok, json: async () => body });

test("no credentials means anonymous requests, exactly as before", async () => {
  resetOpenF1Token();
  let called = 0;
  const headers = await openf1Headers({ env: {}, fetchImpl: async () => { called += 1; return tokenResponse({}); } });
  assert.deepEqual(headers, { Accept: "application/json" });
  assert.equal(called, 0, "must not call the token endpoint without credentials");
  assert.equal(openf1AuthConfigured({}), false);
  assert.equal(openf1AuthConfigured(CREDS), true);
});

test("credentials produce a bearer token from the password grant", async () => {
  resetOpenF1Token();
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, method: init?.method, body: String(init?.body ?? ""), type: init?.headers?.["Content-Type"] });
    return tokenResponse({ access_token: "tok-1", expires_in: 3600 });
  };
  const headers = await openf1Headers({ env: CREDS, fetchImpl });

  assert.equal(headers.Authorization, "Bearer tok-1");
  assert.equal(seen[0].url, "https://api.openf1.org/token");
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].type, "application/x-www-form-urlencoded");
  // The grant carries the credentials as username/password, per OpenF1's client.
  assert.match(seen[0].body, /username=id/);
  assert.match(seen[0].body, /password=secret/);
});

test("the token is reused until it is nearly expired, then refreshed once", async () => {
  resetOpenF1Token();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return tokenResponse({ access_token: "tok-" + calls, expires_in: 3600 });
  };
  const t0 = 1_000_000;
  assert.equal((await openf1Headers({ env: CREDS, fetchImpl, now: t0 })).Authorization, "Bearer tok-1");
  assert.equal((await openf1Headers({ env: CREDS, fetchImpl, now: t0 + 60_000 })).Authorization, "Bearer tok-1");
  assert.equal(calls, 1, "a valid token must not be re-fetched");

  // One minute of headroom: at 3600s - 60s the token is treated as spent.
  assert.equal((await openf1Headers({ env: CREDS, fetchImpl, now: t0 + 3_540_000 })).Authorization, "Bearer tok-2");
  assert.equal(calls, 2);
});

test("a refused or malformed token degrades to anonymous rather than throwing", async () => {
  resetOpenF1Token();
  const refused = await openf1Headers({ env: CREDS, fetchImpl: async () => tokenResponse({ detail: "no" }, false) });
  assert.deepEqual(refused, { Accept: "application/json" });

  resetOpenF1Token();
  const empty = await openf1Headers({ env: CREDS, fetchImpl: async () => tokenResponse({ expires_in: 3600 }) });
  assert.deepEqual(empty, { Accept: "application/json" });

  resetOpenF1Token();
  const thrown = await openf1Headers({ env: CREDS, fetchImpl: async () => { throw new Error("network"); } });
  assert.deepEqual(thrown, { Accept: "application/json" });
});
