import { test } from "node:test";
import assert from "node:assert/strict";
import { heartbeatIsStale, backupEnabled, backupTick, BACKUP_STALE_AFTER_MS } from "./tregu-heartbeat-backup.mjs";

const now = Date.parse("2026-11-01T14:00:00Z");
const ago = (ms) => new Date(now - ms).toISOString();

test("a heartbeat inside the VPS's two-minute rhythm is healthy; a quiet one is stale", () => {
  assert.equal(heartbeatIsStale(ago(119_000), now), false);
  assert.equal(heartbeatIsStale(ago(BACKUP_STALE_AFTER_MS + 1), now), true);
  assert.equal(heartbeatIsStale(ago(2 * 86400_000), now), true);
  assert.equal(heartbeatIsStale(null, now), true);
  assert.equal(heartbeatIsStale("not a date", now), true);
});

test("only the production server runs the backup unless told otherwise", () => {
  assert.equal(backupEnabled({ RAILWAY_ENVIRONMENT_NAME: "production", NODE_ENV: "production" }), true);
  assert.equal(backupEnabled({ RAILWAY_ENVIRONMENT_NAME: "oracle-preview", NODE_ENV: "production" }), false);
  assert.equal(backupEnabled({ NODE_ENV: "development" }), false);
  assert.equal(backupEnabled({ RAILWAY_ENVIRONMENT_NAME: "production", NODE_ENV: "production", TREGU_HEARTBEAT_BACKUP: "0" }), false);
  assert.equal(backupEnabled({ RAILWAY_ENVIRONMENT_NAME: "production", NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }), false);
  assert.equal(backupEnabled({ TREGU_HEARTBEAT_BACKUP: "1" }), true);
});

test("the backup stays out of the way while the VPS is calling", async () => {
  let runs = 0;
  const result = await backupTick({ lastRunAt: async () => ago(60_000), run: async () => { runs++; }, now: () => now });
  assert.equal(result, "healthy");
  assert.equal(runs, 0);
});

test("the backup runs the heartbeat when the VPS has gone quiet, and never twice at once", async () => {
  const state = {};
  let release;
  let runs = 0;
  const run = () => { runs++; return new Promise((resolve) => { release = resolve; }); };
  const first = backupTick({ state, lastRunAt: async () => ago(48 * 3600_000), run, now: () => now });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await backupTick({ state, lastRunAt: async () => null, run, now: () => now }), "busy");
  release();
  assert.equal(await first, "ran");
  assert.equal(runs, 1);
});

test("a failed backup run is reported, not thrown, so the loop keeps going", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const state = {};
    assert.equal(await backupTick({ state, lastRunAt: async () => null, run: async () => { throw new Error("ESPN down"); }, now: () => now }), "failed");
    assert.equal(state.running, false);
  } finally {
    console.error = original;
  }
});
