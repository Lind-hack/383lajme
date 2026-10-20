import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function harness({ secret = 's'.repeat(32), queueError = null } = {}) {
 const inserts = [], requests = [];
 const module = { exports: {} };
 const source = ts.transpileModule(readFileSync(new URL('./mailer.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
 const modules = {
  'node:crypto': require('node:crypto'),
  '@/lib/supabase/admin': { createAdminClient: () => ({from: table => ({upsert: async (row, options) => {inserts.push({table,row,options});return {error:queueError};}})}) },
  './newsletter-mail.mjs': {encryptNewsletterMail: () => ({ciphertext:'encrypted',iv:'iv',tag:'tag'})},
  nodemailer: {createTransport: () => {throw new Error('Direct SMTP must not be used here');}},
 };
 vm.runInNewContext(source, {module,exports:module.exports,require:id=>modules[id],process:{env:{RESEND_API_KEY:'configured',EMAIL_FROM:'383 <noreply@383ks.com>',NEWSLETTER_SECRET:secret}},AbortSignal,
 fetch:async (url, args)=>{requests.push({url,args});return {ok:true,json:async()=>({id:'reader-receipt'})};}});
 return {...module.exports,inserts,requests};
}
test('operator mail queues encrypted SMTP with stable idempotency, without Resend', async()=>{
 const h=harness();const mail={purpose:'operator',to:'LindSylqa@gmail.com',subject:'monitor',html:'private',idempotencyKey:'run-123'};
 const a=await h.sendMail(mail),b=await h.sendMail(mail);
 assert.equal(a.via,'smtp_queue');assert.equal(a.id,b.id);assert.equal(h.requests.length,0);
 assert.equal(h.inserts[0].table,'site_smtp_mail_queue');assert.equal(h.inserts[0].row.payload.ciphertext,'encrypted');
 assert.equal(h.inserts[0].options.ignoreDuplicates,true);
});
test('queue failure or missing encryption cannot fall back to Resend',async()=>{
 for(const opts of [{queueError:{}},{secret:''}]){const h=harness(opts);await assert.rejects(h.sendMail({purpose:'operator',to:'lindsylqa@gmail.com',subject:'monitor',html:'body'}));assert.equal(h.requests.length,0);}
});
test('reader emails keep the branded transactional sender',async()=>{
 const h=harness();assert.equal((await h.sendMail({to:'lindsylqa@gmail.com',subject:'League',html:'body'})).via,'resend');
 assert.equal(h.inserts.length,0);assert.equal(JSON.parse(h.requests[0].args.body).from,'383 <noreply@383ks.com>');
});
