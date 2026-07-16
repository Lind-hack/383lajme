import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArgentinaEnglandSubmission,
  buildArgentinaEnglandDraftFromRuntimeSources,
  extractVerifiedFullTimeThreeWayOdds,
  fetchArgentinaEnglandRuntimeSources,
} from "./tregu-argentina-england-cli.mjs";

const event = {
  provider: "espn",
  event_id: "760515",
  league: "fifa.world",
  date: "2026-07-15T19:00:00.000Z",
  competitors: [{ team: "England" }, { team: "Argentina" }],
  source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760515",
};

const fullTime1x2 = {
  event: "England v Argentina",
  marketName: "Full Time Result (90 Minutes)",
  outcomes: [
    { label: "England", decimalOdds: 2.5 },
    { label: "Draw", decimalOdds: 3.2 },
    { label: "Argentina", decimalOdds: 3.0 },
  ],
};

test("Argentina–England CLI builder defaults to a no-write preflight and only --apply opts in", () => {
  const draft = { question: "England–Argentina: rezultati pas 90 minutash?" };
  assert.deepEqual(buildArgentinaEnglandSubmission({ args: [], draft }), { apply: false, body: { draft, dryRun: true } });
  assert.deepEqual(buildArgentinaEnglandSubmission({ args: ["--apply"], draft }), { apply: false, body: { draft, dryRun: true } });
  assert.deepEqual(buildArgentinaEnglandSubmission({ args: ["--apply", "--open"], draft }), { apply: true, body: { draft, dryRun: false, open: true } });
});

test("authorized open submission is a generic ESPN-mapped market with transparent model-reference probabilities when no bookmaker 1X2 is available", () => {
  const draft = buildArgentinaEnglandDraftFromRuntimeSources({
    event,
    schedule: { source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260715" },
    draftKings: null,
    modelReference: {
      provider: "Groq",
      model: "llama-3.3-70b-versatile",
      probabilities: { england: 0.31, draw: 0.29, argentina: 0.40 },
      cited_sources: [{ source: "FIFA", title: "Official tournament preview", url: "https://www.fifa.com/example" }],
    },
    espnFetchedAt: "2026-07-14T10:00:01.000Z",
    now: new Date("2026-07-14T10:00:02.000Z"),
  });

  assert.equal(draft.status, "open");
  assert.deepEqual(draft.sport_outcomes.map((outcome) => outcome.key), ["england", "draw", "argentina"]);
  assert.equal(draft.live_event.event_id, "760515");
  assert.equal(draft.live_event.kickoff, "2026-07-15T19:00:00.000Z");
  assert.equal(draft.closes_at > draft.live_event.kickoff, true);
  assert.equal(draft.pre_match_analysis.reference_kind, "groq_pre_match_reference_model");
  assert.equal(draft.pre_match_analysis.bookmaker_odds_available, false);
  assert.equal(JSON.stringify(draft.pre_match_analysis).toLowerCase().includes("draftkings"), false);
});

test("opening prices require an explicit DraftKings full-time 1X2 market with all three prices", () => {
  const odds = extractVerifiedFullTimeThreeWayOdds(fullTime1x2);
  assert.equal(odds.market_name, "Full Time Result (90 Minutes)");
  assert.equal(odds.probabilities.england > 0, true);
  assert.equal(odds.probabilities.draw > 0, true);
  assert.equal(odds.probabilities.argentina > 0, true);
  assert.ok(Math.abs(odds.probabilities.england + odds.probabilities.draw + odds.probabilities.argentina - 1) < 1e-12);
  assert.throws(() => extractVerifiedFullTimeThreeWayOdds({ ...fullTime1x2, marketName: "Match Winner (including extra time and penalties)" }), /full-time 1X2/i);
  assert.throws(() => extractVerifiedFullTimeThreeWayOdds({ ...fullTime1x2, outcomes: fullTime1x2.outcomes.filter((outcome) => outcome.label !== "Draw") }), /draw price/i);
});

test("runtime sources retain ESPN schedule/score and DraftKings URLs with fetch timestamps without unsupported analysis claims", () => {
  const draft = buildArgentinaEnglandDraftFromRuntimeSources({
    event,
    schedule: { source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260715" },
    draftKings: { source_url: "https://sportsbook.draftkings.com/leagues/soccer", fetched_at: "2026-07-14T10:00:00.000Z", data: fullTime1x2 },
    espnFetchedAt: "2026-07-14T10:00:01.000Z",
    now: new Date("2026-07-14T10:00:02.000Z"),
  });

  assert.equal(draft.status, "open");
  assert.equal(draft.market_type, "three_outcome");
  assert.deepEqual(draft.analysis.claims, []);
  assert.deepEqual(Object.keys(draft.pre_match_analysis.opening_probabilities).sort(), ["argentina", "draw", "england"]);
  assert.equal(draft.pre_match_analysis.sources.some((source) => source.kind === "espn_schedule_score"), true);
  assert.equal(draft.pre_match_analysis.sources.some((source) => source.kind === "draftkings_full_time_1x2"), true);
  assert.equal(draft.pre_match_analysis.sources.every((source) => source.url && source.fetched_at), true);
});

test("runtime draft refuses to create when DraftKings offers match winner without a verified draw", () => {
  assert.throws(() => buildArgentinaEnglandDraftFromRuntimeSources({
    event,
    schedule: { source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260715" },
    draftKings: { source_url: "https://sportsbook.draftkings.com/leagues/soccer", fetched_at: "2026-07-14T10:00:00.000Z", data: { ...fullTime1x2, marketName: "Match Winner", outcomes: fullTime1x2.outcomes.filter((outcome) => outcome.label !== "Draw") } },
    espnFetchedAt: "2026-07-14T10:00:01.000Z",
    now: new Date("2026-07-14T10:00:02.000Z"),
  }), /draw price|full-time 1X2/i);
});

test("runtime preflight fails closed when neither a sportsbook nor Groq model key is available", async () => {
  const response = (ok, body) => ({ ok, status: ok ? 200 : 403, json: async () => body, text: async () => JSON.stringify(body) });
  await assert.rejects(
    fetchArgentinaEnglandRuntimeSources({
      fetchImpl: async (url) => url.includes("draftkings") ? response(false, {}) : response(true, {}),
      now: new Date("2026-07-14T10:00:00.000Z"),
    }),
    /GROQ_API_KEY/,
  );
});
