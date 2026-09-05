/**
 * Formula 1's own live-timing archive. Free, unauthenticated, official.
 *
 * OpenF1 answers 401 to anonymous callers for the whole duration of a session —
 * every endpoint, including historical ones — which is exactly the window the
 * F1 markets exist for. Paying for it is one answer; this is the other. F1
 * publishes the same underlying data itself at livetiming.formula1.com with no
 * key at all.
 *
 * Two things it gives us that OpenF1 does not:
 *
 *   The season index carries every session's start and end time, so "when does
 *   qualifying run and when is it done" is a fact we read rather than infer.
 *
 *   A session's Path is null until that session is over and its archive is
 *   published. That is a far better "results are ready" signal than watching a
 *   clock, because it means the files are actually there — a session that
 *   overruns, is red-flagged or is abandoned resolves correctly on its own.
 *
 * What it does not give us is live position during a running session: those
 * files 403 until the session ends, because live data goes over SignalR. That
 * is deliberate here. In-race pricing keeps its existing source, and this
 * module covers the schedule, the roster and everything after a session ends —
 * which is where qualifying, the grid, and practice pace live.
 */

const BASE = "https://livetiming.formula1.com/static";

/** F1 serves these with a UTF-8 BOM, which JSON.parse will not accept. */
function parseBom(text) {
  return JSON.parse(String(text ?? "").replace(/^﻿/, ""));
}

/**
 * F1 publishes wall-clock time at the circuit plus a separate GmtOffset, and a
 * bare "2026-09-05T16:00:00" is parsed in whatever timezone the process runs
 * in. That silently disagrees between a Vercel function on UTC and the VPS, so
 * every time this module hands out is converted to a real instant here.
 */
export function toUtcIso(local, gmtOffset) {
  if (!local) return null;
  const match = /^([+-]?)(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(gmtOffset ?? ""));
  const asUtc = Date.parse(`${local}Z`);
  if (!match || !Number.isFinite(asUtc)) return Number.isFinite(asUtc) ? new Date(asUtc).toISOString() : null;
  const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0);
  // A circuit at GMT+2 showing 16:00 is 14:00 UTC, so a positive offset subtracts.
  return new Date(asUtc + (match[1] === "-" ? seconds : -seconds) * 1000).toISOString();
}

