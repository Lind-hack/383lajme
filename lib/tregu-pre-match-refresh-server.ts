import { createAdminClient } from "@/lib/supabase/admin";
import { groqChat, parseJSON } from "@/lib/groq";
import { normalizeEspnSummary, sportOutcomePrices } from "@/lib/tregu-sport-market.mjs";
import {
  EVENT_ID,
  MARKET_SLUG,
  buildPreMatchReference,
  lineupStatusFromEspn,
  selectCorroboratedPreMatchSources,
  validateGroqPreMatchDecision,
} from "@/lib/tregu-pre-match-refresh.mjs";

const ESPN_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${EVENT_ID}`;

type Discovery = { generated_at?: string; source_status?: Record<string, string>; results?: unknown[] };
type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function runKey(now: Date) {
  return `pre-match-refresh:${new Date(Math.floor(now.getTime() / 120_000) * 120_000).toISOString()}`;
}

async function beginRun(admin: AdminClient, key: string) {
  const { data: existing, error: existingError } = await admin.from("market_automation_runs").select("id, status, details, error").eq("run_key", key).maybeSingle();
  if (existingError) throw new Error(`Could not check pre-match refresh idempotency: ${existingError.message}`);
  if (existing) return { existing: true, run: existing };
  const { data, error } = await admin.from("market_automation_runs").insert({ run_key: key, action: "pre_match_refresh", status: "running" }).select("id").single();
  if (error) throw new Error(`Could not start pre-match refresh audit: ${error.message}`);
  return { existing: false, run: data };
}

async function finishRun(admin: AdminClient, id: string, status: "succeeded" | "failed", details: unknown, error?: string) {
  const { error: updateError } = await admin.from("market_automation_runs").update({ status, details, error: error ?? null, finished_at: new Date().toISOString() }).eq("id", id);
  if (updateError) throw new Error(`Could not finalize pre-match refresh audit: ${updateError.message}`);
}

async function recordScan(admin: AdminClient, marketId: string, health: Record<string, unknown>, scan: Record<string, unknown>) {
  const { error } = await admin.rpc("record_pre_match_market_scan", { p_market_id: marketId, p_health: health, p_scan: scan });
  if (error) throw new Error(`Could not record pre-match scan: ${error.message}`);
}

export async function runArgentinaEnglandPreMatchRefresh(discovery: Discovery = {}, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for pre-match refresh.");
  const key = runKey(now);
  const started = await beginRun(admin, key);
  if (started.existing) return { ok: true, skipped: true, runKey: key, reason: "already_processed", run: started.run };

  try {
    const { data: market, error: marketError } = await admin.from("markets").select("*").eq("slug", MARKET_SLUG).eq("status", "open").maybeSingle();
    if (marketError) throw new Error(`Could not load England–Argentina market: ${marketError.message}`);
    if (!market) {
      const details = { slug: MARKET_SLUG, scan_status: "market_not_open", movement_applied: false };
      await finishRun(admin, started.run.id, "succeeded", details);
      return { ok: true, skipped: false, runKey: key, ...details };
    }

    const response = await fetch(ESPN_URL, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Official ESPN event ${EVENT_ID} returned ${response.status}.`);
    const event = normalizeEspnSummary({ provider: "espn", event_id: EVENT_ID, league: "fifa.world", sport: "soccer" }, await response.json(), now);
    const lineup = lineupStatusFromEspn(event);
    const sources = selectCorroboratedPreMatchSources(discovery);
    const scanAt = now.toISOString();
    const scan = {
      scanned_at: scanAt,
      espn_source_url: ESPN_URL,
      espn_status: event.status,
      lineup,
      discovery_generated_at: discovery.generated_at ?? null,
      discovery_source_status: discovery.source_status ?? {},
      eligible_sources: sources,
    };

    if (sources.length < 2) {
      const health = { status: "healthy", active: true, last_successful_scan_at: scanAt, last_successful_groq_scan_at: null, evidence_status: "insufficient", lineup_status: lineup.status };
      await recordScan(admin, market.id, health, scan);
      const details = { slug: MARKET_SLUG, scan_status: "insufficient_evidence", movement_applied: false, source_count: sources.length, lineup_status: lineup.status, health };
      await finishRun(admin, started.run.id, "succeeded", details);
      return { ok: true, skipped: false, runKey: key, ...details };
    }

    const raw = await groqChat(
      "You are a conservative football pre-match reference analyst. Return JSON only. Use only the supplied cited source excerpts. Do not invent injuries, form, odds, lineups, controversies, or facts. Mark material_evidence false unless at least two supplied independent sources contain match-relevant, corroborating evidence. Do not infer starting lineups; ESPN lineup status is supplied separately.",
      JSON.stringify({
        match: "England vs Argentina, full-time three outcome, 15 July 2026",
        official_espn: { url: ESPN_URL, status: event.status, detail: event.detail, lineup_status: lineup.status },
        sources,
        required_json: { material_evidence: "boolean", probabilities: { england: "number", draw: "number", argentina: "number" }, cited_urls: ["exact URLs from sources"], reasoning: "short cited-only explanation" },
      }),
      { json: true, maxTokens: 700 },
    );
    const decision = validateGroqPreMatchDecision(parseJSON<Record<string, unknown>>(raw), sources);
    const current = market.reference_probabilities ?? sportOutcomePrices(market);
    const reference = buildPreMatchReference({ current, decision, sources, scannedAt: scanAt, lineup });
    const health = { ...reference.health, last_successful_groq_scan_at: scanAt };

    if (!reference.applied) {
      await recordScan(admin, market.id, health, { ...scan, groq_decision: { applied: false, reason: decision.reason, citations: decision.citations } });
      const details = { slug: MARKET_SLUG, scan_status: "no_material_evidence", movement_applied: false, before: reference.before, after: reference.after, sources: reference.evidence ?? [], lineup_status: lineup.status, health };
      await finishRun(admin, started.run.id, "succeeded", details);
      return { ok: true, skipped: false, runKey: key, ...details };
    }

    const { error: applyError } = await admin.rpc("apply_pre_match_three_outcome_reference", {
      p_market_id: market.id,
      p_reference_probabilities: reference.after,
      p_evidence: reference.evidence,
      p_reasoning: reference.reasoning,
      p_requested_cap: reference.cap,
      p_health: health,
      p_scan: scan,
    });
    if (applyError) throw new Error(`Could not apply pre-match reference: ${applyError.message}`);
    const details = { slug: MARKET_SLUG, scan_status: "material_evidence", movement_applied: true, before: reference.before, after: reference.after, cap: reference.cap, reasoning: reference.reasoning, sources: reference.evidence, lineup_status: lineup.status, health };
    await finishRun(admin, started.run.id, "succeeded", details);
    return { ok: true, skipped: false, runKey: key, ...details };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await finishRun(admin, started.run.id, "failed", {}, message);
    throw error;
  }
}
