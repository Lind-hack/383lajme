import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildArgentinaSpainLiveEmail, buildTreguRepriceEmail, hasEvidenceBackedRepriceChanges, hasPersistedMaterialPairedBinaryChange } from "./tregu-live-email-content.mjs";

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

test("Argentina–Spain email is eligible only for a successful persisted material paired-binary update and attributes ESPN with Flashscore only as supplemental", () => {
  const update = {
    persisted: true,
    material_change: true,
    timestamp: "2026-07-19T19:30:00.000Z",
    state: {
      status: "STATUS_IN_PROGRESS",
      detail: "63'",
      competitors: [{ team: "Argentina", score: 0 }, { team: "Spain", score: 1 }],
      metrics: { Argentina: { shots: 3 }, Spain: { shots: 8, xg: 1.21 } },
      metric_sources: { Argentina: { shots: "espn" }, Spain: { shots: "espn", xg: "flashscore" } },
      source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760517",
      supplemental: { flashscore: { source_url: "https://www.flashscore.com/match/UgbUKPmT/", availability: "available" } },
    },
  };
  assert.equal(hasPersistedMaterialPairedBinaryChange({ skipped: false, paired_binary_email_updates: [update] }), true);
  for (const result of [
    { skipped: true, paired_binary_email_updates: [update] },
    { skipped: false, paired_binary_email_updates: [] },
    { skipped: false, paired_binary_email_updates: [{ ...update, persisted: false }] },
    { skipped: false, paired_binary_email_updates: [{ ...update, material_change: false }] },
  ]) assert.equal(hasPersistedMaterialPairedBinaryChange(result), false);

  const message = buildArgentinaSpainLiveEmail({ runKey: "live-sports:2026-07-19T19:30:00.000Z", changes: [update] });
  assert.match(message.subject, /Argentina.*Spain.*live update/i);
  assert.match(message.text, /ESPN official score source/i);
  assert.match(message.text, /Argentina 0–1 Spain/);
  assert.match(message.text, /Flashscore supplemental live metric source/i);
  assert.match(message.text, /xG: 1\.21/);
  assert.match(message.html, /ESPN/);
  assert.match(message.html, /Flashscore/);
});

test("Argentina–Spain live mailer is invoked only after the paired-binary RPC succeeds without a no-persistence result and the run audit succeeds", () => {
  const server = source("lib/tregu-automation-server.ts");
  const mailer = source("lib/tregu-live-email.ts");
  const pairMigration = source("supabase/migrations/0022_tregu_argentina_spain_paired_binary_email_result.sql");
  assert.match(server, /pairOracleResult\s*===\s*false/);
  assert.match(server, /material_change/);
  assert.match(server, /await finishRun\(admin, started\.run\.id, "succeeded", details\);[\s\S]*sendTreguLiveNotification\(\{ kind: "paired_binary_live_update"/);
  assert.match(mailer, /paired_binary_live_update/);
  assert.match(pairMigration, /returns boolean/i);
  assert.match(pairMigration, /return false/i);
  assert.match(pairMigration, /return true/i);
});

test("Tregu admin health reports the active five-minute AI stream and the active official sports stream without showing retired LLM work as live", () => {
  const health = source("app/api/admin/tregu/health/route.ts");
  const client = source("app/admin/tregu/TreguAdminClient.tsx");

  assert.match(health, /sports_refresh/);
  assert.match(health, /live_sports/);
  assert.match(health, /tregu_live/);
  assert.doesNotMatch(health, /llm_refresh/);
  assert.match(client, /Procesori zyrtar sportiv \(2 min\)/);
  assert.match(client, /setInterval/);
  assert.match(client, /30_000/);
  assert.match(client, /healthError/);
  assert.match(client, /tregu_live/);
});


test("movement email is a readable styled report with linked verified evidence instead of a plain-text dump", () => {
  const message = buildTreguRepriceEmail({
    runKey: "tregu-live:2026-07-16T10:00:00.000Z",
    changes: [{
      question: "A do të ndodhë shembulli?",
      slug: "shembull-tregu",
      provider: "groq",
      before_probability: 0.41,
      after_probability: 0.57,
      absolute_percentage_point_change: 0.16,
      timestamp: "2026-07-16T10:01:03.000Z",
      verified_sources: [{ label: "Reuters", title: "Titulli i burimit", slug: "burimi", url: "https://www.reuters.com/example" }],
    }],
  });

  assert.match(message.html, /role="article"/);
  assert.match(message.html, /Ndryshim i verifikuar/i);
  assert.match(message.html, /41\.00%/);
  assert.match(message.html, /57\.00%/);
  assert.match(message.html, /href="https:\/\/383ks\.com\/tregu\/shembull-tregu"/);
  assert.match(message.html, /href="https:\/\/www\.reuters\.com\/example"/);
  assert.doesNotMatch(message.html, /<pre/i);
});

test("admin health exposes recent scanned markets and applied probability changes", () => {
  const health = source("app/api/admin/tregu/health/route.ts");
  const client = source("app/admin/tregu/TreguAdminClient.tsx");

  assert.match(health, /recent_market_activity/);
  assert.match(health, /before_probability/);
  assert.match(health, /after_probability/);
  assert.match(client, /Tregjet e kontrolluara/);
  assert.match(client, /Ndryshimet e aplikuara/);
  assert.match(client, /recent_market_activity/);
});
