import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildDraftReviewEmail, TREGU_DRAFT_REVIEW_RECIPIENT } from "../lib/tregu-automation.mjs";

const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const today = new Date().toISOString().slice(0, 10);
const { data: drafts, error } = await supabase.from("markets").select("*").eq("status", "draft").eq("market_classification", "general_news").gte("created_at", `${today}T00:00:00.000Z`).order("created_at");
if (error) throw new Error(error.message);
const futureResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers: { authorization: `Bearer ${secret}` } });
if (!futureResponse.ok) throw new Error(await futureResponse.text());
const { futureTemplates = [] } = await futureResponse.json();
function send(subject, html) {
  const directory = mkdtempSync(join(tmpdir(), "tregu-review-"));
  const htmlFile = join(directory, "review.html");
  try { writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 }); execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", subject, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" }); } finally { rmSync(directory, { recursive: true, force: true }); }
}
if (drafts?.length) send(`383 Tregu — ${drafts.length} draftet e reja`, buildDraftReviewEmail({ appUrl: baseUrl, reviewPath: "/admin/tregu/review?drafts=daily-drafts-2026-08-04", markets: drafts }));
if (futureTemplates.length) {
  const cards = futureTemplates.map((market) => `<article style="border:1px solid #fed7aa;border-radius:12px;padding:18px;margin:0 0 14px"><p style="margin:0 0 8px;color:#c2410c;font-weight:700;letter-spacing:1px">${String(market.market_classification ?? "SPORT").toUpperCase()} · REVIEW-ONLY TEMPLATE</p><h2 style="margin:0 0 8px">${String(market.question ?? "Sport event")}</h2><p>${String(market.description ?? "")}</p><p><b>${Array.isArray(market.sport_outcomes) ? market.sport_outcomes.length : 0} outcomes</b> · review roster, grid, and kickoff before approval.</p><a href="${baseUrl}/admin/tregu" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:7px;text-decoration:none">Open Admin review</a></article>`).join("");
  send(`383 Tregu — ${futureTemplates.length} F1/football templates awaiting approval`, `<!doctype html><html><body style="font-family:Arial;background:#fff7ed;padding:24px"><h1>383 Tregu — upcoming F1/football templates awaiting approval</h1>${cards}</body></html>`);
  writeFileSync("tmp/future-template-ids.json", JSON.stringify({ markTemplateIds: futureTemplates.map((market) => market.id) }));
}
console.log(JSON.stringify({ dailyDrafts: drafts?.length ?? 0, futureTemplates: futureTemplates.length }));
