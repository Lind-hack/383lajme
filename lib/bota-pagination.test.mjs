import test from 'node:test';
import assert from 'node:assert/strict';
import {readBotaPages} from './bota-pagination.mjs';
test('all 3,200 recent IDs and cards survive the default row ceiling',async()=>{
 const rows=Array.from({length:3200},(_,id)=>({id}));
 const result=await readBotaPages(()=>({range:async(start,end)=>({data:rows.slice(start,end+1)})}));
 assert.deepEqual(result,rows);
});
test('a failed archive page does not silently publish a partial index',async()=>{
 await assert.rejects(readBotaPages(()=>({range:async(start)=>start?{error:{message:'failed'}}:{data:Array(500).fill({})}})),/complete Bota/);
});
