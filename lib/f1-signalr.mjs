/**
 * Formula 1's own live timing, read directly — no browser, no key.
 *
 * Why this exists. The race market used to read app.formula1dashboard.com by
 * launching a headless Chromium (@sparticuz/chromium). That worked on Vercel;
 * on Railway the bundled binary dies at launch ("libnspr4.so: cannot open
 * shared object file"), so from the move onwards every in-race refresh failed
 * and the Baku race of 2026-09-26 was never priced or settled. OpenF1, the other
 * source, answers 401 to anonymous callers for as long as a session is live.
 *
 * The dashboard was only ever a view of this: livetiming.formula1.com's
 * SignalR Core hub. Subscribing to a topic returns that topic's full current
 * state in the completion message, so one short request/response cycle gives
 * the whole running order — nothing has to stay connected between refreshes.
 *
 * Transport is long polling, not WebSockets, on purpose. The hub sits behind a
 * load balancer that needs its sticky-session cookie on every request after
 * negotiate (measured: a WebSocket without it is refused), and a standard
 * WebSocket cannot send a Cookie header. Long polling is plain fetch, so the
 * cookie goes on each request and it runs on any Node with fetch.
 *
 * Verified anonymous on 2026-09-26, after the Baku race: SessionInfo,
 * SessionStatus, LapCount, TimingData, TimingAppData, DriverList, TrackStatus,
 * WeatherData and RaceControlMessages all returned, in ~0.4s.
 */

const HUB = "https://livetiming.formula1.com/signalrcore";
const RS = "\u001e";

export const F1_LIVE_TIMING_SOURCE_URL = "https://livetiming.formula1.com/";

export const LIVE_TIMING_TOPICS = [
  "SessionInfo",
  "SessionStatus",
  "LapCount",
  "TimingData",
  "TimingAppData",
  "DriverList",
  "TrackStatus",
  "WeatherData",
  "RaceControlMessages",
];

function cookieFrom(response) {
  const all = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return all.map((c) => String(c).split(";")[0]).filter(Boolean).join("; ");
}

/**
 * One snapshot of every requested topic.
 *
 * @param {{ topics?: string[], fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<Record<string, any>>} topic name → full state
 */
export async function fetchF1LiveTimingState({ topics = LIVE_TIMING_TOPICS, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const signal = () => AbortSignal.timeout(Math.max(1000, deadline - Date.now()));

  const negotiate = await fetchImpl(`${HUB}/negotiate?negotiateVersion=1`, { method: "POST", signal: signal() });
  if (!negotiate.ok) throw new Error(`F1 live timing negotiate: HTTP ${negotiate.status}`);
  const cookie = cookieFrom(negotiate);
  const { connectionToken } = await negotiate.json();
  if (!connectionToken) throw new Error("F1 live timing negotiate returned no connection token");

  const url = `${HUB}?id=${encodeURIComponent(connectionToken)}`;
  const headers = { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "text/plain;charset=UTF-8" };
  const send = async (message) => {
    const r = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(message) + RS, signal: signal() });
    if (!r.ok) throw new Error(`F1 live timing send: HTTP ${r.status}`);
  };

  try {
    await send({ protocol: "json", version: 1 });
    await send({ type: 1, invocationId: "0", target: "Subscribe", arguments: [topics] });
    while (Date.now() < deadline) {
      const poll = await fetchImpl(url, { headers: cookie ? { Cookie: cookie } : {}, signal: signal() });
      if (!poll.ok) throw new Error(`F1 live timing poll: HTTP ${poll.status}`);
      const frames = (await poll.text()).split(RS).filter(Boolean).map((frame) => JSON.parse(frame));
      for (const frame of frames) {
        if (frame?.type === 7) throw new Error(`F1 live timing closed: ${frame.error ?? "no reason"}`);
        if (frame?.type === 3 && frame.invocationId === "0") {
          if (frame.error) throw new Error(`F1 live timing subscribe: ${frame.error}`);
          return frame.result ?? {};
        }
      }
    }
    throw new Error("F1 live timing: no snapshot before the deadline");
  } finally {
    // Best effort: an abandoned connection times out on F1's side anyway.
    fetchImpl(url, { method: "DELETE", headers: cookie ? { Cookie: cookie } : {} }).catch(() => {});
  }
}

const bool = (value) => value === true || value === "true";

