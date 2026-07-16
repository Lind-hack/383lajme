import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDailyCodexCommand,
  buildDraftReviewEmail,
  buildExactFourDraftPreview,
  buildLiveEventDraftSubmission,
  TREGU_DRAFT_REVIEW_RECIPIENT,
} from "../lib/tregu-automation.mjs";
import { fetchEspnLiveEvents } from "../lib/espn-live-score.mjs";

const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
if (!baseUrl || !secret) {
  console.error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");
  process.exit(1);
}

const headers = { authorization: `Bearer ${secret}` };
const contextResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers });
if (!contextResponse.ok) throw new Error(`Could not load verified draft context: ${await contextResponse.text()}`);
const { articles } = await contextResponse.json();
const [event] = await fetchEspnLiveEvents([{ provider: "espn", event_id: "760514", league: "fifa.world" }]);
if (event.status === "STATUS_FINAL") throw new Error("Spain-France is already final; no live-event draft preview is valid.");

const prompt = `You are the 383 Tregu daily market editor. From ONLY these verified source articles, return exactly THREE unique Albanian binary PO/JO draft markets; the official Spain-France live market is added separately. Use short Polymarket-style titles that never begin with "A do të", each ending in "?" and containing a concrete "deri më <day> <month>" deadline. Each market must cite only supplied source slugs, include a concrete authoritative resolution criterion, and use closes_in_hours from 2 to 48. Return ONLY compact JSON: {"markets":[{"question":"...","description":"...","resolution_criteria":"Zgjidhet sipas ... deri më ...","category":"politike|ekonomi|sport|bote|te-tjera","closes_in_hours":12,"source_slugs":["..."]}]}. No markdown.\n\nVerified articles:\n${JSON.stringify(articles)}`;
const output = execFileSync("hermes", buildDailyCodexCommand(prompt), { cwd: process.cwd(), encoding: "utf8", maxBuffer: 1024 * 1024 });
const parsed = JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
const newsCandidates = Array.isArray(parsed) ? parsed : parsed.markets;
const preview = buildExactFourDraftPreview({ candidates: newsCandidates, articles, event, now: new Date() });
if (preview.candidates.length !== 4) throw new Error("Preview must contain exactly four candidates.");
const submission = buildLiveEventDraftSubmission({ candidates: preview.candidates, args: process.argv.slice(2), now: new Date() });

const response = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, {
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify(submission.body),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error ?? (submission.apply ? "Draft submission failed." : "No-write draft preview failed."));

if (!submission.apply) {
  if (result.created !== 0 || result.markets?.length !== 4) throw new Error("Preview did not remain a no-write, exactly-four result.");
  console.log(JSON.stringify({ ok: true, preview: true, created: 0, cards: result.markets }, null, 2));
} else {
  if (!result.skipped && (result.created !== 4 || result.markets?.length !== 4)) {
    throw new Error("Applied run did not create exactly four review-only draft cards.");
  }
  if (!result.skipped && result.created > 0) {
    const html = buildDraftReviewEmail({ appUrl: baseUrl, reviewPath: `/admin/tregu/review?drafts=${encodeURIComponent(result.runKey)}`, markets: result.markets });
    const directory = mkdtempSync(join(tmpdir(), "tregu-live-event-drafts-"));
    const htmlFile = join(directory, "review.html");
    try {
      writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 });
      execFileSync("python3", ["scripts/codex_automation_support.py", "send-html-report", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", `383 Tregu — ${result.created} draftet e reja`, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  console.log(JSON.stringify({ ok: true, preview: false, skipped: result.skipped, created: result.created, runKey: result.runKey }, null, 2));
}
