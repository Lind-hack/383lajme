import test from "node:test";
import assert from "node:assert/strict";

import { buildFreeChampionshipContext, fetchF1Schedule, fetchSessionDrivers, latestFinished, sessionsForMeeting, weekendPhase } from "./f1-livetiming.mjs";

// F1 serves these with a UTF-8 BOM; the fixtures carry one so the parser is
// actually exercised rather than assumed.
const bom = (value) => "﻿" + JSON.stringify(value);
const ok = (value) => async () => ({ ok: true, text: async () => bom(value) });

const INDEX = {
  Year: 2026,
  Meetings: [
    {
      Key: 1293,
      Name: "Italian Grand Prix",
      Location: "Monza",
      Country: { Name: "Italy" },
      Circuit: { ShortName: "Monza" },
      GmtOffset: "02:00:00",
      Sessions: [
        { Key: 1, Name: "Practice 1", Type: "Practice", StartDate: "2026-09-04T12:30:00", EndDate: "2026-09-04T13:30:00", Path: "2026/x/fp1/" },
        { Key: 2, Name: "Practice 3", Type: "Practice", StartDate: "2026-09-05T12:30:00", EndDate: "2026-09-05T13:30:00", Path: null },
        { Key: 3, Name: "Qualifying", Type: "Qualifying", StartDate: "2026-09-05T16:00:00", EndDate: "2026-09-05T17:00:00", Path: null },
      ],
    },
  ],
};

test("the schedule carries each session's window", async () => {
  const schedule = await fetchF1Schedule({ year: 2026, fetchImpl: ok(INDEX) });
  assert.equal(schedule.length, 3);
  const qualifying = schedule.find((session) => session.type === "Qualifying");
  assert.equal(qualifying.start, "2026-09-05T14:00:00.000Z", "16:00 at a GMT+2 circuit is 14:00 UTC");
  assert.equal(qualifying.end, "2026-09-05T15:00:00.000Z");
  assert.equal(qualifying.local_start, "2026-09-05T16:00:00", "the circuit wall clock is kept for display");
  assert.equal(qualifying.location, "Monza");
});

test("a published archive is what makes a session finished, not the clock", async () => {
  const schedule = await fetchF1Schedule({ year: 2026, fetchImpl: ok(INDEX) });
  assert.equal(schedule.find((s) => s.name === "Practice 1").finished, true);
  assert.equal(schedule.find((s) => s.name === "Practice 3").finished, false);
  assert.equal(schedule.find((s) => s.type === "Qualifying").finished, false);
  assert.equal(latestFinished(schedule, "Practice").path, "2026/x/fp1/");
  assert.equal(latestFinished(schedule, "Qualifying"), null);
});

test("the phase names what is running and what is next", async () => {
  const schedule = await fetchF1Schedule({ year: 2026, fetchImpl: ok(INDEX) });
  // P3 is 12:30 local at a GMT+2 circuit, so 11:00Z is mid-session.
  const during = weekendPhase(schedule, new Date("2026-09-05T11:00:00Z"));
  assert.equal(during.running.name, "Practice 3");
  assert.equal(during.next.name, "Qualifying");

  const after = weekendPhase(schedule, new Date("2026-09-05T18:00:00Z")); // past the race
  assert.equal(after.running, null);
  assert.equal(after.next, null);
});

test("the roster comes back with codes, colours and portraits", async () => {
  const drivers = await fetchSessionDrivers("2026/x/fp1/", {
    fetchImpl: ok({
      "4": { RacingNumber: "4", Tla: "NOR", FullName: "Lando NORRIS", TeamName: "McLaren", TeamColour: "F47600", HeadshotUrl: "https://media.formula1.com/nor.png" },
      "1": { RacingNumber: "1", Tla: "VER", FullName: "Max VERSTAPPEN", TeamName: "Red Bull Racing", TeamColour: "4781D7", HeadshotUrl: null },
      bad: { RacingNumber: "99" },
    }),
  });
  assert.equal(drivers.length, 2, "a row without a code is not a driver");
  assert.deepEqual(drivers.map((d) => d.key), ["VER", "NOR"], "sorted by racing number");
  const norris = drivers.find((d) => d.key === "NOR");
  assert.equal(norris.team_colour, "#F47600", "colour is normalised to a hex string");
  assert.match(norris.headshot_url, /media\.formula1\.com/);
});

test("an outage returns nothing rather than throwing into the run", async () => {
  assert.deepEqual(await fetchF1Schedule({ fetchImpl: async () => ({ ok: false, text: async () => "" }) }), []);
  assert.deepEqual(await fetchSessionDrivers("2026/x/fp1/", { fetchImpl: async () => { throw new Error("net"); } }), []);
  assert.deepEqual(await fetchSessionDrivers(null), []);
  assert.deepEqual(sessionsForMeeting(null, 1), []);
});

test("the remaining calendar comes from Jolpica, not from F1's index", async () => {
  // The regression this guards: F1's index only lists meetings up to the
  // current one, so deriving "remaining" from it left one race in the season and
  // handed the points leader a certain title eleven rounds early.
  const routes = {
    "Index.json": {
      Year: 2026,
      Meetings: [{
        Key: 1, Name: "Italian Grand Prix", Location: "Monza", GmtOffset: "02:00:00",
        Sessions: [
          { Key: 9, Name: "Practice 1", Type: "Practice", StartDate: "2026-09-04T12:30:00", EndDate: "2026-09-04T13:30:00", Path: "p/fp1/" },
          { Key: 10, Name: "Race", Type: "Race", StartDate: "2026-09-06T15:00:00", EndDate: "2026-09-06T17:00:00", Path: null },
        ],
      }],
    },
    "DriverList.json": {
      "12": { RacingNumber: "12", Tla: "ANT", FullName: "Kimi ANTONELLI", TeamName: "Mercedes", TeamColour: "00D7B6" },
      "4": { RacingNumber: "4", Tla: "NOR", FullName: "Lando NORRIS", TeamName: "McLaren", TeamColour: "F47600" },
    },
    driverstandings: { MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: [
      { position: "1", points: "242", Driver: { code: "ANT" }, Constructors: [{ name: "Mercedes" }] },
      { position: "2", points: "159", Driver: { code: "NOR" }, Constructors: [{ name: "McLaren" }] },
    ] }] } } },
    constructorstandings: { MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [
      { position: "1", points: "425", Constructor: { name: "Mercedes" } },
    ] }] } } },
    "races/": { MRData: { RaceTable: { Races: [
      { round: "13", raceName: "Italian Grand Prix", date: "2999-09-06", Circuit: { circuitName: "Monza" } },
      { round: "14", raceName: "Spanish Grand Prix", date: "2999-09-13", Circuit: { circuitName: "Barcelona" }, Sprint: { date: "2999-09-12" } },
    ] } } },
  };
  const fetchImpl = async (url) => {
    const key = Object.keys(routes).find((route) => String(url).includes(route));
    return { ok: Boolean(key), text: async () => "﻿" + JSON.stringify(routes[key] ?? {}) };
  };

  const context = await buildFreeChampionshipContext({ year: 2026, fetchImpl });
  assert.equal(context.standings.length, 2);
  assert.equal(context.standings[0].points_current, 242);
  // Two races plus one sprint, all from the calendar — not the single race the
  // F1 index knows about.
  assert.equal(context.remainingEvents.length, 3);
  assert.equal(context.remainingEvents.filter((event) => event.sprint).length, 1);
  assert.equal(context.source, "jolpica+livetiming");
});
