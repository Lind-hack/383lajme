import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildTreguRepriceEmail, hasEvidenceBackedRepriceChanges } from "./tregu-live-email-content.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("tregu-live cron endpoint requires a bearer secret, invokes the five-minute AI repricer, and records a distinct heartbeat", () => {
  const route = source("app/api/cron/update-markets/route.ts");
  const server = source("lib/tregu-automation-server.ts");

  assert.match(route, /isAutomationAuthorized/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /runTreguLiveAutomation/);
  assert.doesNotMatch(route, /status:\s*410/);
  assert.match(server, /tregu_live/);
  assert.match(server, /tregu-live:/);
  assert.match(server, /runNewsReprice\("tregu_live", fiveMinuteRunKey\(now\), now\)/);
  assert.match(server, /runNewsReprice\("reprice", twoMinuteRunKey\(now\), now\)/);
  assert.doesNotMatch(route, /runLiveSportsAutomation|runOfficialSportsRefresh/);
});

test("tregu-live uses an explicit migration allowlist and emails only verified AI market changes", () => {
  const migration = source("supabase/migrations/0018_tregu_live_heartbeat.sql");
  const server = source("lib/tregu-automation-server.ts");
  const route = source("app/api/cron/update-markets/route.ts");
  const mailer = source("lib/tregu-live-email.ts");

  assert.match(migration, /check \(action in \('daily_drafts', 'reprice', 'live_sports', 'pre_match_refresh', 'tregu_live'\)\)/i);
  assert.doesNotMatch(migration, /\*/);
  assert.match(server, /updates_applied/);
  assert.match(server, /no_change/);
  assert.match(route, /sendTreguLiveNotification/);
  assert.match(route, /hasEvidenceBackedRepriceChanges/);
  assert.match(mailer, /GMAIL_USER/);
  assert.match(mailer, /GMAIL_APP_PASSWORD/);
  assert.match(mailer, /TREGU_LIVE_RECIPIENT/);
  assert.match(mailer, /news_update/);
  assert.doesNotMatch(mailer, /official_update|kind === "failed"/);
  assert.doesNotMatch(mailer, /console\.(?:log|error).*GMAIL_APP_PASSWORD/);
});

test("reprice email composes every required evidence-backed market change in one payload", () => {
  const message = buildTreguRepriceEmail({
    runKey: "tregu-live:2026-07-16T10:00:00.000Z",
    changes: [{
      question: "Ngushtica e Hormuzit rihapet deri më 20 korrik?",
      slug: "hormuz-hapet",
      provider: "groq",
      before_probability: 0.5,
      after_probability: 0.52,
      absolute_percentage_point_change: 0.02,
      timestamp: "2026-07-16T10:01:03.000Z",
      verified_sources: [{ label: "Reuters", title: "Iran talks support reopening", slug: "iran-talks", url: "https://www.reuters.com/example" }],
    }],
  });

  assert.match(message.subject, /1 evidence-backed market update/);
  assert.match(message.text, /Ngushtica e Hormuzit/);
  assert.match(message.text, /hormuz-hapet — https:\/\/383ks\.com\/tregu\/hormuz-hapet/);
  assert.match(message.text, /Provider: groq/);
  assert.match(message.text, /PO — 50\.00% → 52\.00% \(\+2\.00 pp\)/);
  assert.match(message.text, /2026-07-16T10:01:03\.000Z/);
  assert.match(message.text, /Reuters: Iran talks support reopening — https:\/\/www\.reuters\.com\/example/);
  assert.match(message.text, /Evidence-backed news update/);
});

test("no email is eligible for skipped, no-evidence, no-change, fallback-only, closed, or failed runs", () => {
  for (const result of [
    { skipped: true, email_updates: [{ slug: "already-sent" }] },
    { skipped: false, email_updates: [] },
    { skipped: false, updates_applied: 0, provider_used: ["gemini"], fallback_index: 1 },
    { skipped: false, results: [{ status: "no_fresh_evidence" }] },
    { skipped: false, results: [{ status: "no_change" }] },
    { skipped: false, results: [{ status: "skipped_closed" }] },
    { skipped: false, results: [{ status: "oracle_failed" }] },
  ]) assert.equal(hasEvidenceBackedRepriceChanges(result), false);
});

test("Tregu admin health returns distinct LLM and tregu-live heartbeat state and the client keeps a visible error card while polling", () => {
  const health = source("app/api/admin/tregu/health/route.ts");
  const client = source("app/admin/tregu/TreguAdminClient.tsx");

  assert.match(health, /llm_refresh/);
  assert.match(health, /tregu_live/);
  assert.match(client, /setInterval/);
  assert.match(client, /30_000/);
  assert.match(client, /healthError/);
  assert.match(client, /tregu_live/);
});
