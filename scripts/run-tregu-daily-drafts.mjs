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
// 07:20 is the sole creation window: discover verified F1/football fixtures within 72h,
// persist review-only template trades, then load all drafts for the consolidated email.
const sportsResponse = await fetch(`${baseUrl}/api/automation/tregu/upcoming-sports`, { method: "POST", headers });
if (!sportsResponse.ok) throw new Error(`Could not create upcoming sport templates: ${await sportsResponse.text()}`);
const contextResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers });
if (!contextResponse.ok) throw new Error(`Could not load Codex draft context: ${await contextResponse.text()}`);
const { articles, futureTemplates = [] } = await contextResponse.json();
const prompt = `You are the 383 Tregu daily market editor for NON-SPORTS markets. Official football and F1 templates are created by a separate verified sports lane; do not propose sport markets here.

Use ONLY the supplied verified source articles. Propose 3 to 5 unique Albanian binary PO/JO markets only when they are broad, recognizable and likely to matter to a Kosovo audience. The priority order is: (1) major Kosovo or Kosovo-relevant domestic developments such as government/parliament power struggles, protests, arrests, courts, public safety, major fires/disasters, prices/energy, Kosovo–Serbia/KFOR/security events; (2) major world drama such as wars, Gaza/Iran/Ukraine, Trump/US/China/EU/NATO power moves, major sanctions/tariffs/oil shocks, mass evacuations/deaths, or globally recognized scandals; (3) a globally famous public figure or institution only when the supplied source documents a genuinely consequential breaking development.

Reject niche or boring material: minor municipal/project announcements, routine official notices, obscure legal or technical disputes, narrow military logistics, small company acquisitions, minor finance/crypto/AI updates, lower-tier crime, obscure foreign local stories, and ordinary sports/transfer news. Do not turn a niche article into a market merely because it has a deadline. Every accepted market must be understandable to a general Kosovo reader without specialist knowledge, with a concrete event and an authoritative resolution source.

The batch must contain at least one Kosovo/Kosovo-relevant public-interest market and at least one major-world public-interest market when the supplied inventory supports them. If 3 high-recognition non-sport markets or that Kosovo/world mix cannot be supported by the supplied evidence, return {"markets":[]} rather than filling the batch with niche topics. Never invent facts, sources, outcomes or deadlines. Use short Polymarket-style titles that never mechanically begin with "A do të". Every title must include a concrete "deri më <day> <month>" deadline and end in "?". Every market must include explicit resolution criteria naming the authoritative source and deadline. Use breaking windows of 6–168 hours and scheduled-event windows of 2–7 days. Cite only supplied source slugs. Return ONLY compact JSON: {"markets":[{"question":"...","description":"...","resolution_criteria":"Zgjidhet sipas ... deri më ...","category":"politike|ekonomi|bote|te-tjera","closes_in_hours":12,"source_slugs":["..."]}]}. No markdown.

Verified articles:
${JSON.stringify(articles)}`;

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
    execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", `383 Tregu — ${result.created} draftet e reja`, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
if (Array.isArray(futureTemplates) && futureTemplates.length) {
  const cards = futureTemplates.map((market) => `<article style="border:1px solid #fed7aa;border-radius:12px;padding:18px;margin:0 0 14px"><p style="margin:0 0 8px;color:#c2410c;font-weight:700;letter-spacing:1px">${String(market.market_classification ?? "LIVE SPORT").toUpperCase()} · REVIEW-ONLY TEMPLATE</p><h2 style="margin:0 0 8px">${String(market.question ?? "F1 race")}</h2><p>${String(market.description ?? "")}</p><p><b>${Array.isArray(market.sport_outcomes) ? market.sport_outcomes.length : 0} drivers</b> · review roster and grid before approval.</p><a href="${baseUrl}/admin/tregu" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:7px;text-decoration:none">Open Admin review</a></article>`).join("");
  const html = `<!doctype html><html><body style="font-family:Arial;background:#fff7ed;padding:24px"><h1>383 Tregu — F1 race awaiting approval</h1>${cards}</body></html>`;
  const directory = mkdtempSync(join(tmpdir(), "tregu-f1-")); const htmlFile = join(directory, "review.html");
  try { writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 }); execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", `383 Tregu — ${futureTemplates.length} F1 template awaiting approval`, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" }); const mark = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { method:"POST", headers:{...headers,"content-type":"application/json"}, body:JSON.stringify({ markTemplateIds:futureTemplates.map((m)=>m.id) }) }); if(!mark.ok) throw new Error(`Could not mark F1 template email: ${await mark.text()}`); } finally { rmSync(directory,{recursive:true,force:true}); }
}
console.log(JSON.stringify({ ok: true, skipped: result.skipped, created: result.created, runKey: result.runKey }));
