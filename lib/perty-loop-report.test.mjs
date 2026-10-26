import test from 'node:test';
import assert from 'node:assert/strict';
import { pertyLoopReport } from './perty-loop-report.mjs';
const event = (visitor_hash, created_at, action = 'perty:start') => ({ path: '/per-ty', visitor_hash, created_at, kind: 'click', action });
test('deduplicates starts, intersects completion, and reports both return denominators', () => {
  const rows = [event('a', '2026-10-23T08:00Z'), event('a', '2026-10-23T09:00Z'),
    event('b', '2026-10-23T08:00Z'), event('a', '2026-10-23T10:00Z', 'perty:complete'),
    event('orphan', '2026-10-23T10:00Z', 'perty:complete'), event('a', '2026-10-24T08:00Z')];
  const report = pertyLoopReport(rows, new Date('2026-10-26T12:00Z'));
  const cohort = report.cohorts[0];
  assert.equal(cohort.starters, 2);
  assert.deepEqual(cohort.completion, { count: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(cohort.nextDay.starters, { count: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(cohort.nextDay.completers, { count: 1, denominator: 1, rate: 1 });
});
test('Kosovo dates across DST; yesterday is pending and empty rates are null', () => {
  const report = pertyLoopReport([event('a', '2026-10-24T22:30Z'),
    event('b', '2026-10-25T23:30Z', 'perty:follow')], new Date('2026-10-26T12:00Z'));
  assert.equal(report.cohorts[0].day, '2026-10-25');
  assert.equal(report.cohorts[0].nextDay.status, 'pending');
  assert.equal(report.cohorts[0].nextDay.starters, null);
  assert.equal(report.cohorts[1].completion.rate, null);
});
test('historical visits remain labeled separately and missing next day counts zero', () => {
  const report = pertyLoopReport([{ ...event('a', '2026-10-23T08:00Z', null), kind: 'page' }], new Date('2026-10-26T12:00Z'));
  assert.equal(report.cohorts[0].starters, 0);
  assert.deepEqual(report.cohorts[0].nextDay.visitors, { count: 0, denominator: 1, rate: 0 });
});
