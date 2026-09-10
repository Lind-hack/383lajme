import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLinkedLiveStats, liveStatsMetrics } from './fbk-livestats.mjs';
const recorded = JSON.parse(readFileSync(new URL('./fixtures/fbk-livestats-2221511.json', import.meta.url)));
const fixture = { provider: 'fbk', event_id: 'fixture', league: 'fbk.kosovo', home_team: 'Sigal Prishtina', away_team: 'Trepça', kickoff: '2022-12-11T16:00:00Z', home_score: 73, away_score: 54, source_url: 'https://www.basketbolli.com/Results?leagueId=150' };
const observation = { matchId: '2221511', competitionName: recorded.competition_name, data: recorded.data, matches: recorded.matches };
test('recorded Supercup payload supplies actual stats but cannot resolve a Superliga fixture', () => {
  const stats = liveStatsMetrics(recorded.data.tm['1']);
  assert.equal(stats.points, 73);
  assert.ok(stats.assists >= 0);
  assert.ok(stats.field_goals_attempted >= stats.field_goals_made);
  const event = normalizeLinkedLiveStats(fixture, observation);
  assert.equal(event.has_official_score, false);
  assert.equal(event.supplemental.fbk.reason, 'competition_mismatch');
});
test('matching completion requires agreement between federation and both LiveStats feeds', () => {
  // Contract replay: change only competition label to exercise the Superliga path.
  const replay = { ...observation, competitionName: 'ProCredit Superliga' };
  const event = normalizeLinkedLiveStats(fixture, replay);
  assert.equal(event.status, 'STATUS_FINAL');
  assert.equal(event.metrics[fixture.home_team].points, 73);
  assert.equal(event.clock_seconds, 0);
  assert.equal(normalizeLinkedLiveStats({ ...fixture, home_score: null }, replay).has_official_score, false);
  assert.equal(normalizeLinkedLiveStats({ ...fixture, kickoff: '2026-09-09T16:00:00Z' }, replay).has_official_score, false);
  assert.equal(normalizeLinkedLiveStats({ ...fixture, home_team: 'Peja' }, replay).has_official_score, false);
});
test('live clock needs a fresh source timestamp; a zero clock never declares completion', () => {
  const now = new Date('2022-12-11T17:00:00Z');
  const replay = { ...observation, competitionName: 'ProCredit Superliga', updatedAt: now.toISOString(),
    matches: recorded.matches.map(row => ({ ...row, matchStatus: 'IN_PROGRESS', live: 1 })) };
  assert.equal(normalizeLinkedLiveStats(fixture, replay, now).status, 'STATUS_IN_PROGRESS');
  assert.equal(normalizeLinkedLiveStats(fixture, { ...replay, updatedAt: null }, now).has_official_score, false);
  assert.equal(normalizeLinkedLiveStats(fixture, { ...replay, updatedAt: '2022-12-11T16:00:00Z' }, now).has_official_score, false);
});
