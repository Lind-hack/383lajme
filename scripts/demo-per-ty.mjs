#!/usr/bin/env node
// Runs the compiled app against disposable local stories. No production writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import next from 'next';
import Database from 'better-sqlite3';
import { parseUsageBatch } from '../lib/usage-events.mjs';
import { pertyLoopReport } from '../lib/perty-loop-report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PERTY_DEMO_PORT || 43183);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PERTY_DEMO_PORT');
if (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.VERCEL) throw new Error('This demo is localhost only');
if (!fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  throw new Error('Run npm run build first. See docs/per-ty-reading-loop.md for local build settings.');
}

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), '383-perty-demo-'));
for (const name of ['node_modules', 'public', 'package.json', 'next.config.ts']) {
  fs.symlinkSync(path.join(root, name), path.join(runtime, name));
}
const cache = path.join(root, '.next', 'cache');
fs.cpSync(path.join(root, '.next'), path.join(runtime, '.next'), {
  recursive: true, mode: fs.constants.COPYFILE_FICLONE,
  filter: source => source !== cache && !source.startsWith(cache + path.sep),
});
fs.mkdirSync(path.join(runtime, 'data'));
fs.copyFileSync(path.join(root, 'data', 'articles.db'), path.join(runtime, 'data', 'articles.db'));
const database = new Database(path.join(runtime, 'data', 'articles.db'));
database.exec('delete from articles');
const insert = database.prepare(`insert into articles
  (id,slug,url,title,excerpt,body,source,category,published_at,processed,engagement_score)
  values (?,?,?,?,?,?,?,?,?,1,?)`);
const titles = ['Lajmet e qytetit tënd', 'Çfarë ndryshoi sot', 'Përmbledhja e mëngjesit',
  'Tema që ndjek', 'Ekonomia në pak fjalë', 'Sporti i ditës', 'Nga rajoni', 'Çfarë duhet të dish'];
const baseTime = Date.now();
for (const [i, title] of titles.entries()) {
  const text = 'Ky është një shembull për demonstrim, jo lajm i publikuar. Lexoje përmbledhjen këtu ose hap artikullin për të vazhduar.';
  insert.run(`demo-${i}`, `demo-story-${i}`, `https://example.invalid/demo-${i}`, `DEMO · ${title}`,
    text, `${text}\n\n`.repeat(8), 'Local demo', i < 4 ? 'Kosovë' : i < 6 ? 'Ekonomi' : 'Sport',
    new Date(baseTime - (i + 1) * 3600_000).toISOString(), 100 - i);
}
database.close();

