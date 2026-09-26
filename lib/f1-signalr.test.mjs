import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeGap,
  liveTimingToLeaderboard,
  liveTimingFinalClassification,
  liveTimingSessionOver,
  fetchF1LiveTimingState,
} from "./f1-signalr.mjs";
import { fetchF1FinalResult, fetchF1SessionEndedLive } from "./f1-result-recovery.mjs";

// The real post-race snapshot of the 2026 Azerbaijan GP (session 11377),
// trimmed to the fields the code reads.
const BAKU = JSON.parse(readFileSync(new URL("./fixtures/f1-live-timing-baku-2026-final.json", import.meta.url), "utf8"));

test("gaps normalise to the shapes the race model already parses", () => {
  assert.equal(normalizeGap(1, ""), "LEADER");
  assert.equal(normalizeGap(2, "+0.196"), "+0.196");
  assert.equal(normalizeGap(20, "22L"), "+22 LAPS");
  assert.equal(normalizeGap(20, "1L"), "+1 LAP");
  assert.equal(normalizeGap(5, ""), "—");
});

test("the Baku snapshot becomes a finished leaderboard with Russell first", () => {
  const lb = liveTimingToLeaderboard(BAKU);
  assert.equal(lb.race.status, "FINISHED");
  assert.equal(lb.race.current_lap, 51);
  assert.equal(lb.session_key, 11377);
  assert.equal(lb.session_kind, "RACE");
  assert.equal(lb.session_name, "Azerbaijan Grand Prix");
  assert.equal(lb.rows.length, 22);
  assert.deepEqual(lb.rows.slice(0, 3).map((r) => r.driver_code), ["RUS", "VER", "HAD"]);
  assert.equal(lb.rows[0].gap, "LEADER");
  const stroll = lb.rows.find((r) => r.driver_code === "STR");
  assert.equal(stroll.status, "RETIRED");
});

test("a running session reads as LIVE, with safety car from track status", () => {
  const running = { ...BAKU, SessionStatus: { Status: "Started" }, TrackStatus: { Status: "4" } };
  const lb = liveTimingToLeaderboard(running);
  assert.equal(lb.race.status, "LIVE");
  assert.equal(lb.race.safety_car, true);
  assert.equal(liveTimingSessionOver(running), false);
});

test("the final classification is only released for the exact session key", () => {
  assert.equal(liveTimingFinalClassification(BAKU, { sessionKey: 11377 }).rows.length, 22);
  assert.equal(liveTimingFinalClassification(BAKU, { sessionKey: 11376 }), null);
  const qualifying = { ...BAKU, SessionInfo: { ...BAKU.SessionInfo, Type: "Qualifying" } };
  assert.equal(liveTimingFinalClassification(qualifying, { sessionKey: 11377 }), null);
  const running = { ...BAKU, SessionStatus: { Status: "Started" } };
  assert.equal(liveTimingFinalClassification(running, { sessionKey: 11377 }), null);
});

// ── Settlement and freeze through the live-timing fallback ────────────────

const DRIVERS = Object.values(BAKU.DriverList).map((d) => ({ key: d.Tla, driver_number: Number(d.RacingNumber), label: d.FullName }));
const MARKET = {
  market_type: "f1_race_winner",
  live_event: { openf1_session_key: 11377, race_start: "2026-09-26T11:00:00+00:00" },
  sport_outcomes: DRIVERS,
};
const AFTER = new Date("2026-09-26T13:30:00Z");

function fakeFetch({ jolpicaWinner = null, jolpicaLaps = 51 } = {}) {
  return async (url) => {
    const u = String(url);
    if (u.startsWith("https://api.openf1.org")) return new Response(JSON.stringify({ detail: "Live F1 session in progress" }), { status: 401 });
    if (u === "https://api.jolpi.ca/ergast/f1/2026.json") {
      return Response.json({ MRData: { RaceTable: { Races: [{ round: "15", date: "2026-09-26" }] } } });
    }
    if (u === "https://api.jolpi.ca/ergast/f1/2026/15/results.json") {
      const races = jolpicaWinner ? [{ date: "2026-09-26", Results: [{ position: "1", number: String(jolpicaWinner), laps: String(jolpicaLaps) }] }] : [];
      return Response.json({ MRData: { RaceTable: { Races: races } } });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
}

test("OpenF1 401 → settles on F1 live timing once Jolpica agrees", async () => {
  const result = await fetchF1FinalResult(MARKET, { now: AFTER, fetchImpl: fakeFetch({ jolpicaWinner: 63 }), liveTiming: async () => BAKU });
  assert.equal(result.winner, "RUS");
  assert.equal(result.source_url, "https://livetiming.formula1.com/");
  assert.match(result.corroboration_url, /2026\/15\/results\.json$/);
});

test("OpenF1 401 and Jolpica not published yet → waits (no settlement)", async () => {
  const result = await fetchF1FinalResult(MARKET, { now: AFTER, fetchImpl: fakeFetch(), liveTiming: async () => BAKU });
  assert.equal(result, null);
});

test("a disagreeing second source blocks settlement even after the grace window", async () => {
  const late = new Date("2026-09-26T18:00:00Z");
  const result = await fetchF1FinalResult(MARKET, { now: late, fetchImpl: fakeFetch({ jolpicaWinner: 3 }), liveTiming: async () => BAKU });
  assert.equal(result, null);
});

test("after the grace window, silence from Jolpica settles on live timing alone", async () => {
  const late = new Date("2026-09-26T18:00:00Z");
  const result = await fetchF1FinalResult(MARKET, { now: late, fetchImpl: fakeFetch(), liveTiming: async () => BAKU });
  assert.equal(result.winner, "RUS");
  assert.equal(result.corroboration_url, null);
});

test("trading freezes on F1's Finalised status for the exact session only", async () => {
  assert.equal(await fetchF1SessionEndedLive(MARKET, { liveTiming: async () => BAKU }), true);
  const other = { ...MARKET, live_event: { ...MARKET.live_event, openf1_session_key: 11369 } };
  assert.equal(await fetchF1SessionEndedLive(other, { liveTiming: async () => BAKU }), false);
  const running = { ...BAKU, SessionStatus: { Status: "Started" } };
  assert.equal(await fetchF1SessionEndedLive(MARKET, { liveTiming: async () => running }), false);
});

test("the long-poll client returns the Subscribe completion and closes the connection", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(`${init.method ?? "GET"} ${String(url).replace(/\?.*/, "")}`);
    if (String(url).includes("/negotiate")) {
      return new Response(JSON.stringify({ connectionToken: "tok" }), { headers: { "set-cookie": "AWSALB=abc; Path=/" } });
    }
    if (init.method === "POST") {
      assert.equal(init.headers.Cookie, "AWSALB=abc");
      return new Response("");
    }
    if (init.method === "DELETE") return new Response("");
    return new Response(`{}\u001e${JSON.stringify({ type: 3, invocationId: "0", result: { SessionStatus: { Status: "Started" } } })}\u001e`);
  };
  const state = await fetchF1LiveTimingState({ fetchImpl });
  assert.equal(state.SessionStatus.Status, "Started");
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(calls.includes("DELETE https://livetiming.formula1.com/signalrcore"));
});
