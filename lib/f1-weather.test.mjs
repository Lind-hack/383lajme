import test from 'node:test';
import assert from 'node:assert/strict';
import { raceForecast } from './f1-weather.mjs';
test('forecast selects race hours, preserves missing rain and rejects stale forecasts', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  const payload = {properties:{meta:{updated_at:now.toISOString()},timeseries:[
    {time:'2026-09-11T13:00:00Z',data:{next_1_hours:{details:{precipitation_amount:2}}}},
    {time:'2026-09-11T14:00:00Z',data:{}},
  ]}};
  const result = raceForecast(payload,'2026-09-11T13:00:00Z',now);
  assert.equal(result.rain_expected,true);
  assert.equal(result.precipitation_complete,false);
  assert.equal(result.hours[1].precipitation_mm,null);
  assert.equal(raceForecast(payload,'2026-09-15T13:00:00Z',now),null);
  assert.equal(raceForecast(payload,'2026-09-11T13:00:00Z',new Date('2026-09-11T12:00:00Z')),null);
  assert.equal(raceForecast(payload,'2026-09-11T13:00:00Z',new Date('2026-09-09T12:00:00Z')),null);
});
