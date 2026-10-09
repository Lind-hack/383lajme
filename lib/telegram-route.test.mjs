import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as dispatch from "./telegram-dispatch.mjs";

// Exercise the real route with isolated API/database boundaries; never send test posts.
const source = readFileSync(new URL("../app/api/cron/dispatch-telegram/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function route({ env = {}, telegram = { ok: true, result: { message_id: 61 } }, denied = null, throwNetwork = false } = {}) {
  const sends = [];
  const ledger = [];
  const article = { slug: "latest-story", title: "New story", excerpt: "Details", image_url: "https://example.com/photo.jpg", published_at: new Date().toISOString(), featured: true };
  const database = { from(table) {
    const query = {
      select() { return query; }, eq() { return query; }, gte() { return query; }, order() { return query; }, limit() { return query; },
      then(resolve) { resolve({ data: table === "news_articles" ? [article] : ledger, error: null }); },
      async insert(value) { ledger.push(value); return { error: null }; },
    };
    return query;
  } };
  const dependencies = {
    "next/server": { NextResponse: { json(body, options = {}) { return { status: options.status ?? 200, body }; } } },
    "@/lib/require-automation": { automationDenied: () => denied },
    "@/lib/supabase/admin": { createAdminClient: () => database },
    "@/lib/telegram-dispatch.mjs": dispatch,
    "@/lib/remote-image.mjs": { remoteImageSrc: value => value },
  };
  const context = { exports: {}, require(name) { assert(name in dependencies); return dependencies[name]; }, process: { env }, AbortSignal,
    fetch: async (url, options) => {
      sends.push({ url, body: JSON.parse(options.body) });
      if (throwNetwork) throw new Error("Network timeout");
      return { status: telegram.ok ? 200 : 403, json: async () => telegram };
    },
  };
  vm.runInNewContext(compiled, context);
  return { get: () => context.exports.GET({}), sends, ledger };
}

const configured = { TELEGRAM_NEWS_BOT_TOKEN: "news-token", TELEGRAM_BOT_TOKEN: "unrelated-token", TELEGRAM_CHANNEL_ID: "@Lajmet383" };

test("dispatcher uses news bot, publishes article link and records once across repeated runs", async () => {
  const api = route({ env: configured });
  const first = await api.get();
  assert.equal(first.status, 200);
  assert.equal(first.body.posted, 1);
  assert.equal(api.sends[0].url, "https://api.telegram.org/botnews-token/sendPhoto");
  assert.match(api.sends[0].body.caption, /Lexo më shumë: https:\/\/383ks\.com\/a\//);
  assert.equal(api.ledger[0].message_id, 61);
  assert.equal((await api.get()).body.posted, 0);
  assert.equal(api.sends.length, 1);
});

test("existing deployments without a news-specific token retain their configured bot", async () => {
  const api = route({ env: { TELEGRAM_BOT_TOKEN: "legacy-token", TELEGRAM_CHANNEL_ID: "@Lajmet383" } });
  assert.equal((await api.get()).status, 200);
  assert.match(api.sends[0].url, /botlegacy-token\//);
});

test("Telegram permission failures are unsuccessful HTTP responses for the scheduler", async () => {
  const api = route({ env: configured, telegram: { ok: false, error_code: 403, description: "Bot not a member" } });
  const response = await api.get();
  assert.equal(response.status, 502);
  assert.equal(response.body.posted, 0);
  assert.equal(response.body.failed[0].error, "Bot not a member");
  assert.equal(api.ledger.length, 0);
});

test("ambiguous network failure does not issue a second send as a photo fallback", async () => {
  const api = route({ env: configured, throwNetwork: true });
  assert.equal((await api.get()).status, 502);
  assert.equal(api.sends.length, 1);
});

test("unconfigured and unauthorized requests cannot report successful publishing", async () => {
  const missing = route();
  assert.equal((await missing.get()).status, 503);
  assert.equal(missing.sends.length, 0);
  const denied = route({ env: configured, denied: { status: 401 } });
  assert.equal((await denied.get()).status, 401);
  assert.equal(denied.sends.length, 0);
});
