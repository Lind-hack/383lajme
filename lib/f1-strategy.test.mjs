import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateStopScenarios } from './f1-strategy.mjs';
test('strategy estimates use measured net loss, preserve missing data and never announce a plan', () => {
  const laps = Array.from({length:12},(_,i)=>({driver_number:1,lap_number:i+1,lap_duration:90+i*.1}));
  laps[3].lap_duration += 12;
  laps[4].lap_duration += 10;
  laps[4].is_pit_out_lap=true;
  const stints=[{driver_number:1,lap_start:5,stint_number:2}];
  const pits=[{driver_number:1,lap_number:4,date:'2026-09-10T12:00:00Z'}];
  const result=estimateStopScenarios(1,stints,laps,pits,50);
  assert.equal(result.available,true);
  assert.equal(result.kind,'estimate');
  assert.deepEqual(result.scenarios.map(row=>row.total_stops),[1,2,3]);
  assert.ok(result.net_stop_loss_seconds>20 && result.net_stop_loss_seconds<25);
  assert.equal(estimateStopScenarios(1,stints,laps,null,50).available,false);
  assert.equal(estimateStopScenarios(1,stints,laps,pits,12).available,false);
});