// Only the isolated process sees these values; compiled public config is unchanged.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.CRON_SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-demo-placeholder';
process.chdir(runtime);
const app = next({ dev: false, dir: runtime, hostname: '127.0.0.1', port });
await app.prepare();
const handle = app.getRequestHandler();
let dayOffset = 0;
const events = new Map();
const virtualNow = () => new Date(Date.now() + dayOffset * 86400_000);
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body, null, 2));
};
const toolbar = `<div id="perty-demo-bar" data-usage-ignore style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#17130e;color:white;padding:10px 14px;font:13px/1.6 system-ui;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
<strong>LOCAL DEMO · sample stories</strong><button onclick="localStorage.setItem('383_consent','granted');window.dispatchEvent(new Event('383:consent'));this.textContent='Demo analytics enabled'">Enable demo analytics</button>
<button onclick="fetch('/_demo/tomorrow',{method:'POST'}).then(()=>location.href='/per-ty')">Tomorrow →</button>
<button onclick="for(const k of Object.keys(localStorage))if(k.startsWith('383'))localStorage.removeItem(k);sessionStorage.clear();fetch('/_demo/reset',{method:'POST'}).then(()=>location.href='/per-ty')">Reset demo</button>
<a href="/_demo/report" target="_blank" style="color:#ffab98">Captured events & report ↗</a></div>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const host = req.headers.host?.split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return json(res, 403, { error: 'Localhost only' });
    const mutation = req.method !== 'GET' && req.method !== 'HEAD';
    if (mutation && req.headers.origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin)) {
      return json(res, 403, { error: 'Invalid demo origin' });
    }
    if (url.pathname === '/_demo/tomorrow' && req.method === 'POST') {
      dayOffset = Math.min(dayOffset + 1, 5);
      return json(res, 200, { demoDay: virtualNow() });
    }
    if (url.pathname === '/_demo/reset' && req.method === 'POST') {
      dayOffset = 0; events.clear();
      return json(res, 200, { reset: true });
    }
    if (url.pathname === '/_demo/report.json') return json(res, 200, {
      demo: true, ...pertyLoopReport([...events.values()], virtualNow()),
      events: [...events.values()].filter(e => e.action?.startsWith('perty:')).map(e => ({ action: e.action, at: e.created_at })),
    });
    if (url.pathname === '/_demo/report') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      return res.end(`<!doctype html><meta charset="utf-8"><title>Local reading-loop events</title><style>body{max-width:1000px;margin:40px auto;padding:20px;background:#f9f6f1;font:16px system-ui}pre{white-space:pre-wrap;background:white;padding:20px;border-radius:12px}a{color:#d43d1d}</style><h1>Captured local events & cohort report</h1><p>Sample stories and in-memory events only. This page refreshes every two seconds.</p><p>Next-day return stays pending until that whole day ends. Click “Tomorrow” a second time to close the first return day.</p><a href="/per-ty">Back to the edition</a><pre id="report">Loading…</pre><script>async function update(){const r=await fetch('/_demo/report.json');document.querySelector('#report').textContent=JSON.stringify(await r.json(),null,2)}update();setInterval(update,2000)</script>`);
    }
    if (url.pathname === '/api/analytics/usage' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 16384) return json(res, 413, { error: 'Batch too large' });
      }
      let batch;
      try { batch = parseUsageBatch(JSON.parse(body)); } catch {}
      if (!batch) return json(res, 400, { error: 'Invalid usage batch' });
      const visitor_hash = createHash('sha256').update(batch.visitor).digest('hex');
      for (const event of batch.events) events.set(event.id, { ...event, visitor_hash, created_at: virtualNow().toISOString() });
      while (events.size > 10_000) events.delete(events.keys().next().value);
      res.writeHead(204); return res.end();
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/per-ty/brief') return json(res, 200, { lines: [] });
      if (url.pathname === '/api/per-ty/city') return json(res, 200, {});
      return json(res, 503, { error: 'External services are disabled in this local demo' });
    }
    // Keep third-party analytics dormant even if public IDs were baked into the build.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'");
    if ((url.pathname === '/per-ty' || url.pathname.startsWith('/article/demo-story-')) && !req.headers.rsc) {
      req.headers['accept-encoding'] = 'identity';
      if (url.pathname === '/per-ty') {
        // Refresh the local cached page against the disposable database.
        const manifest = JSON.parse(fs.readFileSync(path.join(runtime, '.next/prerender-manifest.json')));
        req.headers['x-prerender-revalidate'] = manifest.preview.previewModeId;
      }
      const write = res.write.bind(res), end = res.end.bind(res);
      const writeHead = res.writeHead.bind(res), flushHeaders = res.flushHeaders.bind(res);
      const chunks = [];
      // Buffer headers as well as body chunks before adding the demo controls.
      res.flushHeaders = () => {};
      res.writeHead = (status, message, headers) => {
        res.statusCode = status;
        if (typeof message === 'string') res.statusMessage = message;
        const values = typeof message === 'object' ? message : headers;
        if (Array.isArray(values)) {
          for (let i = 0; i < values.length; i += 2) res.setHeader(values[i], values[i + 1]);
        } else if (values) {
          for (const [name, value] of Object.entries(values)) res.setHeader(name, value);
        }
        return res;
      };
      res.write = (chunk, encoding, callback) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
        const cb = typeof encoding === 'function' ? encoding : callback;
        if (cb) cb();
        return true;
      };
      res.end = (chunk, encoding, callback) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
        res.write = write; res.end = end;
        res.writeHead = writeHead; res.flushHeaders = flushHeaders;
        let content = Buffer.concat(chunks);
        if (String(res.getHeader('content-type')).includes('text/html')) {
          const clock = `<script>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.now()+${dayOffset * 86400_000}]))}static now(){return NativeDate.now()+${dayOffset * 86400_000}}}}</script>`;
          content = Buffer.from(content.toString().replace('<head>', `<head>${clock}<style>body{padding-top:64px!important}</style>`).replace('</body>', `${toolbar}</body>`));
        }
        res.removeHeader('content-length');
        res.removeHeader('etag');
        return end(content, typeof encoding === 'function' ? encoding : callback);
      };
    }
    await handle(req, res);
  } catch (error) {
    console.error('Demo request failed:', error.message);
    if (!res.headersSent) json(res, 500, { error: 'Local demo request failed' });
    else res.end();
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Reading-loop demo: http://localhost:${port}/per-ty`);
  console.log(`Captured events: http://localhost:${port}/_demo/report`);
  console.log('Sample database:', runtime);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close();
  void app.close().finally(() => { fs.rmSync(runtime, { recursive: true, force: true }); process.exit(0); });
});