async function getJson(url, fetchImpl, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return parseBom(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every session of the season with its window, newest meeting last.
 *
 * `finished` is taken from the presence of a published archive rather than from
 * the clock: the data being there is the thing we actually care about.
 */
export async function fetchF1Schedule({ year = new Date().getUTCFullYear(), fetchImpl = fetch } = {}) {
  const index = await getJson(`${BASE}/${year}/Index.json`, fetchImpl);
  const meetings = Array.isArray(index?.Meetings) ? index.Meetings : [];
  const sessions = [];
  for (const meeting of meetings) {
    for (const session of meeting.Sessions ?? []) {
      const path = session.Path ?? null;
      const gmtOffset = session.GmtOffset ?? meeting.GmtOffset ?? null;
      sessions.push({
        meeting_key: meeting.Key ?? null,
        meeting_name: meeting.Name ?? null,
        location: meeting.Location ?? null,
        country: meeting.Country?.Name ?? null,
        circuit: meeting.Circuit?.ShortName ?? null,
        session_key: session.Key ?? null,
        name: session.Name ?? null,
        type: session.Type ?? null,
        start: toUtcIso(session.StartDate, gmtOffset),
        end: toUtcIso(session.EndDate, gmtOffset),
        local_start: session.StartDate ?? null,
        local_end: session.EndDate ?? null,
        gmt_offset: gmtOffset,
        path,
        // Published archive means the session is over and its data is readable.
        finished: Boolean(path),
      });
    }
  }
  return sessions;
}

/** The sessions of the meeting a given race belongs to. */
export function sessionsForMeeting(schedule, meetingKey) {
  return (schedule ?? []).filter((session) => String(session.meeting_key) === String(meetingKey));
}

/**
 * The most recently finished session of a kind ("Qualifying", "Practice",
 * "Race"), optionally within one meeting.
 */
export function latestFinished(schedule, type, { meetingKey = null } = {}) {
  return (schedule ?? [])
    .filter((session) => session.finished && (!type || String(session.type ?? "") === type))
    .filter((session) => meetingKey === null || String(session.meeting_key) === String(meetingKey))
    .sort((a, b) => Date.parse(a.end ?? 0) - Date.parse(b.end ?? 0))
    .at(-1) ?? null;
}

/** Where the weekend has got to, for a run report or an email. */
export function weekendPhase(sessions, now = new Date()) {
  const upcoming = (sessions ?? [])
    .filter((session) => Date.parse(session.start ?? 0) > now.getTime())
    .sort((a, b) => Date.parse(a.start ?? 0) - Date.parse(b.start ?? 0))[0] ?? null;
  const running = (sessions ?? []).find(
    (session) =>
      Date.parse(session.start ?? 0) <= now.getTime() && now.getTime() <= Date.parse(session.end ?? 0)
  ) ?? null;
  return {
    running: running ? { name: running.name, type: running.type, end: running.end } : null,
    next: upcoming ? { name: upcoming.name, type: upcoming.type, start: upcoming.start } : null,
    qualifying: (sessions ?? []).find((session) => String(session.type ?? "") === "Qualifying") ?? null,
  };
}

/**
 * The official roster for a finished session: three-letter code, full name,
 * constructor, constructor colour and portrait — all from F1 itself, which
 * beats a hand-maintained map that goes stale on a mid-season seat change.
 */
export async function fetchSessionDrivers(path, { fetchImpl = fetch } = {}) {
  if (!path) return [];
  const list = await getJson(`${BASE}/${String(path).replace(/\/$/, "")}/DriverList.json`, fetchImpl);
  if (!list || typeof list !== "object") return [];
  return Object.values(list)
    .filter((driver) => driver && driver.Tla)
    .map((driver) => ({
      key: String(driver.Tla).toUpperCase(),
      driver_number: Number(driver.RacingNumber),
      label: String(driver.FullName ?? driver.BroadcastName ?? driver.Tla),
      team: String(driver.TeamName ?? ""),
      team_colour: driver.TeamColour ? `#${String(driver.TeamColour).replace(/^#/, "")}` : null,
      headshot_url: driver.HeadshotUrl ?? null,
    }))
    .sort((a, b) => a.driver_number - b.driver_number);
}

/**
 * Qualifying order from Jolpica, the community-run continuation of Ergast.
 *
 * A fallback for the window where OpenF1 refuses us. It is not live — Jolpica
 * publishes once results are official — which is exactly right for this use:
 * qualifying only matters to a price once it has finished, and "official" is a
 * better trigger than "the clock says it should be over".
 *
 * Returns { CODE: gridPosition }, the shape the opening model already takes,
 * and an empty object on any failure so the caller keeps whatever it had.
 */
export async function fetchJolpicaQualifying({ year = new Date().getUTCFullYear(), round = "last", fetchImpl = fetch } = {}) {
  const url = `https://api.jolpi.ca/ergast/f1/${year}/${round}/qualifying/?format=json`;
  const data = await getJson(url, fetchImpl);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  const rows = Array.isArray(race?.QualifyingResults) ? race.QualifyingResults : [];
  const positions = {};
  for (const row of rows) {
    const code = String(row?.Driver?.code ?? "").toUpperCase();
    const position = Number(row?.position);
    if (code && Number.isInteger(position) && position > 0) positions[code] = position;
  }
  // The caller must check this date against the race it is pricing. Jolpica's
  // "last" is the last race with official results, which during a race weekend
  // is the PREVIOUS round — using it blind would price Monza off Zandvoort's
  // grid.
  return { positions, date: race?.date ?? null, race_name: race?.raceName ?? null, round: race?.round ?? null, season: race?.season ?? null };
}
