import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLinkedLiveStats, liveStatsMetrics } from './fbk-livestats.mjs';
const recorded = JSON.parse(readFileSync(new URL('./fixtures/fbk-livestats-2221511.json', import.meta.url)));
const fixture = { provider: 'fbk', event_id: 'fixture', league: 'fbk.kosovo', home_team: 'Sigal Prishtina', away_team: 'Trepça', kickoff: '2022-12-11T16:00:00Z', home_score: 73, away_score: 54, source_url: 'https://www.basketbolli.com/Results?leagueId=150' };
// One hour after tip-off: the federation's own result cannot settle yet.
const soon = new Date('2022-12-11T17:00:00Z');
const observation = { matchId: '2221511', competitionName: recorded.competition_name, data: recorded.data, matches: recorded.matches };
test('recorded Supercup payload supplies actual stats but cannot resolve a Superliga fixture', () => {
  const stats = liveStatsMetrics(recorded.data.tm['1']);
  assert.equal(stats.points, 73);
  assert.ok(stats.assists >= 0);
  assert.ok(stats.field_goals_attempted >= stats.field_goals_made);
  const event = normalizeLinkedLiveStats(fixture, observation, soon);
  assert.equal(event.has_official_score, false);
  assert.equal(event.supplemental.fbk.reason, 'competition_mismatch');
});
test('matching completion requires agreement between federation and both LiveStats feeds', () => {
  // Contract replay: change only competition label to exercise the Superliga path.
  const replay = { ...observation, competitionName: 'ProCredit Superliga' };
  const event = normalizeLinkedLiveStats(fixture, replay, soon);
  assert.equal(event.status, 'STATUS_FINAL');
  assert.equal(event.metrics[fixture.home_team].points, 73);
  assert.equal(event.clock_seconds, 0);
  assert.equal(normalizeLinkedLiveStats({ ...fixture, home_score: null }, replay, soon).has_official_score, false);
  assert.equal(normalizeLinkedLiveStats({ ...fixture, kickoff: '2026-09-09T16:00:00Z' }, replay, soon).has_official_score, false);
  assert.equal(normalizeLinkedLiveStats({ ...fixture, home_team: 'Peja' }, replay, soon).has_official_score, false);
});
test('live clock needs a fresh source timestamp; a zero clock never declares completion', () => {
  const now = new Date('2022-12-11T17:00:00Z');
  const replay = { ...observation, competitionName: 'ProCredit Superliga', updatedAt: now.toISOString(),
    matches: recorded.matches.map(row => ({ ...row, matchStatus: 'IN_PROGRESS', live: 1 })) };
  assert.equal(normalizeLinkedLiveStats(fixture, replay, now).status, 'STATUS_IN_PROGRESS');
  assert.equal(normalizeLinkedLiveStats(fixture, { ...replay, updatedAt: null }, now).has_official_score, false);
  assert.equal(normalizeLinkedLiveStats(fixture, { ...replay, updatedAt: '2022-12-11T16:00:00Z' }, now).has_official_score, false);
});
test('federation final settles when LiveStats is unusable, never when LiveStats contradicts it', () => {
  const later = new Date('2022-12-12T00:00:00Z');
  const unusable = normalizeLinkedLiveStats(fixture, observation, later);
  assert.equal(unusable.status, 'STATUS_FINAL');
  assert.equal(unusable.competitors[0].score, 73);
  const replay = { ...observation, competitionName: 'ProCredit Superliga', matches: recorded.matches.map(row => ({ ...row, matchStatus: 'IN_PROGRESS', live: 0 })) };
  const agreeing = normalizeLinkedLiveStats(fixture, replay, later);
  assert.equal(agreeing.status, 'STATUS_FINAL');
  assert.equal(agreeing.metrics[fixture.home_team].points, 73);
  const contradicted = normalizeLinkedLiveStats({ ...fixture, home_score: 50 }, replay, later);
  assert.equal(contradicted.has_official_score, false);
  assert.equal(contradicted.supplemental.fbk.reason, 'federation_livestats_disagree');
});

// ── Discovery through the competition feed ───────────────────────────────
// Recorded 2026-09-26 during Trepça v Peja (game 2920347), trimmed: Q4 02:10,
// 71–77, plus the round's match list from competition 50054.
import { findLiveStatsMatch, fetchLinkedFbkLiveStats } from './fbk-livestats.mjs';
const round = JSON.parse(readFileSync(new URL('./fixtures/fbk-livestats-2920347-q4.json', import.meta.url)));
const trepcaPeja = { provider: 'fbk', event_id: 'fbk-150-e488e6e2496acba39729', league: 'fbk.kosovo', home_team: 'Trepça', away_team: 'Peja', kickoff: '2026-09-26T17:00:00.000Z', home_score: null, away_score: null, live_stats_url: null, source_url: 'https://www.basketbolli.com/Results?leagueId=150' };

test('a fixture is found in the competition feed by both teams and kickoff', () => {
  assert.equal(String(findLiveStatsMatch(trepcaPeja, round.matches)?.matchId), '2920347');
  assert.equal(findLiveStatsMatch({ ...trepcaPeja, home_team: 'Peja', away_team: 'Trepça' }, round.matches), null);
  assert.equal(findLiveStatsMatch({ ...trepcaPeja, kickoff: '2026-09-26T17:30:00.000Z' }, round.matches), null);
  const doubled = [...round.matches, { ...round.matches.find(r => String(r.matchId) === '2920347'), matchId: 1 }];
  assert.equal(findLiveStatsMatch(trepcaPeja, doubled), null);
});

function roundFetch({ dataStatus = 200 } = {}) {
  const updated = new Date('2026-09-26T18:47:30Z').toUTCString();
  return async (url) => {
    const u = String(url);
    if (u.endsWith('/data/competition/50054.json')) return Response.json(round.matches);
    if (u.endsWith('/u/KOS/2920347/')) return new Response(round.page);
    if (u.endsWith('/data/2920347/data.json')) {
      return dataStatus === 200
        ? new Response(JSON.stringify(round.data), { headers: { 'last-modified': updated } })
        : new Response('Forbidden', { status: dataStatus });
    }
    throw new Error(`unexpected ${u}`);
  };
}

test('a fixture with no federation link is priced live from the discovered game', async () => {
  const event = await fetchLinkedFbkLiveStats(trepcaPeja, { now: new Date('2026-09-26T18:48:00Z'), fetchImpl: roundFetch() });
  assert.equal(event.status, 'STATUS_IN_PROGRESS');
  assert.equal(event.has_official_score, true);
  assert.deepEqual(event.competitors.map(c => [c.team, c.score]), [['Trepça', 71], ['Peja', 77]]);
  assert.equal(event.supplemental.fbk.match_id, '2920347');
});

test('a game that has not tipped off (data.json 403) stays scheduled, without an error', async () => {
  const event = await fetchLinkedFbkLiveStats(trepcaPeja, { now: new Date('2026-09-26T16:30:00Z'), fetchImpl: roundFetch({ dataStatus: 403 }) });
  assert.equal(event.status, 'STATUS_SCHEDULED');
  assert.equal(event.has_official_score, false);
});
