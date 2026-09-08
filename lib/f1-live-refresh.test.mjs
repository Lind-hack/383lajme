import test from "node:test";
import assert from "node:assert/strict";
import { buildF1RaceWinnerPlan, openF1ToWinnerLeaderboard } from "./f1-live-lite.mjs";
import { fetchF1FinalResult } from "./f1-result-recovery.mjs";
const outcomes=Array.from({length:22},(_,i)=>({key:`D${String(i).padStart(2,"0")}`,driver_number:i+1}));
const market={status:"open",market_classification:"live_f1",market_type:"f1_race_winner",sport_outcomes:outcomes,live_event:{provider:"openf1",event_id:"race",openf1_session_key:42,race_start:"2026-09-06T13:00:00Z"}};
const live={source_url:"https://api.openf1.org/v1/",session:{session_key:42},total_laps:53,lap:10,rows:outcomes.map((o,i)=>({driver_code:o.key,driver:o.key,position:i+1,gap_to_leader:i*3,tyre:"MEDIUM",tyre_age:10,recent_pace:90+i*.03})),weather:{rainfall:0}};
test("the actual OpenF1 adapter carries distance, pace and tyres into late-race odds",()=>{
 const early=buildF1RaceWinnerPlan({markets:[market],leaderboard:openF1ToWinnerLeaderboard(live)})[0];
 const late=buildF1RaceWinnerPlan({markets:[market],leaderboard:openF1ToWinnerLeaderboard({...live,lap:52})})[0];
 assert.ok(late.probabilities.D00 > .9);
 assert.ok(late.probabilities.D00 > early.probabilities.D00);
 assert.equal(late.oracle_cap,1);
 assert.ok(Math.abs(Object.values(late.probabilities).reduce((a,b)=>a+b,0)-1)<1e-6);
 assert.equal(buildF1RaceWinnerPlan({markets:[market],leaderboard:openF1ToWinnerLeaderboard({...live,session:{session_key:43}})}).length,0);
});
test("result recovery accepts only the exact ended race and uniquely mapped winner",async()=>{
 const rows=outcomes.map((o,i)=>({session_key:42,driver_number:o.driver_number,position:i+1,number_of_laps:53}));
 const session={session_key:42,session_type:"Race",date_start:market.live_event.race_start,date_end:"2026-09-06T15:00:00Z"};
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes("session_result")?rows:[session]});
 const result=await fetchF1FinalResult(market,{now:new Date("2026-09-07"),fetchImpl});
 assert.equal(result.winner,"D00");
 session.date_start="invalid";
 assert.equal(await fetchF1FinalResult(market,{now:new Date("2026-09-07"),fetchImpl}),null);
});