/** "+0.196" → "+0.196", "22L" → "+22 LAPS", "" for the leader → "LEADER". */
export function normalizeGap(position, gapToLeader) {
  if (Number(position) === 1) return "LEADER";
  const raw = String(gapToLeader ?? "").trim().toUpperCase();
  const laps = raw.match(/^\+?(\d+)\s*L(?:AP)?S?$/);
  if (laps) return `+${laps[1]} ${laps[1] === "1" ? "LAP" : "LAPS"}`;
  if (/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return raw.startsWith("+") || raw.startsWith("-") ? raw : `+${raw}`;
  return "—";
}

/** "Started" / "Finished" / "Finalised" … from SessionStatus. */
function sessionStatus(state) {
  return String(state?.SessionStatus?.Status ?? state?.SessionInfo?.SessionStatus ?? "").trim();
}

/** True once F1 has declared the session over. */
export function liveTimingSessionOver(state) {
  return ["Finished", "Finalised", "Ends"].includes(sessionStatus(state));
}

/**
 * The shape the race-winner plan already consumes (the old dashboard parser's
 * output), so pricing, race memory and settlement are unchanged.
 */
export function liveTimingToLeaderboard(state, { now = new Date() } = {}) {
  const lines = state?.TimingData?.Lines ?? {};
  const drivers = state?.DriverList ?? {};
  const apps = state?.TimingAppData?.Lines ?? {};
  const rows = [];
  for (const [number, line] of Object.entries(lines)) {
    const position = Number(line?.Position);
    const code = String(drivers?.[number]?.Tla ?? "").toUpperCase();
    if (!Number.isInteger(position) || position < 1 || !/^[A-Z]{3}$/.test(code)) continue;
    const stints = Array.isArray(apps?.[number]?.Stints) ? apps[number].Stints : Object.values(apps?.[number]?.Stints ?? {});
    const stint = stints.at(-1) ?? null;
    const retired = bool(line.Retired) || bool(line.Stopped);
    rows.push({
      position,
      driver: String(drivers?.[number]?.FullName ?? code),
      driver_code: code,
      driver_number: Number(number),
      gap: normalizeGap(position, line.GapToLeader),
      interval: String(line?.IntervalToPositionAhead?.Value ?? "") || null,
      pits: Number(line.NumberOfPitStops) || 0,
      laps: Number.isInteger(Number(line.NumberOfLaps)) ? Number(line.NumberOfLaps) : null,
      in_pit: bool(line.InPit),
      last_lap: String(line?.LastLapTime?.Value ?? "") || null,
      tyre: stint?.Compound ? String(stint.Compound).toUpperCase() : null,
      stint: stints.length || null,
      tyre_age: Number.isFinite(Number(stint?.TotalLaps)) ? Number(stint.TotalLaps) : null,
      status: retired ? "RETIRED" : null,
    });
  }
  rows.sort((a, b) => a.position - b.position);

  const status = sessionStatus(state);
  const track = String(state?.TrackStatus?.Status ?? "");
  const info = state?.SessionInfo ?? {};
  const race = {
    status: liveTimingSessionOver(state) ? "FINISHED" : status === "Started" ? "LIVE" : "INACTIVE",
    current_lap: Number(state?.LapCount?.CurrentLap) || null,
    total_laps: Number(state?.LapCount?.TotalLaps) || null,
    // TrackStatus 4 = safety car, 6/7 = virtual safety car (deployed/ending).
    safety_car: ["4", "6", "7"].includes(track),
  };

  return {
    source_url: F1_LIVE_TIMING_SOURCE_URL,
    provider: "f1_live_timing",
    session_key: Number(info.Key) || null,
    session_name: info?.Meeting?.Name ?? null,
    session_kind: String(info.Type ?? "").toUpperCase() || null,
    weather: state?.WeatherData ? { rainfall: Number(state.WeatherData.Rainfall) || 0 } : null,
    rows,
    race,
    missing_inputs: [],
    provider_errors: [],
    fetched_at: now.toISOString(),
    state_key: JSON.stringify({ source: "f1_live_timing", session: info.Key ?? null, lap: race.current_lap, status, rows: rows.map((r) => [r.driver_code, r.position, r.gap, r.pits, r.in_pit, r.laps, r.tyre]) }),
  };
}

/**
 * The finished classification for one exact session, in the row shape the
 * settlement code already checks (position, driver_number, number_of_laps and
 * dnf/dns/dsq flags). Null unless F1 has declared the session over.
 */
export function liveTimingFinalClassification(state, { sessionKey } = {}) {
  const info = state?.SessionInfo ?? {};
  if (String(info.Type ?? "") !== "Race" || !liveTimingSessionOver(state)) return null;
  if (sessionKey && Number(info.Key) !== Number(sessionKey)) return null;
  const lines = state?.TimingData?.Lines ?? {};
  const rows = Object.entries(lines).map(([number, line]) => ({
    position: Number(line?.Position),
    driver_number: Number(number),
    number_of_laps: Number(line?.NumberOfLaps) || 0,
    dnf: bool(line?.Retired) || bool(line?.Stopped),
    dns: false,
    dsq: false,
    session_key: Number(info.Key) || null,
  })).filter((row) => Number.isInteger(row.position) && row.position > 0);
  return { session_key: Number(info.Key) || null, status: sessionStatus(state), rows };
}
