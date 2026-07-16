import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDailyCodexCommand,
  buildDraftReviewEmail,
  TREGU_DRAFT_REVIEW_RECIPIENT,
} from "../lib/tregu-automation.mjs";

const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
if (!baseUrl || !secret) {
  console.error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");
  process.exit(1);
}

const headers = { authorization: `Bearer ${secret}` };
const contextResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers });
if (!contextResponse.ok) throw new Error(`Could not load Codex draft context: ${await contextResponse.text()}`);
const { articles } = await contextResponse.json();
const prompt = `You are the 383 Tregu daily market editor. From ONLY these verified source articles, propose exactly 3 to 5 unique Albanian binary PO/JO markets. Favor distinctive Kosovo, world, and sports controversies or live developments; do not produce generic evergreen questions. Use short, Polymarket-style titles that never mechanically begin with "A do të". Every title must include a concrete "deri më <day> <month>" deadline and end in "?". Every market must include explicit resolution criteria naming the authoritative source and deadline. Breaking-news and controversy markets must use closes_in_hours from 2 to 48. Cite only supplied source slugs. Example: "Ngushtica e Hormuzit rihapet deri më 20 korrik?". Return ONLY compact JSON: {"markets":[{"question":"...","description":"...","resolution_criteria":"Zgjidhet sipas ... deri më ...","category":"politike|ekonomi|sport|bote|te-tjera","closes_in_hours":12,"source_slugs":["..."]}]}. No markdown.\n\nVerified articles:\n${JSON.stringify(articles)}`;

// Cron has a minimal PATH. Use the installed VPS launcher unless an operator
// explicitly supplies a different Hermes binary. The command pins the supported
// Codex OAuth provider so a fresh child cannot fall back to an ambient xAI key.
const hermesBin = process.env.HERMES_BIN ?? "/opt/hermes/.venv/bin/hermes";
const hermesHome = process.env.HERMES_HOME ?? "/opt/data";
const output = execFileSync(hermesBin, buildDailyCodexCommand(prompt), {
  cwd: process.cwd(), env: { ...process.env, HERMES_HOME: hermesHome }, encoding: "utf8", maxBuffer: 1024 * 1024,
});
const json = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
const parsed = JSON.parse(json);
const candidates = Array.isArray(parsed) ? parsed : parsed.markets;
const submitResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, {
  method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ candidates }),
});
const result = await submitResponse.json();
if (!submitResponse.ok) throw new Error(result.error ?? "Daily draft submission failed.");
if (!result.skipped && result.created > 0) {
  const html = buildDraftReviewEmail({ appUrl: baseUrl, reviewPath: `/admin/tregu/review?drafts=${encodeURIComponent(result.runKey)}`, markets: result.markets });
  const directory = mkdtempSync(join(tmpdir(), "tregu-drafts-"));
  const htmlFile = join(directory, "review.html");
  try {
    writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 });
    execFileSync("python3", ["scripts/codex_automation_support.py", "send-html-report", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", `383 Tregu — ${result.created} draftet e reja`, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ ok: true, skipped: result.skipped, created: result.created, runKey: result.runKey }));
