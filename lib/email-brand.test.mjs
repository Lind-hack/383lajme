import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('confirmation, recovery and shared league shell use the public animated 383 logo',()=>{
 for(const file of ['emails/confirm-signup.html','emails/recovery.html','lib/tregu-email-kit.ts']){
  const s=read(file);assert.match(s,/https:\/\/383ks\.com\/email\/383-logo-animated\.gif/);assert.match(s,/width="72" height="72" alt="383"/);
 }
 assert.match(read('emails/confirm-signup.html'),/TokenHash/);assert.match(read('emails/recovery.html'),/type=recovery/);
 const gif=readFileSync(new URL('../public/email/383-logo-animated.gif',import.meta.url));assert.equal(gif.subarray(0,3).toString(),'GIF');assert.equal(gif.readUInt16LE(6),256);assert.ok(gif.length<100000);
});
