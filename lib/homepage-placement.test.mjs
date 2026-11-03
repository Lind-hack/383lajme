import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHomepagePlacement } from './homepage-placement.mjs';

const start = Date.parse('2026-11-03T23:00:00Z');
const placement = { article_id: 'event', starts_at: new Date(start).toISOString(), ends_at: new Date(start + 86400000).toISOString() };
const event = { id: 'event', title: 'Seminar' };
const ranked = Array.from({ length: 7 }, (_, i) => ({ id: String(i), featured: true, engagementScore: 100 }));

test('independent article outranks newer featured stories only within its 24 hours', () => {
  assert.deepEqual(applyHomepagePlacement(ranked, event, placement, start - 1), ranked);
  for (const now of [start, start + 86399999]) {
    const result = applyHomepagePlacement(ranked, event, placement, now);
    assert.equal(result[0], event);
    assert.equal(result.length, 7);
    assert.deepEqual(result.slice(1), ranked.slice(0, 6));
  }
  assert.deepEqual(applyHomepagePlacement(ranked, event, placement, start + 86400000), ranked);
});
test('an already ranked placement appears once and invalid or missing placements preserve rankings', () => {
  const result = applyHomepagePlacement([ranked[0], event, ...ranked.slice(1, 6)], event, placement, start);
  assert.equal(result.filter((a) => a.id === 'event').length, 1);
  assert.equal(result[0], event);
  for (const invalid of [null, { ...placement, article_id: 'wrong' }, { ...placement, ends_at: 'invalid' }]) {
    assert.deepEqual(applyHomepagePlacement(ranked, event, invalid, start), ranked);
  }
  assert.deepEqual(applyHomepagePlacement(ranked, null, placement, start), ranked);
});
