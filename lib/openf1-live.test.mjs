import assert from "node:assert/strict";
import test from "node:test";
import { fetchOpenF1LiveRace } from "./openf1-live.mjs";
const now = new Date("2026-09-06T14:00:00Z");
function provider(failures = {}) {
  return async url => {
    const name = new URL(url).pathname.split("/").at(-1);
    if (failures[name]) return { ok: false, status: failures[name] };
    const payload = {
      sessions: [{ session_key: 123, session_type: "Race", date_start: "2026-09-06T13:00:00Z", date_end: "2026-09-06T15:00:00Z" }],
      drivers: Array.from({ length: 22 }, (_, index) => ({ driver_number: index + 1, name_acronym: `D${index}`, full_name: `Driver ${index}` })),
      position: Array.from({ length: 22 }, (_, index) => ({ driver_number: index + 1, position: index + 1, date: now.toISOString() })),
      intervals: [], stints: [], laps: [], weather: [], race_control: [], pit: [],
    }[name];
    return { ok: true, json: async () => payload };
  };
}
test("optional pit/lap/weather failure preserves timing and exposes unavailable inputs", async () => {
  const result = await fetchOpenF1LiveRace({ now, fetchImpl: provider({ pit: 503, laps: 429, weather: 503 }), requestGapMs: 0 });
  assert.equal(result.rows.length, 22);
  assert.equal(result.rows[0].pits, null);
  assert.equal(result.rows[0].recent_pace, null);
  assert.equal(result.lap, null);
  assert.equal(result.weather, null);
  assert.equal(result.provider_errors.length, 3);
  assert.ok(result.missing_inputs.includes("pit"));
});
test("missing mandatory position feed rejects timing instead of manufacturing a leaderboard", async () => {
  await assert.rejects(fetchOpenF1LiveRace({ now, fetchImpl: provider({ position: 503 }), requestGapMs: 0 }), /position.*503/);
});
test("verified empty pit history is distinct from unavailable pit history", async () => {
  const result = await fetchOpenF1LiveRace({ now, fetchImpl: provider(), requestGapMs: 0 });
  assert.equal(result.rows[0].pits, 0);
  assert.equal(result.provider_errors.length, 0);
});
