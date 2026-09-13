import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadMarketResearch} from './tregu-research-evidence.mjs';
const now=new Date('2026-09-13T12:00:00Z');
function client(payload,error=null){return {storage:{from:()=>({download:async()=>({error,data:{text:async()=>JSON.stringify(payload)}})})}};}
test('only fresh private research enters the pricing pool',async()=>{
  const good={generated_at:'2026-09-13T11:50:00Z',markets:{ai:[{slug:'original'}]}};
  assert.equal((await loadMarketResearch(client(good),now)).markets.ai.length,1);
  assert.equal((await loadMarketResearch(client({...good,generated_at:'2026-09-13T10:00:00Z'}),now)).status,'stale');
  assert.equal((await loadMarketResearch(client(good,'missing'),now)).status,'unavailable');
});
