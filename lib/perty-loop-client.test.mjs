import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync(new URL('./perty-loop-client.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { measurePertyLoop } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const storage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };
test('consent gates milestones, identity is reused, and payload contains no follows', async () => {
  const old = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
  try {
    globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, ...JSON.parse(options.body) }); return new Response(null, { status: 204 }); };
    assert.equal(measurePertyLoop('start'), false);
    assert.equal(calls.length, 0);
    localStorage.setItem('383_consent', 'granted');
    assert.equal(measurePertyLoop('start'), true);
    assert.equal(measurePertyLoop('complete'), true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].visitor, calls[1].visitor);
    assert.equal(calls[0].session, calls[1].session);
    assert.equal(calls[1].events[0].action, 'perty:complete');
    assert.deepEqual(Object.keys(calls[0].events[0]).sort(), ['action', 'id', 'kind', 'path']);
    localStorage.setItem('383_consent', 'denied');
    assert.equal(measurePertyLoop('follow'), false);
    assert.equal(calls.length, 2);
  } finally { Object.assign(globalThis, old); }
});
