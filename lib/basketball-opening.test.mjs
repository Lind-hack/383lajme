import test from 'node:test';
import assert from 'node:assert/strict';
import { basketballOpeningModel } from './basketball-opening.mjs';
const competition = (home, away) => ({ competitors: [
  { homeAway: 'home', records: [{ name: 'overall', type: 'total', summary: home }] },
  { homeAway: 'away', records: [{ name: 'overall', type: 'total', summary: away }] },
] });
test('observed season records distinguish favorites when bookmaker odds are absent', () => {
  const model = basketballOpeningModel(competition('17-59', '42-34'), 'https://site.api.espn.com/');
  assert.ok(model.probabilities.home < .3);
  assert.equal(model.probabilities.home + model.probabilities.away, 1);
  assert.match(model.method, /estimate/);
  assert.ok(model.missing_inputs.includes('injuries'));
});
test('new performance evidence moves the opening target in the winning direction', () => {
  const before = basketballOpeningModel(competition('10-10', '10-10'));
  const after = basketballOpeningModel(competition('15-10', '10-15'));
  assert.equal(before.probabilities.home, .5);
  assert.ok(after.probabilities.home > before.probabilities.home);
});
test('available moneyline supersedes the record estimate and removes overround', () => {
  const value = competition('17-59', '42-34');
  value.odds = [{ moneyline: { home: { close: { odds: '-200' } }, away: { close: { odds: '+180' } } } }];
  const model = basketballOpeningModel(value);
  assert.ok(model.probabilities.home > .6);
  assert.match(model.method, /moneyline/);
});
test('zero, absent and malformed records stay explicitly neutral', () => {
  for (const record of ['0-0', 'unknown', '', '10-2-1']) {
    const model = basketballOpeningModel(competition(record, '20-5'));
    assert.equal(model.probabilities.home, .5);
    assert.ok(model.missing_inputs.includes('season_records'));
  }
});
