import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthUserStore} from './auth-user-store.mjs';

function setup(synchronousEvent) {
  let resolve, reject, callback;
  let reads = 0, subscriptions = 0;
  const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
  const auth = {
    getSession() {reads++; return pending;},
    onAuthStateChange(fn) {subscriptions++; callback = fn; if (synchronousEvent) fn(...synchronousEvent);},
  };
  const store = createAuthUserStore();
  return {store, auth, resolve, reject, event: (...args) => callback(...args), counts: () => ({reads, subscriptions})};
}
const user = {id: 'test-user'};
const flush = async () => {await Promise.resolve(); await Promise.resolve();};

for (const event of ['SIGNED_IN', 'SIGNED_OUT']) {
  test(`delayed initial read cannot overwrite ${event}`, async () => {
    const t = setup(); t.store.start(t.auth);
    t.event(event, event === 'SIGNED_IN' ? {user} : null);
    t.resolve({data: {session: event === 'SIGNED_IN' ? null : {user}}});
    await flush();
    assert.deepEqual(t.store.getSnapshot(), {user: event === 'SIGNED_IN' ? user : null, ready: true});
  });
}
test('synchronous sign-in during subscription wins over old read', async () => {
  const t = setup(['SIGNED_IN', {user}]); t.store.start(t.auth);
  t.resolve({data: {session: null}}); await flush();
  assert.equal(t.store.getSnapshot().user, user);
});
test('explicit successful login before mount survives both initialization paths', async () => {
  const t = setup(); t.store.acceptUser(user); t.store.start(t.auth);
  t.event('INITIAL_SESSION', null); t.resolve({data: {session: null}}); await flush();
  assert.equal(t.store.getSnapshot().user, user);
});
test('shared observers and remounts initialize only once and retain state', () => {
  const t = setup(); let first = 0, second = 0;
  const unsubscribe = t.store.subscribe(() => first++);
  t.store.subscribe(() => second++);
  t.store.start(t.auth); t.store.start(t.auth);
  t.event('SIGNED_IN', {user}); unsubscribe(); t.event('TOKEN_REFRESHED', {user});
  assert.deepEqual(t.counts(), {reads: 1, subscriptions: 1});
  assert.equal(first, 1); assert.equal(second, 2);
  assert.equal(t.store.getSnapshot().user, user);
  assert.deepEqual(t.store.getServerSnapshot(), {user: null, ready: false});
});
test('initial session read resolves loading; failures settle without false login', async () => {
  const t = setup(); t.store.start(t.auth);
  assert.equal(t.store.getSnapshot().ready, false);
  t.resolve({data: {session: {user}}}); await flush();
  assert.deepEqual(t.store.getSnapshot(), {user, ready: true});
  const failed = setup(); failed.store.start(failed.auth); failed.reject(new Error('offline')); await flush();
  assert.deepEqual(failed.store.getSnapshot(), {user: null, ready: true});
});
test('read failure cannot erase newer login', async () => {
  const t = setup(); t.store.start(t.auth); t.event('SIGNED_IN', {user});
  t.reject(new Error('offline')); await flush();
  assert.equal(t.store.getSnapshot().user, user);
});
test('late initial event cannot erase a completed session read', async () => {
  const t = setup(); t.store.start(t.auth);
  t.resolve({data: {session: {user}}}); await flush();
  t.event('INITIAL_SESSION', null);
  assert.equal(t.store.getSnapshot().user, user);
});
