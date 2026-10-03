import test from "node:test";
import assert from "node:assert/strict";
import { fetchOpenF1Roster } from "./f1-upcoming-race.mjs";

const driver = (n, session) => ({ session_key: session, driver_number: n, name_acronym: `D${String.fromCharCode(64 + n)}X`, full_name: `Driver ${n}`, team_name: "Team", team_colour: "FFFFFF" });
const reply = (status, body) => ({ ok: status === 200, status, json: async () => body });

test("a race with no driver rows yet takes the field from the weekend's latest session", async () => {
  // OpenF1 answered 404 for the 2026 Malaysia race the day before it ran, so no
  // market was created; practice and qualifying already listed all 22 drivers.
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("session_key=11731")) return reply(404, { detail: "No results found." });
    if (url.includes("meeting_key=1308")) return reply(200, [
      ...Array.from({ length: 21 }, (_, i) => driver(i + 1, 11727)),
      ...Array.from({ length: 22 }, (_, i) => driver(i + 1, 11730)),
    ]);
    throw new Error(`unexpected ${url}`);
  };
  const roster = await fetchOpenF1Roster({ sessionKey: 11731, meetingKey: 1308, fetchImpl });
  assert.equal(roster.length, 22);
  assert.ok(calls.some((url) => url.includes("drivers?meeting_key=1308")));
});

test("without a meeting key a missing race roster still fails loudly", async () => {
  const fetchImpl = async () => reply(404, {});
  await assert.rejects(fetchOpenF1Roster({ sessionKey: 11731, fetchImpl }), /404/);
});

test("a race that already lists its drivers is read as before", async () => {
  const fetchImpl = async (url) => {
    assert.ok(url.includes("session_key=11388"));
    return reply(200, Array.from({ length: 22 }, (_, i) => driver(i + 1, 11388)));
  };
  assert.equal((await fetchOpenF1Roster({ sessionKey: 11388, meetingKey: 1296, fetchImpl })).length, 22);
});
