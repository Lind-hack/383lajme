import { test } from "node:test";
import assert from "node:assert/strict";
import { requestDailyCodex } from "./tregu-daily-codex.mjs";

const options = { prompt: "verified evidence", key: "markets", maximum: 6, timeoutMs: 1000 };
test("malformed daily contract is regenerated, never silently repaired", () => {
  const calls = [];
  const result = requestDailyCodex({ ...options, execute: prompt => {
    calls.push(prompt);
    return calls.length === 1 ? '{"markets":[{"question":"bad"}]}]}' : '{"markets":[{"question":"valid"}]}';
  } });
  assert.deepEqual(result, [{ question: "valid" }]);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /invalid_json/);
});
test("provider exit and invalid shape retry; valid empty output stays empty", () => {
  let count = 0;
  assert.deepEqual(requestDailyCodex({ ...options, execute: () => {
    count++;
    if (count === 1) throw new Error("private prompt");
    return count === 2 ? '{"markets":[null]}' : '{"markets":[]}';
  } }), []);
  assert.equal(count, 3);
});
test("persistent invalid output is bounded and does not leak content", () => {
  let count = 0;
  assert.throws(() => requestDailyCodex({ ...options, execute: () => { count++; return "private article text"; } }), /bounded retries \(invalid_json\)/);
  assert.equal(count, 3);
});
test("retries share the original deadline and stop on timeout", () => {
  let clock = 0;
  const budgets = [];
  assert.throws(() => requestDailyCodex({ ...options, now: () => clock, execute: (_, budget) => {
    budgets.push(budget);
    clock += 600;
    return "bad";
  } }), /bounded retries/);
  assert.deepEqual(budgets, [1000, 400]);
  let calls = 0;
  assert.throws(() => requestDailyCodex({ ...options, execute: () => {
    calls++;
    throw Object.assign(new Error("private"), { code: "ETIMEDOUT" });
  } }), /provider_request/);
  assert.equal(calls, 1);
});
