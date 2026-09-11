import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDailyMarkets, shortlistDailyTopics } from "../lib/tregu-daily-generation.mjs";
import {
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
const dryRun = process.argv.includes("--dry-run");
// Sports discovery runs independently in the two-minute sports worker.
const contextResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers });
if (!contextResponse.ok) throw new Error(`Could not load Codex draft context: ${await contextResponse.text()}`);
const { articles, activeMarkets = [], futureTemplates = [] } = await contextResponse.json();
const now = new Date();

// Stage one of two. Asking for discovery, filtering and the full ten-field contract in
// a single reply made gpt-oss-120b return an empty markets array on every run from
// 2026-08-28 onward. Naming candidate topics is a task it can complete; stage two then
// only has to write contracts for topics that are already vetted. No quality gate moves.
const shortlistPrompt = `You are scanning Kosovo, Albania and world news for prediction-market topics.

From the verified articles below, name 6 to 10 topics whose outcome is genuinely still UNDECIDED and will be settled by a named authority within the next 30 to 90 days.

A topic qualifies only if:
- the article reports a live dispute, upcoming vote, ruling, appointment, threshold or decision — not something already settled;
- an informed person could reasonably disagree today about how it ends;
- it matters to many people (public affairs, household economy, energy, prices, courts, elections, major geopolitics or technology policy);
- at least two DIFFERENT publishers in the supplied articles cover it.

Reject: sport of any kind, routine meetings with no decision, generic announcements, minor crime, celebrity gossip, niche corporate notices, and anything whose outcome the article already establishes.

Do not write market questions. Do not invent facts. Name topics only.
Skip any topic already listed as active below.

Current time: ${now.toISOString()}

Already-active topics to skip:
${JSON.stringify(activeMarkets)}

Verified source articles:
${JSON.stringify(articles)}

Return ONLY compact JSON, no markdown:
{"topics":[{"topic_key":"kebab-case-stable-identity","decision":"the concrete fork in one sentence","yes_path":"...","no_path":"...","resolution_source":"named authority","why_undecided":"...","source_slugs":["slug1","slug2"]}]}`;

const shortlist = await shortlistDailyTopics(shortlistPrompt);
console.log(JSON.stringify({
  stage: "shortlist",
  provider: shortlist.provider,
  fallback_reason: shortlist.fallback_reason,
  topic_count: shortlist.topics.length,
  topic_keys: shortlist.topics.map((topic) => topic?.topic_key ?? null),
}));

