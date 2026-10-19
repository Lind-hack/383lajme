import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { weeklyWindow } from './newsletter.mjs';
import { decryptNewsletterMail } from './newsletter-mail.mjs';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(fs.readFileSync(new URL('./newsletter-server.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const subscriber = 'a0ba6535-dd52-4124-9d88-555638187cf5';
const issue = { ...weeklyWindow(new Date('2026-10-18T17:00:00Z')), total: 1, stories: [
  { slug: 'lajmi-javor', title: 'Lajmi i javës', excerpt: 'Përmbledhje nga arkivi.', source: 'Reuters', category: 'Kosovë' },
] };

function harness({ providerStatus = 200, providerThrows = false, receiptFails = false, consent = 'active', requestAccepted = true, requestError = false, mailConfigured = true, outsideWindow = false, provider = 'resend', smtp = false, queueFails = false } = {}) {
  const calls = [], writes = [], rpcs = [];
  let claimed = false;
  const admin = {
    async rpc(name, args) {
      rpcs.push({ name, args });
      if (name === 'enqueue_newsletter_mail') return { data: !queueFails, error: queueFails ? {} : null };
      if (name === 'activate_newsletter_subscription') return { data: requestAccepted, error: requestError ? {} : null };
      const data = claimed ? [] : [{ subscriber_id: subscriber, email: 'reader@example.invalid', claim_token: 'claim' }];
      claimed = true; return { data };
    },
    from(table) {
      let operation = 'select', value;
      const query = {
        select() { return this; }, eq() { return this; }, neq() { return this; }, in() { return this; },
        update(v) { operation = 'update'; value = v; return this; },
        maybeSingle() { return Promise.resolve({ data: { content: issue } }); },
        single() { return Promise.resolve({ data: { status: consent, confirmed_at: '2026-10-01T00:00:00Z' } }); },
        then(resolve, reject) {
          if (operation === 'update') writes.push({ table, value });
          const error = receiptFails && value?.status === 'sent' ? { message: 'database unavailable' } : null;
          return Promise.resolve({ error, count: 0, data: [{ subscriber_id: subscriber }] }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [outsideWindow ? '2026-10-21T12:00:00Z' : '2026-10-18T17:00:00Z'])); } }
  const context = { exports: {}, process: { env: { NEWSLETTER_SECRET: 's'.repeat(40), RESEND_API_KEY: 'test-key', NEWSLETTER_FROM: '383 <test@example.invalid>', NEWSLETTER_SITE_URL: 'https://383ks.com', NEWSLETTER_MAIL_PROVIDER: provider } },
    URL, AbortSignal, Date: Clock, setTimeout: fn => fn(),
    require: name => name === 'server-only' ? {} : name === '@/lib/supabase/admin' ? { createAdminClient: () => admin } : require(name),
    fetch: async (url, options) => {
      calls.push({ url, ...options, payload: JSON.parse(options.body) });
      if (providerThrows) throw new Error('network interrupted');
      return { ok: providerStatus === 200, status: providerStatus, json: async () => providerStatus === 200 ? { id: 'provider-receipt' } : { name: 'daily_quota_exceeded' } };
    },
  };
  if (!mailConfigured) { delete context.process.env.RESEND_API_KEY; delete context.process.env.NEWSLETTER_FROM; }
  if (smtp) Object.assign(context.process.env, { NEWSLETTER_SMTP_QUEUE: '1' });
  vm.runInNewContext(source, context);
  return { api: context.exports, calls, writes, rpcs };
}

test('Resend quota exhaustion durably queues encrypted mail without claiming it was sent', async () => {
  const h = harness({ providerStatus: 429, smtp: true });
  const result = await h.api.sendWeeklyNewsletter();
  assert.equal(result.sent, 0);
  assert.equal(result.queued, 1);
  const queued = h.rpcs.find(r => r.name === 'enqueue_newsletter_mail').args;
  assert.equal(queued.p_issue_id, issue.id);
  assert.equal(queued.p_subscriber_id, subscriber);
  assert.ok(!JSON.stringify(queued).includes('reader@example.invalid'));
  const decoded = decryptNewsletterMail(queued.p_payload, 's'.repeat(40), queued.p_id);
  assert.equal(decoded.to, 'reader@example.invalid');
  assert.ok(decoded.html.includes('Çregjistrohu'));
  assert.equal(h.writes.length, 0);
});

test('a failed queue write fails the send instead of claiming delivery', async () => {
  const h = harness({ providerStatus: 429, smtp: true, queueFails: true });
  const result = await h.api.sendWeeklyNewsletter();
  assert.equal(result.failed, 1);
  assert.equal(result.sent, 0);
  assert.equal(h.writes.at(-1).value.status, 'pending');
});

test('uncertain Resend acceptance never reroutes to another provider', async () => {
  const h = harness({ providerThrows: true, smtp: true });
  await h.api.sendWeeklyNewsletter();
  assert.ok(!h.rpcs.some(r => r.name === 'enqueue_newsletter_mail'));
});

test('one-click signup activates through storage without token, provider or mail configuration', async () => {
  const h = harness({ mailConfigured: false });
  await h.api.requestNewsletter('reader@example.invalid', '192.0.2.1');
  assert.equal(h.calls.length, 0);
  assert.equal(h.rpcs.length, 1);
  assert.equal(h.rpcs[0].name, 'activate_newsletter_subscription');
  assert.equal(h.rpcs[0].args.p_ip_hash.length, 64);
  assert.equal(h.rpcs[0].args.p_email, 'reader@example.invalid');
  assert.ok(!JSON.stringify(h.rpcs).includes('192.0.2.1'));
  assert.ok(!('p_token_hash' in h.rpcs[0].args));
});

test('a rejected or unavailable subscription never returns a false success', async () => {
  await assert.rejects(harness({ requestAccepted: false }).api.requestNewsletter('reader@example.invalid', 'ip'), /newsletter_rate_limited/);
  await assert.rejects(harness({ requestError: true }).api.requestNewsletter('reader@example.invalid', 'ip'), /subscription_storage_unavailable/);
});

test('weekly sender records receipt and provides private, one-click unsubscribe', async () => {
  const h = harness();
  const result = await h.api.sendWeeklyNewsletter();
  assert.equal(result.sent, 1);
  assert.equal(h.calls[0].headers['Idempotency-Key'], `newsletter-weekly/${issue.id}/${subscriber}`);
  assert.equal(h.calls[0].payload.to.length, 1);
  assert.equal(h.calls[0].payload.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(h.calls[0].payload.headers['List-Unsubscribe'].includes('/api/newsletter/unsubscribe?token='));
  assert.equal(h.writes[0].value.provider_id, 'provider-receipt');
  assert.ok(!JSON.stringify(result).includes('reader@example.invalid'));
});

test('provider rate limits remain retryable; permanent rejection is held', async () => {
  for (const [status, expected] of [[429, 'pending'], [422, 'held']]) {
    const h = harness({ providerStatus: status });
    const result = await h.api.sendWeeklyNewsletter();
    assert.equal(result.failed, 1);
    assert.equal(h.writes[0].value.status, expected);
    assert.equal(h.writes[0].value.claimed_until, null);
    assert.ok(!h.writes.some(w => w.value.sent_at));
  }
});

test('network uncertainty retries the same payload and idempotency key', async () => {
  const first = harness({ providerThrows: true }), retry = harness();
  await first.api.sendWeeklyNewsletter();
  await retry.api.sendWeeklyNewsletter();
  assert.deepEqual(first.calls[0].payload, retry.calls[0].payload);
  assert.equal(first.calls[0].headers['Idempotency-Key'], retry.calls[0].headers['Idempotency-Key']);
  assert.equal(first.writes[0].value.status, 'pending');
});

test('accepted mail with a failed database receipt keeps its lease for safe retry', async () => {
  const h = harness({ receiptFails: true });
  await assert.rejects(h.api.sendWeeklyNewsletter(), /newsletter_receipt_not_saved/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.writes.length, 1);
});

test('revoked consent and midweek invocations do not contact the provider', async () => {
  for (const options of [{ consent: 'unsubscribed' }, { outsideWindow: true }]) {
    const h = harness(options);
    await h.api.sendWeeklyNewsletter();
    assert.equal(h.calls.length, 0);
  }
});


test('approved Gmail mode uses the durable queue without contacting Resend or claiming delivery', async () => {
  const h=harness({provider:'gmail',smtp:true,providerThrows:true});
  const result=await h.api.sendWeeklyNewsletter();
  assert.equal(h.calls.length,0);
  assert.equal(result.queued,1);
  assert.equal(result.sent,0);
  assert.ok(h.rpcs.some(r=>r.name==='enqueue_newsletter_mail'));
  assert.equal(h.writes.length,0);
});
