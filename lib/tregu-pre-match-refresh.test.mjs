import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildPreMatchReference,
  lineupStatusFromEspn,
  selectCorroboratedPreMatchSources,
  staleRefreshHealth,
  validateGroqPreMatchDecision,
} from "./tregu-pre-match-refresh.mjs";

const sources = [
  { title: "England Argentina preview", summary: "England and Argentina meet with documented team news.", url: "https://www.espn.com/soccer/story/_/id/1/england-argentina-preview" },
  { title: "England Argentina FIFA preview", summary: "FIFA tournament preview for England and Argentina.", url: "https://www.fifa.com/en/tournaments/mens/worldcup/articles/england-argentina-preview" },
];

test("only corroborated reputable discovery links can reach the pre-match model", () => {
  const selected = selectCorroboratedPreMatchSources({ results: [...sources, { title: "Rumour", summary: "England Argentina", url: "https://x.com/example/status/1" }] });
  assert.equal(selected.length, 2);
  assert.equal(selected.every((source) => !source.url.includes("x.com")), true);
});

test("starting lineups are confirmed only when ESPN supplies exactly eleven for each team", () => {
  assert.equal(lineupStatusFromEspn({ starting_lineups: { England: ["A"], Argentina: ["B"] } }).status, "predicted_or_unknown");
  assert.equal(lineupStatusFromEspn({ starting_lineups: { England: Array.from({ length: 11 }, (_, i) => `E${i}`), Argentina: Array.from({ length: 11 }, (_, i) => `A${i}`) } }).status, "confirmed");
});

test("Groq must cite two supplied sources and bounded movement preserves three-way normalization", () => {
  assert.throws(() => validateGroqPreMatchDecision({ material_evidence: true, probabilities: { england: .5, draw: .25, argentina: .25 }, cited_urls: [sources[0].url], reasoning: "A source is not corroboration." }, sources), /two cited/i);
  const decision = validateGroqPreMatchDecision({ material_evidence: true, probabilities: { england: .7, draw: .1, argentina: .2 }, cited_urls: sources.map((source) => source.url), reasoning: "Two independent cited previews supply material, corroborating pre-match evidence." }, sources);
  const reference = buildPreMatchReference({ current: { england: 1 / 3, draw: 1 / 3, argentina: 1 / 3 }, decision, sources, scannedAt: "2026-07-15T18:10:00.000Z", lineup: { status: "predicted_or_unknown" } });
  assert.equal(reference.applied, true);
  assert.ok(Math.abs(Object.values(reference.after).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.equal(reference.after.england <= 1 / 3 + .05 + 1e-12, true);
  assert.equal(staleRefreshHealth(reference.health, new Date("2026-07-15T18:13:59.000Z")).status, "healthy");
  assert.equal(staleRefreshHealth(reference.health, new Date("2026-07-15T18:14:01.000Z")).status, "stale");
});

test("pre-match endpoint, database lock, health card, and runner remain server-side and auditable", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0013_tregu_pre_match_refresh_audit.sql", import.meta.url), "utf8");
  const server = readFileSync(new URL("./tregu-pre-match-refresh-server.ts", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../scripts/run-tregu-argentina-england-refresh.mjs", import.meta.url), "utf8");
  const adminPanel = readFileSync(new URL("../app/admin/tregu/TreguAdminClient.tsx", import.meta.url), "utf8");
  assert.match(sql, /for update/i);
  assert.match(sql, /apply_pre_match_three_outcome_reference/i);
  assert.doesNotMatch(sql.slice(sql.indexOf("apply_pre_match_three_outcome_reference")), /profiles|positions|transactions/i);
  assert.match(server, /groqChat/);
  assert.match(runner, /last30days\.py/);
  assert.match(runner, /argentina-england-refresh/);
  assert.match(adminPanel, /Groq → Google/);
  assert.match(adminPanel, /Tregjet e kontrolluara/);
});