const prompt = `You are the 383 Tregu daily market editor for NON-SPORTS markets. Official football and F1 templates are created by a separate verified sports lane; never propose sport markets here.

Stage one already shortlisted the topics listed below from these same verified articles. You are no longer searching for topics: your job is to write the full market contract for those that genuinely qualify. Drop any shortlisted topic that fails a quality rule, and return at most 6. Prefer major Kosovo, Albania and world developments that people widely discuss, with documented 30–90-day decision timelines.

SHORTLISTED TOPICS (write contracts for these):
${JSON.stringify(shortlist.topics)}

MANDATORY MARKET CONTRACT (all fields are required):
- market_archetype: one of scheduled_decision, threshold, data_release, policy_action, appointment_or_selection, escalation_or_deescalation, corporate_decision, executive_action.
- topic_key: a stable lowercase kebab-case identity for the underlying topic, not the date and not a sentence. It must not match any active topic below.
- decision_point: the concrete fork traders are pricing, including the two plausible paths.
- why_uncertain: the current evidence for both paths and what new information could move the price. Do not write generic filler.
- trading_angle: why an informed trader could reasonably disagree today.
- resolution_source: the named institution, official dataset, court, election authority, or other authoritative source that determines the result.
- deadline_basis: why this deadline is tied to a real event/release/decision window, not an arbitrary date.
- resolution_criteria: explicit PO and JO rules, named source, exact deadline, and edge cases such as postponement, partial action, revised data, or no decision.

QUALITY RULES:
1. Use ONLY the supplied verified articles and never invent facts, sources, dates, thresholds, meetings, or outcomes.
2. Prefer high-interest Kosovo/region public affairs, household economy/energy/prices, major geopolitics, major technology policy, courts, elections, or decisions affecting many people. Reject niche corporate news, routine notices, minor crime, obscure logistics, and ordinary celebrity gossip.
3. Do not create a headline restatement. Reject any topic whose supplied source has already established the proposed PO outcome. Do not ask whether an already-reported arrest, signing, meeting, arrival, death, victory, or announcement will be confirmed.
4. Never create meeting-only, generic announcement, generic “will X happen?”, or “will institution confirm what the article says?” markets. A meeting is eligible only when it contains a consequential decision, vote, ruling, appointment, agreement, or measurable outcome.
5. Prefer a real threshold or decision: a named vote/ruling, a measurable public number, a policy taking effect, a selection/appointment, or a clearly defined escalation/de-escalation condition. For threshold/data_release, include the numeric threshold in the question and threshold_value.
6. Write a concise Albanian question ending with ?. Do not mechanically start with A do të. Do not force a date into the title. Set closes_in_hours between 720 and 2160 (30–90 days), based on the documented decision timeline. Do not use closes_in_days.
7. Prefer explicit competing events such as approval versus rejection. For event_pair markets, the date is a review date, not an automatic JO outcome. Neither event verified means pause_for_review. Do not invent a scheduled decision date.
8. Require at least two independent publishers from the supplied articles. Copy source slugs exactly. Name the authoritative resolution source and explain why the topic is widely discussed.
9. Never repeat an active topic or near-identical question. Return fewer than three markets, including zero, when only fewer pass all quality gates.
10. Every market requires contract_version: news-event-v3 and proposition: {entities: [named entities], geography: Kosovo|Albania|World, decision: concrete fork, yes_condition: explicit winning event, no_condition: explicit losing event, resolution_source: named authority, resolution_mode: event_pair|deadline_occurrence, review_policy: pause_for_review}. Event-pair JO must be a real event, not absence of PO by a date.

Good shapes (illustrative only; never copy facts):
- a named parliament/court/central bank decision with two plausible outcomes;
- a public count, price, rate, or threshold that can cross a stated number before the deadline;
- a formal appointment, removal, acquisition, agreement, or escalation whose outcome is still disputed.
Bad shapes: “will the article’s event be confirmed?”, a routine meeting, a generic announcement, or a result that the source has already established.

Current time: ${now.toISOString()}
Active non-sports markets to avoid:
${JSON.stringify(activeMarkets)}

Verified source articles (each includes source, URL, excerpt, and bounded body):
${JSON.stringify(articles)}

Return ONLY compact JSON, with no markdown:
{"markets":[{"question":"...","description":"current state plus the unresolved fork","resolution_criteria":"PO: ... JO: ... Burimi i zgjidhjes: ... Afati: ... Edge cases: ...","category":"politike|ekonomi|bote|te-tjera","contract_version":"news-event-v3","closes_in_hours":1440,"proposition":{"entities":["..."],"geography":"Kosovo","decision":"...","yes_condition":"...","no_condition":"...","resolution_source":"...","resolution_mode":"event_pair","review_policy":"pause_for_review"},"market_archetype":"scheduled_decision|threshold|data_release|policy_action|appointment_or_selection|escalation_or_deescalation|corporate_decision|executive_action","topic_key":"topic-name","decision_point":"...","why_uncertain":"...","trading_angle":"...","resolution_source":"...","deadline_basis":"...","threshold_value":"...","source_slugs":["slug1","slug2"]}]}`;


// An empty shortlist means stage one found nothing undecided worth pricing. That is a
// legitimate outcome, and spending a second provider call to confirm it is waste.
const generation = shortlist.topics.length
  ? await generateDailyMarkets(prompt)
  : { candidates: [], provider: shortlist.provider, fallback_reason: "empty_shortlist" };
const candidates = generation.candidates;
console.log(JSON.stringify({ stage: "generation", provider: generation.provider, fallback_reason: generation.fallback_reason, shortlisted: shortlist.topics.length, candidate_count: candidates.length }));
const submitResponse = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, {
  method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ candidates, ...(dryRun ? { dryRun: true } : {}) }),
});
const result = await submitResponse.json();
if (!submitResponse.ok) throw new Error(result.error ?? "Daily draft submission failed.");
if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    created: 0,
    model_candidate_count: Array.isArray(candidates) ? candidates.length : 0,
    model_candidates: Array.isArray(candidates) ? candidates.map((candidate) => ({
      question: candidate?.question ?? "",
      market_archetype: candidate?.market_archetype ?? null,
      topic_key: candidate?.topic_key ?? null,
      closes_in_hours: candidate?.closes_in_hours ?? null,
    })) : [],
    accepted_count: result.accepted_count ?? (result.markets ?? []).length,
    rejected_count: result.rejected_count ?? (result.rejected ?? []).length,
    no_publish_reason: result.no_publish_reason ?? null,
    accepted: result.markets ?? [],
    rejected: result.rejected ?? [],
  }, null, 2));
  process.exit(0);
}
const receiptMarkerDir = process.env.TREGU_RECEIPT_MARKER_DIR ?? "/opt/data/linear-hermes-bridge/state/tregu-receipts";
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
const sendReceipt = ({ subject, html, markerKey }) => {
  if (!process.argv.includes("--notify")) return;
  mkdirSync(receiptMarkerDir, { recursive: true, mode: 0o700 });
  const safeKey = String(markerKey).replace(/[^A-Za-z0-9_.-]/g, "_");
  const marker = join(receiptMarkerDir, `${safeKey}.sent`);
  if (existsSync(marker)) {
    console.log(`TREGU RECEIPT ALREADY SENT runKey=${result.runKey}`);
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), "tregu-drafts-"));
  const htmlFile = join(directory, "receipt.html");
  try {
    writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 });
    execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", subject, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" });
    writeFileSync(marker, `${new Date().toISOString()}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(`TREGU RECEIPT SENT runKey=${result.runKey} recipient=${TREGU_DRAFT_REVIEW_RECIPIENT}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
};

