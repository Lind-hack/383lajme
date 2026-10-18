import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { weeklyWindow } from './newsletter.mjs';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(fs.readFileSync(new URL('./newsletter-server.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const subscriber = 'a0ba6535-dd52-4124-9d88-555638187cf5';
const issue = { ...weeklyWindow(new Date('2026-10-18T17:00:00Z')), total: 1, stories: [
  { slug: 'lajmi-javor', title: 'Lajmi i javës', excerpt: 'Përmbledhje nga arkivi.', source: 'Reuters', category: 'Kosovë' },
] };

function harness({ providerStatus = 200, providerThrows = false, receiptFails = false, consent = 'active', requestId = subscriber, outsideWindow = false, smtp = false, smtpThrows = false } = {}) {
  const calls = [], writes = [], rpcs = [], smtpCalls = [];
  let claimed = false;
  const admin = {
    async rpc(name, args) {
      rpcs.push({ name, args });
      if (name === 'request_newsletter_subscription') return { data: requestId };
      const data = claimed ? [] : [{ subscriber_id: subscriber, email: 'reader@example.invalid', claim_token: 'claim' }];
      claimed = true; return { data };
    },
    from(table) {
      let operation = 'select', value;
      const query = {
        select() { return this; }, eq() { return this; }, in() { return this; },
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
  const context = { exports: {}, process: { env: { NEWSLETTER_SECRET: 's'.repeat(40), RESEND_API_KEY: 'test-key', NEWSLETTER_FROM: '383 <test@example.invalid>', NEWSLETTER_SITE_URL: 'https://383ks.com' } },
    URL, AbortSignal, Date: Clock, setTimeout: fn => fn(),
    require: name => name === 'server-only' ? {} : name === '@/lib/supabase/admin' ? { createAdminClient: () => admin } : name === 'nodemailer' ? {
      createTransport: () => ({ sendMail: async payload => {
        smtpCalls.push(payload);
        if (smtpThrows) throw new Error('SMTP connection lost');
        return { messageId: 'smtp-receipt', accepted: [payload.to] };
      } }),
    } : require(name),
    fetch: async (url, options) => {
      calls.push({ url, ...options, payload: JSON.parse(options.body) });
      if (providerThrows) throw new Error('network interrupted');
      return { ok: providerStatus === 200, status: providerStatus, json: async () => providerStatus === 200 ? { id: 'provider-receipt' } : { name: 'daily_quota_exceeded' } };
    },
  };
  if (smtp) Object.assign(context.process.env, { GMAIL_USER: 'sender@example.invalid', GMAIL_APP_PASSWORD: 'test-password' });
  vm.runInNewContext(source, context);
  return { api: context.exports, calls, writes, rpcs, smtpCalls };
}

test('Resend quota exhaustion falls back to authenticated Gmail and persists intent first', async () => {
  const h = harness({ providerStatus: 429, smtp: true });
  const result = await h.api.sendWeeklyNewsletter();
  assert.equal(result.sent, 1);
  assert.equal(h.smtpCalls.length, 1);
  assert.equal(h.smtpCalls[0].from.address, 'sender@example.invalid');
  assert.equal(h.writes[0].value.status, 'held');
  assert.equal(h.writes[0].value.last_error, 'smtp_inflight');
  assert.equal(h.writes.at(-1).value.status, 'sent');
});

test('uncertain SMTP delivery stays held instead of risking a duplicate on the next run', async () => {
  const h = harness({ providerStatus: 429, smtp: true, smtpThrows: true });
  const result = await h.api.sendWeeklyNewsletter();
  assert.equal(result.failed, 1);
  assert.equal(h.writes.at(-1).value.status, 'held');
  assert.equal(h.smtpCalls.length, 1);
});

test('SMTP acceptance followed by receipt failure leaves its persisted hold in place', async () => {
  const h = harness({ providerStatus: 429, smtp: true, receiptFails: true });
  await assert.rejects(h.api.sendWeeklyNewsletter(), /newsletter_receipt_not_saved/);
  assert.equal(h.writes[0].value.status, 'held');
  assert.equal(h.smtpCalls.length, 1);
});

test('signup stores only a hash, sends confirmation, and never emails a suppressed request', async () => {
  const h = harness();
  await h.api.requestNewsletter('reader@example.invalid', '192.0.2.1');
  assert.equal(h.calls.length, 1);
  assert.equal(h.rpcs[0].args.p_ip_hash.length, 64);
  assert.ok(!JSON.stringify(h.rpcs).includes('192.0.2.1'));
  const token = h.calls[0].payload.text.match(/confirm=([a-f0-9]{64})/)[1];
  assert.notEqual(h.rpcs[0].args.p_token_hash, token);
  const suppressed = harness({ requestId: null });
  await suppressed.api.requestNewsletter('reader@example.invalid', '192.0.2.1');
  assert.equal(suppressed.calls.length, 0);
});

test('a rejected confirmation clears only its own token so signup can retry immediately', async () => {
  const h = harness({ providerStatus: 429 });
  await assert.rejects(h.api.requestNewsletter('reader@example.invalid', '192.0.2.1'), /email_provider_429/);
  assert.equal(h.writes[0]?.table, 'newsletter_subscribers');
  assert.equal(h.writes[0]?.value.confirm_token_hash, null);
  assert.equal(h.writes[0]?.value.confirm_expires_at, null);
  assert.ok(Date.parse(h.writes[0]?.value.requested_at) < Date.now() - 600000);
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
