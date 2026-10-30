import test from "node:test";
import assert from "node:assert/strict";
import { runReprice } from "./run-tregu-reprice.mjs";
const env = { TREGU_AUTOMATION_URL: "https://example.org/", TREGU_AUTOMATION_SECRET: "test-only" };
const reply = (status, body = { ok: true }) => new Response(JSON.stringify(body), { status });
function setup(replies) {
  const calls = [];
  return { calls, env, sleep: async () => {}, log: () => {}, fetchImpl: async (...args) => {
    calls.push(args);
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next;
  } };
}
test("retries transient HTTP and connection failures with bounded requests", async () => {
  for (const first of [reply(503), reply(429), new TypeError("connection lost")]) {
    const options = setup([first, reply(200)]);
    assert.equal((await runReprice(options)).ok, true);
    assert.equal(options.calls.length, 2);
    assert.equal(options.calls[0][0], "https://example.org/api/automation/tregu/reprice");
    assert.ok(options.calls.every(([, request]) => request.signal instanceof AbortSignal));
  }
});
test("authentication errors are not retried", async () => {
  const options = setup([reply(401, { error: "private response" })]);
  await assert.rejects(runReprice(options), /HTTP 401/);
  assert.equal(options.calls.length, 1);
});
test("uses the production canonical host and prevents POST-to-GET redirects", async () => {
  const options = setup([reply(200)]);
  options.env = { ...env, TREGU_AUTOMATION_URL: "https://www.383ks.com" };
  await runReprice(options);
  assert.equal(options.calls[0][0], "https://383ks.com/api/automation/tregu/reprice");
  assert.equal(options.calls[0][1].method, "POST");
  assert.equal(options.calls[0][1].redirect, "manual");
  await assert.rejects(runReprice(setup([reply(301)])), /HTTP 301/);
});
test("fails on partial provider errors, invalid JSON and exhausted retries", async () => {
  for (const response of [reply(200, { ok: true, outcome: "completed_with_market_errors" }), reply(200, { ok: false }), new Response("<html>proxy error</html>")]) {
    await assert.rejects(runReprice(setup([response])));
  }
  const options = setup([reply(503), reply(503)]);
  await assert.rejects(runReprice(options), /HTTP 503/);
  assert.equal(options.calls.length, 2);
});
test("verified no-evidence and already-processed scans succeed", async () => {
  for (const result of [{ ok: true, updates_applied: 0 }, { ok: true, skipped: true, reason: "already_processed" }]) {
    assert.deepEqual(await runReprice(setup([reply(200, result)])), result);
  }
});
