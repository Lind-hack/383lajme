import test from 'node:test';
import assert from 'node:assert/strict';
import { sportEventState, buildSportMarketPlan, rescheduledSportClose } from './tregu-sport-market.mjs';

test('official postponements preserve the trading buffer beyond the discovery horizon', () => {
  const market = { live_event: { kickoff: '2026-09-09T18:00:00Z' }, closes_at: '2026-09-10T00:00:00Z' };
  assert.equal(rescheduledSportClose(market, '2026-09-19T18:00:00Z'), '2026-09-20T00:00:00.000Z');
  assert.equal(rescheduledSportClose(market, 'invalid'), market.closes_at);
});

test('persisted sports state retains clock, score, chart metrics and source timestamp', () => {
  for (const league of ['nba', 'fbk.kosovo', 'uefa.europa', 'uefa.europa.conf']) {
    const event = { provider: league === 'fbk.kosovo' ? 'fbk' : 'espn', league, event_id: 'match',
      period: 3, clock_seconds: 128, status: 'STATUS_IN_PROGRESS',
      has_official_score: true, metrics: { Home: { points: 60, assists: 12 } },
      source_updated_at: '2026-09-09T12:00:00Z', competitors: [{ team: 'Home', score: 60 }] };
    const stored = sportEventState(event, 'key');
    assert.equal(stored.clock_seconds, 128);
    assert.equal(stored.period, 3);
    assert.deepEqual(stored.metrics, event.metrics);
    assert.equal(stored.source_updated_at, event.source_updated_at);
    assert.equal(stored.has_official_score, true);
    assert.equal(stored.provider, event.provider);
  }
});
test('rescheduled fixture refreshes its persisted state even without a score', () => {
  const event = { provider: 'fbk', event_id: 'match', league: 'fbk.kosovo', status: 'STATUS_SCHEDULED',
    kickoff: '2026-09-10T12:00:00Z', has_official_score: false, competitors: [] };
  const market = { status: 'open', market_classification: 'live_basketball', live_event: { provider: 'fbk', event_id: 'match' }, sport_outcomes: [{ key: 'home' }, { key: 'away' }] };
  const [first] = buildSportMarketPlan({ markets: [market], events: [event] });
  const [changed] = buildSportMarketPlan({ markets: [{ ...market, live_score_state: { key: first.state_key } }], events: [{ ...event, kickoff: '2026-09-11T12:00:00Z' }] });
  assert.equal(changed.kind, 'no_score');
  assert.equal(changed.kickoff, '2026-09-11T12:00:00Z');
  assert.equal(sportEventState(event, first.state_key).clock_seconds, null);
});

test('postponement is not a final and absent clock or aggregate is not zero', async () => {
  const { normalizeEspnSummary, isOfficialFinal } = await import('./tregu-sport-market.mjs');
  assert.equal(isOfficialFinal({ status: 'STATUS_POSTPONED' }), false);
  const config = { event_id: 'event', league: 'nba', sport: 'basketball' };
  const body = { header: { competitions: [{ status: { type: { name: 'STATUS_IN_PROGRESS' }, period: 4, clock: null }, competitors: [
    { homeAway: 'home', team: { displayName: 'Home' }, score: 80, aggregateScore: null },
    { homeAway: 'away', team: { displayName: 'Away' }, score: 77, aggregateScore: null },
  ] }] } };
  const event = normalizeEspnSummary(config, body);
  assert.equal(event.clock_seconds, null);
  assert.equal(event.competitors[0].aggregate_score, null);
  body.header.competitions[0].competitors[0].score = null;
  assert.throws(() => normalizeEspnSummary(config, body), /no usable official score/);
});