if (!result.skipped && result.created > 0) {
  const html = buildDraftReviewEmail({ appUrl: baseUrl, reviewPath: `/admin/tregu/review?drafts=${encodeURIComponent(result.runKey)}`, markets: result.markets });
  sendReceipt({ subject: `383 Tregu — ${result.created} draftet e reja — PASSED`, html, markerKey: `${result.runKey}-drafts` });
} else {
  const state = result.skipped ? "SUCCEEDED — already processed safely" : "SUCCEEDED — no new market was eligible";
  const reviewUrl = `${baseUrl}/admin/tregu/review?drafts=${encodeURIComponent(result.runKey ?? "")}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a"><main style="max-width:680px;margin:auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:24px"><h1 style="margin-top:0">383 Tregu — execution receipt</h1><p><strong>Status:</strong> ${escapeHtml(state)}</p><p><strong>Run key:</strong> <code>${escapeHtml(result.runKey)}</code></p><p><strong>Created:</strong> ${escapeHtml(result.created)}</p><p>This confirms that the Tregu creation endpoint ran successfully and did not create duplicates.</p><p><a href="${escapeHtml(reviewUrl)}">Open Tregu review</a></p></main></body></html>`;
  sendReceipt({ subject: `383 Tregu — PASSED — ${result.skipped ? "already processed" : "no eligible drafts"}`, html, markerKey: `${result.runKey}-receipt` });
}
if (process.argv.includes("--notify") && Array.isArray(futureTemplates) && futureTemplates.length) {
  const cards = futureTemplates.map((market) => `<article style="border:1px solid #fed7aa;border-radius:12px;padding:18px;margin:0 0 14px"><p style="margin:0 0 8px;color:#c2410c;font-weight:700;letter-spacing:1px">${String(market.market_classification ?? "LIVE SPORT").toUpperCase()} · REVIEW-ONLY TEMPLATE</p><h2 style="margin:0 0 8px">${String(market.question ?? "F1 race")}</h2><p>${String(market.description ?? "")}</p><p><b>${Array.isArray(market.sport_outcomes) ? market.sport_outcomes.length : 0} drivers</b> · review roster and grid before approval.</p><a href="${baseUrl}/admin/tregu" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:7px;text-decoration:none">Open Admin review</a></article>`).join("");
  const html = `<!doctype html><html><body style="font-family:Arial;background:#fff7ed;padding:24px"><h1>383 Tregu — F1 race awaiting approval</h1>${cards}</body></html>`;
  const directory = mkdtempSync(join(tmpdir(), "tregu-f1-")); const htmlFile = join(directory, "review.html");
  try { writeFileSync(htmlFile, html, { encoding: "utf8", mode: 0o600 }); execFileSync("python3", ["scripts/send-tregu-review-email.py", "--recipient", TREGU_DRAFT_REVIEW_RECIPIENT, "--subject", `383 Tregu — ${futureTemplates.length} F1 template awaiting approval`, "--html-file", htmlFile], { cwd: process.cwd(), stdio: "inherit" }); const mark = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { method:"POST", headers:{...headers,"content-type":"application/json"}, body:JSON.stringify({ markTemplateIds:futureTemplates.map((m)=>m.id) }) }); if(!mark.ok) throw new Error(`Could not mark F1 template email: ${await mark.text()}`); } finally { rmSync(directory,{recursive:true,force:true}); }
}
console.log(JSON.stringify({ ok: true, skipped: result.skipped, created: result.created, runKey: result.runKey }));
