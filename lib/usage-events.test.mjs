import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPath, buttonAction, featureForPath, parseUsageBatch } from './usage-events.mjs';
const id = 'b75dc4be-8c08-4e3c-897b-ae5d71c2aa77';
const batch = event => ({ consent: 'granted', visitor: id, session: id, events: [{ id, path: '/tregu', kind: 'click', action: 'button:yes', ...event }] });
test('private routes and external links are excluded; queries never survive', () => {
  for (const p of ['/admin/tregu', '/auth/confirm?token=abc', '/profili', 'https://evil.test/tregu']) assert.equal(publicPath(p), null);
  assert.equal(publicPath('/tregu?a=secret#private'), '/tregu');
  assert.equal(publicPath('/visit/r/SECRET'), '/visit/r/[invite]');
  assert.equal(publicPath('/gazeta/SECRET'), '/gazeta/[paper]');
  assert.equal(featureForPath('/tregu/market'), 'tregu');
  assert.equal(featureForPath('/tregu-preview'), 'other');
});
test('button labels are a closed vocabulary; arbitrary DOM text is never sent', () => {
  assert.equal(buttonAction('Hap menunë'), 'button:menu_open');
  assert.equal(buttonAction('Blej Po'), 'button:buy');
  assert.equal(buttonAction('Shit pozicionin'), 'button:sell');
  assert.equal(buttonAction('Shpërndaje tregun'), 'button:share');
  assert.equal(buttonAction('Private user name'), 'button:other');
  assert.equal(parseUsageBatch(batch({ action: 'button:private user name' })), null);
});
test('consent, bounded time increments, batch size, and IDs are validated', () => {
  assert.equal(parseUsageBatch({ ...batch({}), consent: 'denied' }), null);
  assert.equal(parseUsageBatch({ ...batch({}), visitor: 'email@example.com' }), null);
  assert.equal(parseUsageBatch(batch({ kind: 'active', seconds: 31 })), null);
  assert.equal(parseUsageBatch(batch({ kind: 'active', seconds: 15 })).events[0].seconds, 15);
  assert.equal(parseUsageBatch({ ...batch({}), events: Array(21).fill(batch({}).events[0]) }), null);
});
