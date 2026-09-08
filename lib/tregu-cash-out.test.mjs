import test from "node:test";
import assert from "node:assert/strict";
import { cashOutCoins, sharesForCoins } from "./tregu-cash-out.mjs";
import { basketballWinProbability } from "./basketball-live.mjs";

test("coin cash-outs invert LMSR proceeds across favorites and long shots", () => {
  for (const p of [.001, .05, .5, .9, .999]) for (const b of [400, 6500]) {
    const held = 200, maximum = cashOutCoins(p,b,held);
    for (const fraction of [.01,.25,.9]) {
      const coins = maximum*fraction, shares = sharesForCoins(p,b,coins,held);
      assert.ok(shares > 0 && shares < held);
      assert.ok(Math.abs(cashOutCoins(p,b,shares)-coins) < 1e-8);
    }
    assert.equal(sharesForCoins(p,b,maximum,held), held);
    assert.ok(maximum < held*p);
  }
});
test("invalid cash-out inputs never create a payout", () => {
  for (const p of [NaN, Infinity, -1, 0, 1]) assert.equal(cashOutCoins(p,6500,10),0);
  assert.equal(cashOutCoins(.5,0,10),0);
  assert.equal(sharesForCoins(.5,6500,-10,100),0);
});
test("basketball uses team identity and game clock including overtime", () => {
  const event = { league:"nba", period:4, clock_seconds:5, competitors:[{homeAway:"away",score:90},{homeAway:"home",score:98}] };
  const late = basketballWinProbability(event);
  assert.ok(late > .99);
  assert.equal(late, basketballWinProbability({...event, competitors:[...event.competitors].reverse()}));
  assert.ok(late > basketballWinProbability({...event,period:1,clock_seconds:600}));
  assert.equal(basketballWinProbability({...event,period:5,clock_seconds:0,competitors:event.competitors.map(t=>({...t,score:98}))}),.5);
  assert.equal(basketballWinProbability({...event,clock_seconds:undefined},.7),.7);
});


test("confirmed absences affect a fresh base once; rumors do not", async () => {
  const { rosterNews, applyRosterNews } = await import("./sport-pregame-context.mjs");
  const facts = rosterNews({ injuries:[{team:{id:1},injuries:[{status:"Out",athlete:{displayName:"A"}},{status:"Questionable",athlete:{displayName:"B"}}]}]}, {home:{id:1},away:{id:2}}, "https://espn.com/test");
  assert.equal(facts.length,1);
  const prior={home:.5,draw:.25,away:.25};
  assert.ok(applyRosterNews(prior,facts).home < prior.home);
  assert.deepEqual(applyRosterNews(prior,facts),applyRosterNews(prior,facts));
});
