import { getArticles, getLatestArticles } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreMarketWithAI, slugifyQuestion, type Market } from "@/lib/tregu";
import { buildDailyDraftPlan, buildLiveEventDraftRunKey, buildRepricePlan, dailyDraftPublicationReason, evidenceIdentity, isEligibleNewsDeadlineMarket, newsDeadlineAction, newsDeadlineDecayCap, NEWS_DEADLINE_DECAY_INTERVAL_MS, repriceMarketSkipReason, validateDailyDraftSubmission } from "@/lib/tregu-automation.mjs";
import { kosovoLocalDate } from "@/lib/tregu-date-key.mjs";
import { fetchEspnLiveEvents } from "@/lib/espn-live-score.mjs";
import { ARGENTINA_SPAIN_PAIR, buildArgentinaSpainPairedBinaryPlan, buildSportMarketPlan } from "@/lib/tregu-sport-market.mjs";
import { buildF1MarketPlan, buildF1RaceWinnerPlan, buildF1SettlementPlan, openF1ToWinnerLeaderboard } from "@/lib/f1-live-lite.mjs";
import { fetchOpenF1LiveRace } from "@/lib/openf1-live.mjs";
import { classifyProviderFailure } from "@/lib/tregu-ai-provider.mjs";
import { DAILY_MARKET_CONTRACT_VERSION } from "@/lib/tregu-daily-market-quality.mjs";
import { hasPersistedMaterialPairedBinaryChange } from "@/lib/tregu-live-email-content.mjs";
import { sendTreguLiveNotification } from "@/lib/tregu-live-email";
import { f1DriverHeadshot, f1TeamColor } from "@/lib/f1-driver-presentation";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type RunAction = "daily_drafts" | "reprice" | "live_sports" | "tregu_live" | "pre_match_refresh";

function oneMinuteRunKey(now: Date): string {
  const bucket = Math.floor(now.getTime() / 60_000) * 60_000;
  return `live-sports:${new Date(bucket).toISOString()}`;
}

function twoMinuteRunKey(now: Date): string {
  const bucket = Math.floor(now.getTime() / 120_000) * 120_000;
  return `reprice:${new Date(bucket).toISOString()}`;
}

/** Stable readback payload: notifications are based on persisted before/after market state, never merely a successful RPC. */
function officialMarketNotificationState(market: any) {
  const b = Number(market?.b);
  const qYes = Number(market?.q_yes);
  const qNo = Number(market?.q_no);
  const binaryPrice = Number.isFinite(b) && b > 0 && Number.isFinite(qYes) && Number.isFinite(qNo)
    ? Math.exp(qYes / b) / (Math.exp(qYes / b) + Math.exp(qNo / b)) : null;
  return {
    status: String(market?.status ?? "unknown"), outcome: market?.outcome ?? null,
    live_state_key: market?.live_score_state?.key ?? null,
    price_yes: binaryPrice,
    reference_probabilities: market?.reference_probabilities ?? null,
    outcome_quantities: market?.outcome_quantities ?? null,
    competitors: Array.isArray(market?.live_score_state?.competitors) ? market.live_score_state.competitors : [],
    sport_outcomes: Array.isArray(market?.sport_outcomes) ? market.sport_outcomes : [],
  };
}

function didOfficialMarketStateChange(before: Record<string, unknown>, after: Record<string, unknown>) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function readPersistedMarketGraph(admin: AdminClient, marketId: string) {
  const { data, error } = await admin.from("market_snapshots")
    .select("created_at,market_prob,reference_probability,evidence,oracle_kind")
    .eq("market_id", marketId)
    .order("created_at", { ascending: true })
    .limit(180);
  if (error) {
    console.error(`Could not read persisted graph for ${marketId}:`, error.message);
    return { points: [], series: {}, error: error.message };
  }
  const points: Array<{ timestamp: string; probability: number; kind?: string }> = [];
  const series = new Map<string, Array<{ timestamp: string; probability: number; kind?: string }>>();
  for (const row of data ?? []) {
    const timestamp = String(row.created_at ?? "");
    const probability = Number(row.market_prob);
    if (timestamp && Number.isFinite(probability)) points.push({ timestamp, probability, kind: row.oracle_kind ?? undefined });
    const evidence = Array.isArray(row.evidence) ? row.evidence : [];
    const refs = evidence[0]?.probabilities && typeof evidence[0].probabilities === "object" ? evidence[0].probabilities : null;
    if (refs) for (const [key, value] of Object.entries(refs)) {
      const point = { timestamp, probability: Number(value), kind: row.oracle_kind ?? undefined };
      if (timestamp && Number.isFinite(point.probability)) {
        const rows = series.get(key) ?? [];
        rows.push(point);
        series.set(key, rows);
      }
    }
  }
  const dedupe = (rows: Array<{ timestamp: string; probability: number; kind?: string }>) => [...new Map(rows.map((row) => [`${row.timestamp}:${row.probability}`, row])).values()];
  return { points: dedupe(points), series: Object.fromEntries([...series.entries()].map(([key, rows]) => [key, dedupe(rows)])) };
}

function fiveMinuteRunKey(now: Date): string {
  const bucket = Math.floor(now.getTime() / 300_000) * 300_000;
  return `tregu-live:${new Date(bucket).toISOString()}`;
}

const STALE_RUN_AFTER_MS = 30 * 60 * 1000;

async function beginRun(admin: AdminClient, action: RunAction, runKey: string) {
  const { data: existing, error: findError } = await admin
    .from("market_automation_runs")
    .select("id, status, details, error, started_at, finished_at")
    .eq("run_key", runKey)
    .maybeSingle();
  if (findError) throw new Error(`Could not check automation idempotency: ${findError.message}`);
  if (existing) {
    const age = Date.now() - Date.parse(String(existing.started_at ?? ""));
    if (existing.status === "running" && Number.isFinite(age) && age > STALE_RUN_AFTER_MS) {
      const { data: reconciled, error: reconcileError } = await admin
        .from("market_automation_runs")
        .update({ status: "failed", error: "stale_run_reconciled", finished_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("status", "running")
        .select("id, status, details, error, started_at, finished_at")
        .maybeSingle();
      if (reconcileError) throw new Error(`Could not reconcile stale automation audit: ${reconcileError.message}`);
      if (reconciled) return { existing: true, run: reconciled };
    }
    return { existing: true, run: existing };
  }

  const { data: created, error } = await admin
    .from("market_automation_runs")
    .insert({ run_key: runKey, action, status: "running" })
    .select("id")
    .single();
  if (error) {
    const { data: raced } = await admin
      .from("market_automation_runs")
      .select("id, status, details, error, started_at, finished_at")
      .eq("run_key", runKey)
      .maybeSingle();
    if (raced) return { existing: true, run: raced };
    throw new Error(`Could not create automation audit: ${error.message}`);
  }
  return { existing: false, run: created };
}

async function finishRun(admin: AdminClient, id: string, status: "succeeded" | "failed", details: unknown, error?: string) {
  const { error: updateError } = await admin
    .from("market_automation_runs")
    .update({ status, details, error: error ?? null, finished_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) throw new Error(`Could not finalize automation audit: ${updateError.message}`);
}

function errorClass(error: unknown): string {
  const value = error as { error_class?: string; status?: number; message?: string } | undefined;
  if (value?.error_class) return value.error_class;
  return classifyProviderFailure(value?.status ?? 400, value?.message ?? String(error ?? ""));
}

function summarizeDailyPlan(candidates: unknown, plan: { rows: Array<Record<string, any>>; rejected: Array<Record<string, any>> }) {
  const modelCandidates = Array.isArray(candidates) ? candidates : [];
  return {
    model_candidate_count: modelCandidates.length,
    model_candidates: modelCandidates.map((candidate) => ({
      question: String(candidate?.question ?? ""),
      market_archetype: candidate?.market_archetype ?? null,
      topic_key: candidate?.topic_key ?? null,
      closes_in_hours: candidate?.closes_in_hours ?? null,
      source_slugs: Array.isArray(candidate?.source_slugs) ? candidate.source_slugs.map(String).slice(0, 8) : [],
    })),
    accepted_count: plan.rows.length,
    accepted_markets: plan.rows.map((row) => ({
      question: row.question,
      category: row.category,
      closes_at: row.closes_at,
      market_archetype: row.pre_match_analysis?.market_archetype ?? null,
      topic_key: row.pre_match_analysis?.topic_key ?? null,
      source_article_slugs: Array.isArray(row.source_article_slugs) ? row.source_article_slugs : [],
    })),
    rejected_count: plan.rejected.length,
    rejected_candidates: plan.rejected,
  };
}

export async function runDailyDraftAutomation(candidates: unknown, now = new Date(), requestedRunKey?: unknown) {
  if (requestedRunKey !== undefined && typeof requestedRunKey !== "string") throw new Error("Invalid live-event draft run key.");
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const sourceArticles = await getLatestArticles(60);
  const expectedLiveEventRunKey = typeof requestedRunKey === "string" ? buildLiveEventDraftRunKey({ candidates, now }) : null;
  const validated = validateDailyDraftSubmission(
    candidates,
    new Set(sourceArticles.map((article) => article.slug)),
    {
      minimum: expectedLiveEventRunKey ? 3 : 0,
      nonSportOnly: !expectedLiveEventRunKey,
      sourceArticles,
      now,
    },
  );
  if (!validated.ok) throw new Error(validated.error);
  if (expectedLiveEventRunKey && requestedRunKey !== expectedLiveEventRunKey) throw new Error("Invalid live-event draft run key.");
  // Breaking-news inventory refreshes every four hours. Idempotency is per
  // Europe/Pristina four-hour window so fresh qualifying markets can open
  // through the day without duplicating the same window.
  const runKey = expectedLiveEventRunKey ?? `daily-drafts:${DAILY_MARKET_CONTRACT_VERSION}:${kosovoLocalDate(now)}:${String(Math.floor(now.getUTCHours() / 4)).padStart(2, "0")}`;
  const started = await beginRun(admin, "daily_drafts", runKey);
  if (started.existing) return { ok: true, skipped: true, runKey, reason: "already_processed", run: started.run };

  try {
    const { data: existingMarkets, error: existingError } = await admin
      .from("markets")
      .select("question,source_article_slugs,pre_match_analysis,status,market_classification")
      .in("status", ["open", "draft", "stale"])
      .eq("market_classification", "general_news");
    if (existingError) throw new Error(`Could not load existing markets: ${existingError.message}`);

    const plan = buildDailyDraftPlan({
      candidates: validated.candidates,
      existingMarkets: existingMarkets ?? [],
      now,
      audienceArticles: sourceArticles,
      requireMassAudience: !expectedLiveEventRunKey,
      nonSportOnly: !expectedLiveEventRunKey,
    });
    if (expectedLiveEventRunKey && plan.rows.length !== 4) {
      throw new Error("Live-event submission must create exactly four unique review-only draft cards.");
    }
    if (!expectedLiveEventRunKey) {
      const noPublishReason = dailyDraftPublicationReason(plan);
      if (noPublishReason) {
        const details = { created: 0, ...summarizeDailyPlan(validated.candidates, plan), admin_approval_required: true, no_publish_reason: noPublishReason };
        await finishRun(admin, started.run.id, "succeeded", details);
        return { ok: true, skipped: true, runKey, ...details, markets: [] };
      }
    }
    const dateSuffix = kosovoLocalDate(now).replace(/-/g, "");
    const rows = plan.rows.map((row, index) => ({
      ...row,
      // Every automated daily candidate is review-only. Sports templates and
      // General/News candidates both require an explicit admin approval action.
      status: "draft" as const,
      slug: `${slugifyQuestion(row.question) || "treg"}-${dateSuffix}-${index + 1}`,
    }));
    if (rows.length < 2 || rows.length > 5) {
      throw new Error("Codex draft payload must produce 2 to 5 unique draft markets after validation.");
    }
    let createdMarkets: Array<Record<string, unknown>> = [];
    if (rows.length) {
      const { data, error } = await admin.from("markets").insert(rows).select();
      if (error) throw new Error(`Could not insert market drafts: ${error.message}`);
      createdMarkets = data ?? [];
    }
    const details = { created: rows.length, ...summarizeDailyPlan(validated.candidates, plan), admin_approval_required: true };
    await finishRun(admin, started.run.id, "succeeded", details);
    const sourceBySlug = new Map(sourceArticles.map((article) => [article.slug, article]));
    const markets = createdMarkets.map((market) => ({
      ...market,
      evidence: (Array.isArray(market.source_article_slugs) ? market.source_article_slugs : [])
        .map((slug) => sourceBySlug.get(String(slug)))
        .filter(Boolean)
        .map((article) => ({ slug: article!.slug, title: article!.title })),
    }));
    return { ok: true, skipped: false, runKey, ...details, markets };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await finishRun(admin, started.run.id, "failed", {}, message);
    throw error;
  }
}

export async function previewDailyDraftAutomation(candidates: unknown, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const sourceArticles = await getLatestArticles(60);
  const validated = validateDailyDraftSubmission(candidates, new Set(sourceArticles.map((article) => article.slug)), {
    minimum: 0,
    nonSportOnly: true,
    sourceArticles,
    now,
  });
  if (!validated.ok) throw new Error(validated.error);
  const { data: existingMarkets, error } = await admin
    .from("markets")
    .select("question,source_article_slugs,pre_match_analysis,status,market_classification")
    .in("status", ["open", "draft", "stale"])
    .eq("market_classification", "general_news");
  if (error) throw new Error(`Could not load existing markets: ${error.message}`);
  const plan = buildDailyDraftPlan({
    candidates: validated.candidates,
    existingMarkets: existingMarkets ?? [],
    now,
    audienceArticles: sourceArticles,
    requireMassAudience: true,
    nonSportOnly: true,
  });
  const noPublishReason = dailyDraftPublicationReason(plan);
  return {
    ok: true,
    preview: true,
    created: 0,
    ...summarizeDailyPlan(validated.candidates, plan),
    no_publish_reason: noPublishReason,
    markets: noPublishReason ? [] : plan.rows,
  };
}

/** Fetches official ESPN summaries, locks official finals, and settles only verified due sport markets. */
async function runOfficialSportsRefresh(action: "live_sports", runKey: string, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const started = await beginRun(admin, action, runKey);
  if (started.existing) return { ok: true, skipped: true, runKey, reason: "already_processed", run: started.run };
  try {
    const [{ data: markets, error }, { data: f1Markets, error: f1MarketsError }] = await Promise.all([
      admin.from("markets").select("*").eq("status", "open").or(`sport_outcomes.not.is.null,slug.in.(${ARGENTINA_SPAIN_PAIR.spainSlug},${ARGENTINA_SPAIN_PAIR.argentinaSlug})`),
      admin.from("markets").select("*").eq("status", "open").eq("market_classification", "live_f1"),
    ]);
    if (error) throw new Error(`Could not load open sport markets: ${error.message}`);
    if (f1MarketsError) throw new Error(`Could not load open F1 markets: ${f1MarketsError.message}`);
    const pairMarkets = (markets ?? []).filter((market) => [ARGENTINA_SPAIN_PAIR.spainSlug, ARGENTINA_SPAIN_PAIR.argentinaSlug].includes(market.slug));
    const standardMarkets = (markets ?? []).filter((market) => Array.isArray(market.sport_outcomes) && market.sport_outcomes.length);
    let events: any[] = [];
    let officialSourceError: string | null = null;
    try {
      events = await fetchEspnLiveEvents([...standardMarkets.map((market) => market.live_event), ...(pairMarkets.length === 2 ? [ARGENTINA_SPAIN_PAIR.event] : [])]);
    } catch (error) {
      // Keep the two-minute worker alive for settlement and the next poll. A
      // source outage is recorded as unavailable, never converted into odds.
      officialSourceError = String(error instanceof Error ? error.message : error);
      console.error("Official sports source unavailable; continuing to settlement pass:", officialSourceError);
    }
    const signals = buildSportMarketPlan({ markets: standardMarkets, events, now });
    const pairedSignals = buildArgentinaSpainPairedBinaryPlan({ markets: pairMarkets, events, now });
    const results: Array<{ slug: string; status: "applied" | "no_change" | "no_score" | "awaiting_official_winner" | "failed"; error?: string }> = [];
    const pairedBinaryEmailUpdates: Array<{ persisted: true; material_change: true; timestamp: string; state: Record<string, unknown> }> = [];
    const f1Results: Array<{ slug: string; status: "applied" | "unchanged" | "unavailable" | "failed"; error?: string }> = [];
    const officialMarketEmailUpdates: Array<{ question: string; slug: string; kind: string; before: Record<string, unknown>; after: Record<string, unknown>; timestamp: string; source_url?: string }> = [];
    const captureOfficialMarketChange = async (market: any, kind: string, source_url?: string) => {
      const before = officialMarketNotificationState(market);
      const { data: afterMarket, error: readbackError } = await admin.from("markets")
        .select("status,outcome,live_score_state,q_yes,q_no,b,reference_probabilities,outcome_quantities,live_event,sport_outcomes")
        .eq("id", market.id).maybeSingle();
      if (readbackError) throw new Error(`Could not read persisted official market ${market.slug}: ${readbackError.message}`);
      if (!afterMarket) throw new Error(`Persisted official market ${market.slug} disappeared before notification readback.`);
      const after = officialMarketNotificationState(afterMarket);
      if (didOfficialMarketStateChange(before, after)) {
        const graph = await readPersistedMarketGraph(admin, String(market.id));
        officialMarketEmailUpdates.push({ question: String(market.question), slug: String(market.slug), kind, before: { ...before, graph }, after: { ...after, graph }, timestamp: now.toISOString(), ...(source_url ? { source_url } : {}) });
      }
    };
    for (const signal of signals) {
      try {
        if (signal.kind === "no_score") {
          const existingAnalysis = signal.market.pre_match_analysis && typeof signal.market.pre_match_analysis === "object" ? signal.market.pre_match_analysis : {};
          const existingSources = Array.isArray(existingAnalysis.sources) ? existingAnalysis.sources : [];
          const { error: updateError } = await admin.from("markets").update({
            live_event: { ...signal.market.live_event, kickoff: signal.kickoff },
            live_score_state: { key: signal.state_key, status: signal.event.status, detail: signal.event.detail, competitors: signal.event.competitors, source_url: signal.event.source_url, kickoff: signal.kickoff, has_official_score: false, supplemental: signal.event.supplemental },
            pre_match_analysis: { ...existingAnalysis, sources: [...existingSources, ...signal.pre_match_evidence] },
          }).eq("id", signal.market.id).eq("status", "open");
          if (updateError) throw new Error(updateError.message);
          await captureOfficialMarketChange(signal.market, "football_scheduled_state", signal.event.source_url);
          results.push({ slug: signal.market.slug, status: "no_score" });
          continue;
        }
        if (signal.kind === "final_unresolved") {
          // Full time is on the board but no side has decisively won yet: a
          // two-legged tie still waiting on aggregate, or a shootout. Record
          // the official state and wait: settling on this leg's score alone
          // pays the wrong side of the market.
          const { error: updateError } = await admin.from("markets").update({
            live_score_state: {
              key: signal.state_key,
              status: signal.event.status,
              detail: signal.event.detail,
              competitors: signal.event.competitors,
              football_format: signal.event.football_format,
              source_url: signal.event.source_url,
              has_official_score: true,
              resolution_pending: true,
            },
          }).eq("id", signal.market.id).eq("status", "open");
          if (updateError) throw new Error(updateError.message);
          results.push({ slug: signal.market.slug, status: "awaiting_official_winner" });
          continue;
        }
        const { error: oracleError } = await admin.rpc("apply_sport_market_oracle", {
          p_market_id: signal.market.id, p_provider: "espn", p_event_id: signal.event.event_id,
          p_state: { key: signal.state_key, status: signal.event.status, detail: signal.event.detail, competitors: signal.event.competitors, metrics: signal.event.metrics, metric_sources: signal.event.metric_sources, starting_lineups: signal.event.starting_lineups, football_format: signal.event.football_format, series: signal.event.series, source_url: signal.event.source_url, supplemental: signal.event.supplemental },
          p_reference_probabilities: signal.snapshot.reference_probabilities, p_evidence: signal.snapshot.evidence,
          p_reasoning: signal.snapshot.oracle_reasoning, p_requested_cap: signal.snapshot.oracle_cap,
          p_close_market: signal.close_market, p_verified_outcome: signal.verified_outcome ?? null, p_settlement_due_at: signal.settlement_due_at ?? null,
        });
        if (oracleError) throw new Error(oracleError.message);
        await captureOfficialMarketChange(signal.market, signal.close_market ? "football_final_lock" : "football_live_state", signal.event.source_url);
        results.push({ slug: signal.market.slug, status: "applied" });
      } catch (oracleError) {
        results.push({ slug: signal.market.slug, status: "failed", error: String(oracleError instanceof Error ? oracleError.message : oracleError) });
      }
    }
    for (const signal of pairedSignals as any[]) {
      try {
        if (signal.kind === "no_score") {
          const { error: pairStateError } = await admin.from("markets").update({ live_event: ARGENTINA_SPAIN_PAIR.event, live_score_state: signal.state }).in("id", [signal.spainMarket.id, signal.argentinaMarket.id]).eq("status", "open");
          if (pairStateError) throw new Error(pairStateError.message);
          await captureOfficialMarketChange(signal.spainMarket, "football_scheduled_state", String(signal.state?.source_url ?? ""));
          await captureOfficialMarketChange(signal.argentinaMarket, "football_scheduled_state", String(signal.state?.source_url ?? ""));
          results.push({ slug: signal.spainMarket.slug, status: "no_score" }, { slug: signal.argentinaMarket.slug, status: "no_score" });
          continue;
        }
        const { data: pairOracleResult, error: pairOracleError } = await admin.rpc("apply_paired_binary_sport_oracle", {
          p_spain_market_id: signal.spainMarket.id, p_argentina_market_id: signal.argentinaMarket.id, p_event_id: signal.event.event_id,
          p_state: signal.state, p_spain_reference_probability: signal.reference.spain, p_evidence: signal.evidence, p_reasoning: signal.reasoning,
          p_requested_cap: signal.oracle_cap, p_close_market: signal.close_market, p_spain_outcome: signal.spain_outcome, p_argentina_outcome: signal.argentina_outcome, p_settlement_due_at: signal.settlement_due_at,
        });
        if (pairOracleError) throw new Error(pairOracleError.message);
        // 0022 returns true/false. The deployed 0021 function is void, where a no-error RPC is a committed paired update; only an explicit false suppresses mail.
        if (pairOracleResult === false) {
          results.push({ slug: signal.spainMarket.slug, status: "no_change" }, { slug: signal.argentinaMarket.slug, status: "no_change" });
          continue;
        }
        results.push({ slug: signal.spainMarket.slug, status: "applied" }, { slug: signal.argentinaMarket.slug, status: "applied" });
        if (signal.material_change === true) {
          const graph = await readPersistedMarketGraph(admin, String(signal.spainMarket.id));
          pairedBinaryEmailUpdates.push({ persisted: true, material_change: true, timestamp: now.toISOString(), state: { ...signal.state, graph } });
        }
      } catch (pairOracleError) {
        const error = String(pairOracleError instanceof Error ? pairOracleError.message : pairOracleError);
        results.push({ slug: signal.spainMarket.slug, status: "failed", error }, { slug: signal.argentinaMarket.slug, status: "failed", error });
      }
    }
    const f1EmailUpdates: Array<{ question: string; slug: string; driver_code: string; driver_name: string; team_name: string; team_logo_url?: string | null; headshot_url?: string | null; team_colour?: string | null; note?: string | null; position: number | null; gap: string; pits: number; before_probability: number; after_probability: number; source_url: string; graph: Record<string, unknown> }> = [];
    if ((f1Markets ?? []).length) {
      try {
        const futureF1Groups = new Map<string, any[]>();
        for (const market of f1Markets ?? []) {
          const raceEventId = String(market.live_event?.event_id ?? "");
          const raceStart = Date.parse(String(market.live_event?.race_start ?? ""));
          if (raceEventId && Number.isFinite(raceStart) && raceStart > now.getTime()) {
            const group = futureF1Groups.get(raceEventId) ?? [];
            group.push(market);
            futureF1Groups.set(raceEventId, group);
          }
        }
        if (futureF1Groups.size) {
          for (const futureF1Markets of futureF1Groups.values()) {
          const { fetchF1OpeningFactors } = await import("@/lib/f1-upcoming-race.mjs");
          const source = futureF1Markets[0];
          const config = source.live_event ?? {};
          const roster = (source.sport_outcomes ?? []).map((driver: any) => ({ key: String(driver.key ?? "").toUpperCase(), driver_number: Number(driver.driver_number), label: String(driver.label ?? ""), team: String(driver.team ?? ""), team_colour: String(driver.team_colour ?? ""), headshot_url: driver.headshot_url ?? null }));
          let race = {
            event_id: String(config.event_id),
            meeting_key: Number(config.openf1_meeting_key),
            year: new Date(String(config.race_start)).getUTCFullYear(),
            session_key: Number(config.openf1_session_key),
            date_start: String(config.race_start),
            circuit_short_name: String(config.circuit_short_name ?? ""),
            country_name: String(config.country_name ?? ""),
            source_url: String(config.openf1_race_source ?? "https://api.openf1.org/v1/sessions"),
          };
          if (!Number.isInteger(race.meeting_key) || !Number.isInteger(race.session_key) || !race.circuit_short_name) {
            const { fetchUpcomingOpenF1Race } = await import("@/lib/f1-upcoming-race.mjs");
            const discovered = await fetchUpcomingOpenF1Race({ now, leadDays: 3 });
            if (!discovered || discovered.event_id !== race.event_id) throw new Error(`OpenF1 metadata is missing for future market ${race.event_id}`);
            race = discovered;
          }
          const enrichedLiveEvent = { ...config, openf1_meeting_key: race.meeting_key, openf1_session_key: race.session_key, circuit_short_name: race.circuit_short_name, country_name: race.country_name, race_start: race.date_start, openf1_race_source: race.source_url };
          for (const market of futureF1Markets) {
            const { error: metadataError } = await admin.from("markets").update({ live_event: enrichedLiveEvent }).eq("id", market.id).eq("status", "open");
            if (metadataError) throw new Error(`Could not persist F1 race metadata for ${market.slug}: ${metadataError.message}`);
          }
          // Motorsport press, ahead of the grid sheet.
          //
          // OpenF1 publishes starting_grid with every penalty already served,
          // which is authoritative and hours late: the paddock knows on Friday,
          // the sheet lands on Saturday. These feeds close that window. They are
          // read for structural facts only — a penalty with a stated number of
          // places, a withdrawal, a disqualification — and two independent
          // publishers must agree before anything reaches a price. A failed
          // fetch or a refusing model yields no penalties and the run continues
          // on OpenF1 alone, which is the behaviour that existed before.
          let f1News: { applied: Record<string, unknown>; pending: unknown[]; considered: number; reason: string | null; signals?: Record<string, unknown>; signals_pending?: unknown[] } =
            { applied: {}, pending: [], considered: 0, reason: "not_run", signals: {} };
          try {
            const [{ fetchF1Headlines, extractF1Penalties, extractF1Signals }, { llmJSON }] = await Promise.all([
              import("@/lib/f1-news-sources.mjs"),
              import("@/lib/llm"),
            ]);
            const feed = await (fetchF1Headlines as any)({ now: now.getTime() });
            // The model only reads when the press has actually said something
            // since the last look. Feeds are polled every two minutes; asking
            // Groq to re-read the same thirty headlines seven hundred times a
            // day would spend the budget on an answer that cannot have changed.
            // When nothing is fresh the previous verdict is carried forward, so
            // a penalty found on Friday still holds on Saturday.
            const carried = (source.live_score_state?.news_penalties ?? {}) as Record<string, unknown>;
            const freshest = feed.headlines[0]?.ageMin ?? Number.POSITIVE_INFINITY;
            const ask = (system: string, user: string) => llmJSON(system, user, { maxTokens: 700, prefer: "groq" });
            if (freshest <= 120) {
              // Two reads of the same headlines, kept apart on purpose. Facts
              // about the grid are released from the cap; pace and paddock talk
              // are not, and mixing them into one call would invite the model
              // to launder the second as the first.
              const [penalties, signals] = await Promise.all([
                (extractF1Penalties as any)({ headlines: feed.headlines, roster, now, llm: ask }),
                (extractF1Signals as any)({ headlines: feed.headlines, roster, now, llm: ask }),
              ]);
              f1News = { ...penalties, signals: signals.applied, signals_pending: signals.pending };
            } else {
              f1News = {
                applied: carried,
                pending: [],
                considered: feed.headlines.length,
                reason: "no_fresh_headlines",
                signals: (source.live_score_state?.news_signals ?? {}) as Record<string, unknown>,
              };
            }
          } catch (error) {
            f1News = { applied: {}, pending: [], considered: 0, reason: String(error instanceof Error ? error.message : error), signals: {} };
          }

          const opening = await (fetchF1OpeningFactors as any)({ race, roster, now, penalties: f1News.applied, signals: f1News.signals ?? {} });
          const state = {
            key: `f1-pre-match:${race.event_id}:${opening.model_version}:${JSON.stringify(opening.probabilities)}`,
            source_url: race.source_url,
            source_provider: "OpenF1",
            race: { status: "PRE_RACE", current_lap: null, total_laps: null },
            pre_match_inputs: opening.inputs,
            news_penalties: f1News.applied,
            news_signals: f1News.signals ?? {},
          };
          const evidence = [
            { title: "OpenF1 verified pre-race factors", url: race.source_url, probabilities: opening.probabilities, inputs: opening.inputs, availability: opening.availability },
            ...Object.values(f1News.applied).map((penalty: any) => ({
              title: `${penalty.driver}: ${penalty.reason}`,
              url: penalty.source,
              publishers: penalty.publishers,
              cited_urls: penalty.cited_urls,
            })),
          ];
          for (const market of futureF1Markets) {
            const marketState = { ...state, previous_probabilities: market.reference_probabilities ?? null };
            try {
              if (market.live_score_state?.key === state.key) {
                f1Results.push({ slug: market.slug, status: "unchanged" });
                continue;
              }
              // Which drivers moved for a reason rather than an opinion. A
              // verified withdrawal, or a penalty worth three grid places or
              // more, is released from the five-point cap by 0068 so the price
              // is right on the first tick instead of the fourth; everyone else
              // is still capped, and the book renormalises around them.
              const structuralKeys = Object.entries((opening.inputs ?? {}) as Record<string, { not_starting?: boolean | null; grid_penalty_places?: number | null }>)
                .filter(([, input]) => Boolean(input?.not_starting) || Number(input?.grid_penalty_places ?? 0) >= 3)
                .map(([key]) => key);
              const { error: applyError } = await admin.rpc("apply_f1_race_winner_oracle", { p_market_id: market.id, p_state: marketState, p_probabilities: opening.probabilities, p_evidence: evidence, p_reasoning: opening.method, p_cap: 0.05, p_final: false, p_winner: null, p_structural_keys: structuralKeys });
              if (applyError) throw new Error(applyError.message);
              const { error: snapshotError } = await admin.rpc("record_f1_vector_snapshot", { p_market_id: market.id, p_state: marketState, p_probabilities: opening.probabilities, p_reasoning: opening.method });
              if (snapshotError) throw new Error(snapshotError.message);
              await captureOfficialMarketChange(market, "f1_pre_match_state", race.source_url);
              f1Results.push({ slug: market.slug, status: "applied" });

              // The whole field, by name and face, whenever the book actually
              // moves. Gated on three points so a two-minute drift does not
              // mail twenty-two cards; a grid, a penalty or a withdrawal clears
              // it comfortably and nothing else does.
              const before = (market.reference_probabilities ?? {}) as Record<string, number>;
              const after = opening.probabilities as Record<string, number>;
              const biggestMove = Math.max(0, ...Object.keys(after).map((key) => Math.abs(Number(after[key] ?? 0) - Number(before[key] ?? 0))));
              if (biggestMove >= 0.03) {
                const outcomes = new Map((market.sport_outcomes ?? []).map((outcome: any) => [String(outcome?.key ?? ""), outcome]));
                for (const [key] of Object.entries(after).sort((a, b) => Number(b[1]) - Number(a[1]))) {
                  const outcome: any = outcomes.get(key) ?? {};
                  const input: any = (opening.inputs ?? {})[key] ?? {};
                  const note = input.not_starting
                    ? `Nuk niset — ${input.penalty_reason ?? "tërhequr"}`
                    : input.grid_penalty_places
                      ? `Nis P${input.starting_grid} · penalizim ${input.grid_penalty_places} vendesh`
                      : input.starting_grid
                        ? `Nis P${input.starting_grid}`
                        : input.qualifying_position
                          ? `Kualifikimi P${input.qualifying_position}`
                          : "Para kualifikimit";
                  f1EmailUpdates.push({
                    question: market.question,
                    slug: market.slug,
                    driver_code: key,
                    driver_name: String(outcome.label ?? key),
                    team_name: String(outcome.team ?? "Ekipi i papërcaktuar"),
                    team_logo_url: outcome.team_logo_url ?? outcome.logo ?? null,
                    headshot_url: f1DriverHeadshot(key, outcome.headshot_url) ?? null,
                    team_colour: f1TeamColor(String(outcome.team ?? ""), outcome.team_colour),
                    note,
                    position: null,
                    gap: "",
                    pits: 0,
                    before_probability: Number(before[key] ?? 0),
                    after_probability: Number(after[key] ?? 0),
                    source_url: input.penalty_source ?? race.source_url,
                    graph: {},
                  } as any);
                }
              }
            } catch (error) {
              f1Results.push({ slug: market.slug, status: "failed", error: String(error instanceof Error ? error.message : error) });
            }
          }
          }
        } else {
        const openF1Live = await fetchOpenF1LiveRace({ now });
        const leaderboard = openF1ToWinnerLeaderboard(openF1Live);
        if (!leaderboard || !openF1Live) throw new Error("OpenF1 did not expose a complete active race session.");
        const f1SourceUrl = `https://api.openf1.org/v1/sessions?session_key=${encodeURIComponent(String(openF1Live.session?.session_key ?? ""))}`;
        const f1Signals = buildF1MarketPlan({ markets: f1Markets, leaderboard });
        const f1RaceWinnerSignals = buildF1RaceWinnerPlan({ markets: f1Markets, leaderboard });
        for (const signal of f1RaceWinnerSignals) {
          try {
            const f1State = { ...signal.state, previous_probabilities: signal.market.reference_probabilities ?? null };
            const { error: f1RaceOracleError } = await admin.rpc("apply_f1_race_winner_oracle", { p_market_id: signal.market.id, p_state: f1State, p_probabilities: signal.probabilities, p_evidence: signal.evidence, p_reasoning: signal.reasoning, p_cap: signal.oracle_cap, p_final: false, p_winner: null });
            if (f1RaceOracleError) throw new Error(f1RaceOracleError.message);
            const { error: f1SnapshotError } = await admin.rpc("record_f1_vector_snapshot", { p_market_id: signal.market.id, p_state: f1State, p_probabilities: signal.probabilities, p_reasoning: signal.reasoning });
            if (f1SnapshotError) throw new Error(f1SnapshotError.message);
            await captureOfficialMarketChange(signal.market, "f1_race_winner_state", f1SourceUrl);
            f1Results.push({ slug: signal.market.slug, status: "applied" });
          } catch (f1RaceOracleError) { f1Results.push({ slug: signal.market.slug, status: "failed", error: String(f1RaceOracleError instanceof Error ? f1RaceOracleError.message : f1RaceOracleError) }); }
        }
        const changedSlugs = new Set([...f1Signals, ...f1RaceWinnerSignals].map((signal: any) => signal.market.slug));
        for (const market of f1Markets ?? []) if (!changedSlugs.has(market.slug)) f1Results.push({ slug: market.slug, status: "unchanged" });
        for (const signal of f1Signals) {
          try {
            const { data: f1OracleRows, error: f1OracleError } = await admin.rpc("apply_f1_market_oracle", {
              p_market_id: signal.market.id,
              p_state: { key: signal.state_key, provider: "formula1_dashboard", source_url: leaderboard.source_url, event_id: signal.config.event_id, race: leaderboard.race, leaderboard: leaderboard.rows },
              p_reference_probability: signal.reference_probability, p_oracle_reasoning: signal.reasoning,
              p_evidence: signal.evidence, p_requested_cap: signal.oracle_cap,
            });
            if (f1OracleError) throw new Error(f1OracleError.message);
            const oracle = Array.isArray(f1OracleRows) ? f1OracleRows[0] : null;
            if (!oracle) { f1Results.push({ slug: signal.market.slug, status: "unchanged" }); continue; }
            f1Results.push({ slug: signal.market.slug, status: "applied" });
            const mappedOutcome = (signal.market.sport_outcomes ?? []).find((outcome: any) => String(outcome.key ?? "").toUpperCase() === String(signal.config.driver_code).toUpperCase() || String(outcome.driver_code ?? "").toUpperCase() === String(signal.config.driver_code).toUpperCase());
            const graph = await readPersistedMarketGraph(admin, String(signal.market.id));
            f1EmailUpdates.push({ question: signal.market.question, slug: signal.market.slug, driver_code: signal.config.driver_code, driver_name: String(mappedOutcome?.label ?? signal.row.driver ?? signal.config.driver_code), team_name: String(mappedOutcome?.team ?? signal.row.team ?? "Team not supplied"), team_logo_url: mappedOutcome?.team_logo_url ?? mappedOutcome?.logo ?? null, headshot_url: f1DriverHeadshot(String(signal.config.driver_code ?? ""), (mappedOutcome as any)?.headshot_url) ?? null, team_colour: f1TeamColor(String(mappedOutcome?.team ?? signal.row.team ?? ""), (mappedOutcome as any)?.team_colour), note: null, position: signal.row.position, gap: signal.row.gap, pits: signal.row.pits, before_probability: Number(oracle.previous_price_yes), after_probability: Number(oracle.new_price_yes), source_url: leaderboard.source_url, graph });
          } catch (f1OracleError) { f1Results.push({ slug: signal.market.slug, status: "failed", error: String(f1OracleError instanceof Error ? f1OracleError.message : f1OracleError) }); }
        }
        // A FINISHED classification settles explicitly mapped markets only via
        // the existing idempotent settlement authority; provisional rows cannot settle.
        for (const settlement of buildF1SettlementPlan({ markets: f1Markets, leaderboard })) {
          const { error: resolveError } = await admin.rpc("resolve_market", { p_market_id: settlement.market.id, p_outcome: settlement.outcome });
          if (resolveError) throw new Error(`Could not settle F1 ${settlement.market.slug}: ${resolveError.message}`);
          await captureOfficialMarketChange(settlement.market, "f1_settlement", leaderboard.source_url);
        }
        }
      } catch (f1Error) {
        for (const market of f1Markets ?? []) f1Results.push({ slug: market.slug, status: "unavailable", error: String(f1Error instanceof Error ? f1Error.message : f1Error) });
      }
    }
    const { data: dueSportMarkets, error: dueSportMarketsError } = await admin.from("markets").select("*").eq("status", "closed").not("settlement_due_at", "is", null).lte("settlement_due_at", now.toISOString());
    if (dueSportMarketsError) throw new Error(`Could not read due sport settlements: ${dueSportMarketsError.message}`);
    const { data: settled, error: settlementError } = await admin.rpc("settle_due_sport_markets");
    if (settlementError) throw new Error(`Could not settle verified sport markets: ${settlementError.message}`);
    if (Number(settled ?? 0) > 0) for (const market of dueSportMarkets ?? []) await captureOfficialMarketChange(market, "football_settlement", String(market.live_score_state?.source_url ?? ""));
    const officialUpdates = results.filter((result) => result.status === "applied").length + f1Results.filter((result) => result.status === "applied").length + Number(settled ?? 0);
    const details = { official_espn_events: signals.length, official_source_error: officialSourceError, results, official_f1_markets: (f1Markets ?? []).length, f1_results: f1Results, f1_email_updates: f1EmailUpdates, official_market_email_updates: officialMarketEmailUpdates, settled_market_count: settled ?? 0, official_updates: officialUpdates, paired_binary_email_updates: pairedBinaryEmailUpdates, user_trade_ledger_changed_only_by_due_settlement: true };
    await finishRun(admin, started.run.id, "succeeded", details);
    if (hasPersistedMaterialPairedBinaryChange({ skipped: false, paired_binary_email_updates: pairedBinaryEmailUpdates })) {
      try {
        await sendTreguLiveNotification({ kind: "paired_binary_live_update", runKey, changes: pairedBinaryEmailUpdates });
      } catch (emailError) {
        // Persistence/audit succeeded. A transport failure must not turn this into a later duplicate email attempt.
        console.error("Argentina–Spain live notification failed after persistence:", String(emailError instanceof Error ? emailError.message : emailError));
      }
    }
    if (f1EmailUpdates.length) {
      try {
        await sendTreguLiveNotification({ kind: "f1_live_update", runKey, changes: f1EmailUpdates });
      } catch (emailError) {
        console.error("Formula 1 live notification failed after persistence:", String(emailError instanceof Error ? emailError.message : emailError));
      }
    }
    if (officialMarketEmailUpdates.length) {
      try {
        await sendTreguLiveNotification({ kind: "official_market_update", runKey, changes: officialMarketEmailUpdates });
      } catch (emailError) {
        console.error("Official football/F1 notification failed after persistence:", String(emailError instanceof Error ? emailError.message : emailError));
      }
    }
    return { ok: true, skipped: false, runKey, ...details };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await finishRun(admin, started.run.id, "failed", {}, message);
    throw error;
  }
}

/** Two-minute official sports processor: idempotently discovers 72-hour templates and refreshes active markets. */
export async function runLiveSportsAutomation(now = new Date()) {
  // The official live heartbeat is the critical two-minute lane. Template
  // discovery is best-effort and must never delay or cancel score refreshes.
  const live = await runOfficialSportsRefresh("live_sports", oneMinuteRunKey(now), now);
  const [f1Template, footballTemplate, f1Championship] = await Promise.allSettled([
    runUpcomingF1TemplateAutomation(now),
    runUpcomingFootballTemplateAutomation(now),
    runF1ChampionshipAutomation(now),
  ]);
  return {
    ...live,
    f1_template: f1Template.status === "fulfilled"
      ? f1Template.value
      : { ok: false, created: 0, reason: "f1_template_unavailable", error: String(f1Template.reason instanceof Error ? f1Template.reason.message : f1Template.reason) },
    football_template: footballTemplate.status === "fulfilled"
      ? footballTemplate.value
      : { ok: false, created: 0, reason: "football_template_unavailable", error: String(footballTemplate.reason instanceof Error ? footballTemplate.reason.message : footballTemplate.reason) },
    f1_championship: f1Championship.status === "fulfilled"
      ? f1Championship.value
      : { ok: false, reason: "f1_championship_unavailable", error: String(f1Championship.reason instanceof Error ? f1Championship.reason.message : f1Championship.reason) },
  };
}

/** Shared news-only AI repricer. The caller selects an explicit audit action and idempotency bucket. */
async function runNewsReprice(action: "reprice" | "tregu_live", runKey: string, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const started = await beginRun(admin, action, runKey);
  if (started.existing) return { ok: true, skipped: true, runKey, reason: "already_processed", run: started.run };
  const startedAt = Date.now();

  try {
    const { data: openMarkets, error: marketsError } = await admin.from("markets").select("*").eq("status", "open");
    if (marketsError) throw new Error(`Could not load open markets: ${marketsError.message}`);
    const markets = (openMarkets ?? []).filter((market) => {
      const category = String(market?.category ?? "").trim().toLowerCase();
      return market?.market_classification === "general_news"
        && market?.market_type === "binary"
        && !["sport", "f1", "football", "basketball"].includes(category)
        && !market?.live_event
        && !Array.isArray(market?.sport_outcomes);
    });

    // Only full-body articles already stored in the newsroom can move odds.
    // RSS/Google headlines remain discovery signals and are never promoted into
    // fake verified evidence with body=title.
    const verifiedPool = await getLatestArticles(200);
    const marketIds = (markets ?? []).map((market) => String(market.id)).filter(Boolean);
    const { data: priorNewsSnapshots, error: priorNewsSnapshotsError } = marketIds.length
      ? await admin.from("market_snapshots")
        .select("market_id,evidence_slugs,evidence,created_at,oracle_kind,oracle_reasoning")
        .eq("oracle_kind", "news_oracle")
        .in("market_id", marketIds)
        .order("created_at", { ascending: false })
        .limit(1000)
      : { data: [], error: null };
    if (priorNewsSnapshotsError) throw new Error(`Could not load news evidence ledger: ${priorNewsSnapshotsError.message}`);
    const usedEvidenceByMarket = new Map<string, Set<string>>();
    const lastDeadlineDecayAtByMarket = new Map<string, number>();
    for (const snapshot of priorNewsSnapshots ?? []) {
      const marketId = String(snapshot.market_id ?? "");
      if (!marketId) continue;
      const used = usedEvidenceByMarket.get(marketId) ?? new Set<string>();
      for (const slug of Array.isArray(snapshot.evidence_slugs) ? snapshot.evidence_slugs : []) used.add(String(slug).toLocaleLowerCase());
      for (const article of Array.isArray(snapshot.evidence) ? snapshot.evidence : []) used.add(evidenceIdentity(article));
      usedEvidenceByMarket.set(marketId, used);
      const isDeadlineDecay = String(snapshot.oracle_reasoning ?? "").toLocaleLowerCase().includes("deadline decay")
        && (Array.isArray(snapshot.evidence_slugs) ? snapshot.evidence_slugs.length : 0) === 0;
      const createdAt = Date.parse(String(snapshot.created_at ?? ""));
      if (isDeadlineDecay && Number.isFinite(createdAt)) {
        lastDeadlineDecayAtByMarket.set(marketId, Math.max(lastDeadlineDecayAtByMarket.get(marketId) ?? 0, createdAt));
      }
    }
    const researchedMarkets = (markets ?? []).map((market) => ({ market, articles: verifiedPool }));
    const plan = researchedMarkets.flatMap(({ market, articles }) => buildRepricePlan({
      markets: [market], verifiedArticles: articles, now, usedEvidenceByMarket,
    }));
    const results: Array<{
      slug: string;
      status: "oracle_applied" | "settled" | "deadline_settled" | "deadline_decay" | "oracle_failed" | "no_change" | "no_fresh_evidence" | "skipped_closed" | "skipped_ineligible";
      provider?: string;
      fallback_index?: number;
      fallback_reason?: string | null;
      error?: string;
      error_class?: string;
      reason?: string;
      deadline_action?: "settle" | "decay" | null;
      email_update?: {
        question: string;
        slug: string;
        provider: string;
        before_probability: number;
        after_probability: number;
        absolute_percentage_point_change: number;
        reason?: "deadline_decay" | "deadline_settlement";
        before_state?: { status: string; outcome: string | null };
        after_state?: { status: string; outcome: string | null };
        timestamp: string;
        remaining_hours?: number | null;
        evidence_fingerprint?: string;
        verified_sources: Array<{ label: string; title: string; slug: string; url?: string; published_at?: string }>;
      };
    }> = [];
    const recordMarketCheck = async (marketId: string, scan: Record<string, unknown>) => {
      const { data, error } = await admin
        .from("markets")
        .update({ last_checked_at: now.toISOString(), last_scan_result: scan })
        .eq("id", marketId)
        .select("id");
      if (error) throw new Error(`Could not persist market scan: ${error.message}`);
      return Boolean(data?.length);
    };

    for (const item of plan) {
      try {
        // The initial scan is intentionally broad. Re-read each candidate before
        // provider work so a market closed/resolved by another automation is a
        // non-error audit result and never reaches an AI or oracle write.
        const { data: currentMarket, error: currentMarketError } = await admin
          .from("markets")
          .select("id, created_at, status, closes_at, outcome, q_yes, q_no, b, category, market_type, market_classification")
          .eq("id", item.market.id)
          .maybeSingle();
        if (currentMarketError) throw new Error(`Could not recheck market ${item.market.slug}: ${currentMarketError.message}`);
        // The deadline RPCs enforce this too, but guard here to make live, F1,
        // and multi-outcome scans a harmless no-op rather than an oracle failure.
        const deadlineEligible = isEligibleNewsDeadlineMarket(currentMarket);
        const deadlineAction = newsDeadlineAction(currentMarket, now);
        const deadlineBefore = deadlineEligible && currentMarket ? {
          probability: Math.exp(Number(currentMarket.q_yes) / Number(currentMarket.b)) / (Math.exp(Number(currentMarket.q_yes) / Number(currentMarket.b)) + Math.exp(Number(currentMarket.q_no) / Number(currentMarket.b))),
          status: currentMarket.status,
          outcome: currentMarket.outcome ?? null,
        } : null;
        const deadlineRemainingHours = Number.isFinite(Date.parse(String(currentMarket?.closes_at ?? "")))
          ? Math.max(0, (Date.parse(String(currentMarket?.closes_at ?? "")) - now.getTime()) / 3_600_000)
          : null;
        const deadlineChange = async (reason: "deadline_decay" | "deadline_settlement") => {
          const { data: after, error: afterError } = await admin.from("markets").select("status, outcome, q_yes, q_no, b").eq("id", item.market.id).maybeSingle();
          if (afterError) throw new Error(`Could not read deadline result for ${item.market.slug}: ${afterError.message}`);
          if (!after || !deadlineBefore) return null;
          const afterProbability = Math.exp(Number(after.q_yes) / Number(after.b)) / (Math.exp(Number(after.q_yes) / Number(after.b)) + Math.exp(Number(after.q_no) / Number(after.b)));
          const stateChanged = after.status !== deadlineBefore.status || (after.outcome ?? null) !== deadlineBefore.outcome;
          if (!stateChanged && afterProbability === deadlineBefore.probability) return null;
          return {
            question: item.market.question, slug: item.market.slug, provider: "deadline_oracle", reason,
            before_probability: deadlineBefore.probability, after_probability: afterProbability,
            absolute_percentage_point_change: Math.abs(afterProbability - deadlineBefore.probability),
            before_state: { status: deadlineBefore.status, outcome: deadlineBefore.outcome },
            after_state: { status: after.status, outcome: after.outcome ?? null },
            timestamp: now.toISOString(), remaining_hours: deadlineRemainingHours, verified_sources: [],
          };
        };
        if (deadlineAction === "settle") {
          const { error: deadlineError } = await admin.rpc("apply_news_deadline_settlement", { p_market_id: item.market.id });
          if (deadlineError) throw new Error(`Could not apply deadline settlement for ${item.market.slug}: ${deadlineError.message}`);
          const persisted = await recordMarketCheck(item.market.id, { status: "deadline_settlement", checked_at: now.toISOString(), reference_probability: 0.05 });
          const emailUpdate = persisted ? await deadlineChange("deadline_settlement") : null;
          results.push(persisted ? { slug: item.market.slug, status: "deadline_settled", deadline_action: deadlineAction, ...(emailUpdate ? { email_update: emailUpdate } : {}) } : { slug: item.market.slug, status: "skipped_closed", reason: "deadline_result_not_persisted", deadline_action: deadlineAction });
          continue;
        }
        const skipReason = repriceMarketSkipReason(currentMarket, now);
        if (skipReason) {
          results.push({ slug: item.market.slug, status: "skipped_closed", reason: skipReason, deadline_action: deadlineAction });
          continue;
        }
        if (deadlineAction === "decay" && item.evidence.length === 0) {
          const lastDecayAt = lastDeadlineDecayAtByMarket.get(String(item.market.id)) ?? 0;
          if (lastDecayAt && now.getTime() - lastDecayAt < NEWS_DEADLINE_DECAY_INTERVAL_MS) {
            const persisted = await recordMarketCheck(item.market.id, { status: "deadline_decay_rate_limited", checked_at: now.toISOString(), reference_probability: deadlineBefore?.probability ?? null, deadline_remaining_hours: deadlineRemainingHours });
            results.push(persisted ? { slug: item.market.slug, status: "no_change", reason: "deadline_decay_rate_limited", deadline_action: deadlineAction } : { slug: item.market.slug, status: "skipped_closed", reason: "deadline_decay_readback_failed", deadline_action: deadlineAction });
            continue;
          }
          if (deadlineBefore && deadlineBefore.probability <= 0.050000000001) {
            const persisted = await recordMarketCheck(item.market.id, { status: "deadline_decay_no_change", checked_at: now.toISOString(), reference_probability: 0.05, deadline_remaining_hours: deadlineRemainingHours });
            results.push(persisted ? { slug: item.market.slug, status: "no_change", reason: "deadline_floor_reached", deadline_action: deadlineAction } : { slug: item.market.slug, status: "skipped_closed", reason: "deadline_floor_readback_failed", deadline_action: deadlineAction });
            continue;
          }
          const decayCap = newsDeadlineDecayCap(deadlineRemainingHours) ?? 0.01;
          let { error: deadlineDecayError } = await admin.rpc("apply_news_deadline_decay_window", {
            p_market_id: item.market.id,
            p_reference_probability: 0.05,
            p_max_move: decayCap,
          });
          if (deadlineDecayError && /function .*apply_news_deadline_decay_window.*does not exist|could not find the function|outside (?:horizon-based )?deadline decay window/i.test(deadlineDecayError.message)) {
            if (deadlineRemainingHours !== null && deadlineRemainingHours <= 24) {
              ({ error: deadlineDecayError } = await admin.rpc("apply_news_deadline_decay", {
                p_market_id: item.market.id,
                p_reference_probability: 0.05,
              }));
            } else {
              const persisted = await recordMarketCheck(item.market.id, { status: "deadline_decay_migration_pending", checked_at: now.toISOString(), deadline_remaining_hours: deadlineRemainingHours });
              results.push(persisted ? { slug: item.market.slug, status: "no_change", reason: "deadline_decay_migration_pending", deadline_action: deadlineAction } : { slug: item.market.slug, status: "skipped_closed", reason: "deadline_decay_readback_failed", deadline_action: deadlineAction });
              continue;
            }
          }
          if (deadlineDecayError) throw new Error(`Could not apply deadline decay for ${item.market.slug}: ${deadlineDecayError.message}`);
          const persisted = await recordMarketCheck(item.market.id, { status: "deadline_decay", checked_at: now.toISOString(), reference_probability: 0.05, deadline_remaining_hours: deadlineRemainingHours });
          lastDeadlineDecayAtByMarket.set(String(item.market.id), now.getTime());
          const emailUpdate = persisted ? await deadlineChange("deadline_decay") : null;
          results.push(persisted ? { slug: item.market.slug, status: "deadline_decay", deadline_action: deadlineAction, ...(emailUpdate ? { email_update: emailUpdate } : {}) } : { slug: item.market.slug, status: "skipped_closed", reason: "deadline_decay_not_persisted", deadline_action: deadlineAction });
          continue;
        }
        if (item.evidence.length === 0) {
          const persisted = await recordMarketCheck(item.market.id, { status: "no_fresh_evidence", checked_at: now.toISOString(), evidence_count: 0 });
          results.push(persisted
            ? { slug: item.market.slug, status: "no_fresh_evidence", deadline_action: deadlineAction }
            : { slug: item.market.slug, status: "skipped_closed" });
          continue;
        }
        // Score only the already-filtered fresh evidence; social-only articles can
        // neither influence Groq nor reach the database adjustment boundary.
        const score = await scoreMarketWithAI(item.market as Market, item.evidence);
        const citedSlugs = Array.isArray(score.cited_slugs) ? score.cited_slugs.map(String) : [];
        if (!citedSlugs.length || !citedSlugs.some((slug) => item.evidence.some((article: { slug: string }) => article.slug === slug))) {
          throw new Error(`AI returned no valid citation for ${item.market.slug}.`);
        }
        const outcome = item.scoreSuccess(score);
        const evidence = item.evidence
          .filter((article: { slug: string }) => outcome.snapshot!.evidence_slugs.includes(article.slug))
          .map((article: { title: string; slug: string; source?: string; url?: string; imageUrl?: string }) => ({ title: article.title, slug: article.slug, source: article.source, url: article.url, imageUrl: article.imageUrl }));
        if (evidence.length === 0) throw new Error(`No verified cited evidence for ${item.market.slug}.`);
        if ("settlement" in outcome && outcome.settlement) {
          const { data: settlementRows, error: settlementError } = await admin.rpc("apply_verified_news_settlement", {
            p_market_id: item.market.id,
            p_outcome: outcome.settlement.outcome,
            p_oracle_reasoning: String(score.reasoning ?? ""),
            p_evidence_slugs: outcome.settlement.evidence_slugs,
            p_evidence: evidence,
            p_evidence_sources: evidence.map((article: { source?: string }) => String(article.source ?? "")).filter(Boolean),
          });
          if (settlementError) throw new Error(`Could not settle verified-news market ${item.market.slug}: ${settlementError.message}`);
          const settlement = Array.isArray(settlementRows) ? settlementRows[0] : null;
          if (!settlement) throw new Error(`Verified-news settlement did not return an audit result for ${item.market.slug}.`);
          const afterProbability = outcome.settlement.outcome === "PO" ? 1 : 0;
          const persisted = await recordMarketCheck(item.market.id, { status: "settled", checked_at: now.toISOString(), evidence_count: evidence.length, provider: score.provider, outcome: outcome.settlement.outcome });
          if (!persisted) { results.push({ slug: item.market.slug, status: "skipped_closed" }); continue; }
          results.push({
            slug: item.market.slug,
            status: "settled",
            provider: score.provider,
            fallback_index: score.fallback_index,
            fallback_reason: score.fallback_reason,
            email_update: {
              question: item.market.question,
              slug: item.market.slug,
              provider: score.provider,
              before_probability: Number(settlement.previous_price_yes),
              after_probability: afterProbability,
              absolute_percentage_point_change: Math.abs(afterProbability - Number(settlement.previous_price_yes)),
              timestamp: now.toISOString(),
              verified_sources: evidence.map((article: { source?: string; title: string; slug: string; url?: string }) => ({ label: String(article.source ?? "Verified source"), title: article.title, slug: article.slug, url: article.url })),
            },
          });
          continue;
        }
        if (!outcome.snapshot) throw new Error(outcome.audit.error ?? "Could not build news reference signal.");
        const latestNewsAt = evidence.map((article: { publishedAt: string }) => article.publishedAt).sort().at(-1) ?? now.toISOString();
        const oraclePayload = {
          p_market_id: item.market.id,
          p_reference_probability: outcome.snapshot.reference_probability,
          p_oracle_reasoning: outcome.snapshot.oracle_reasoning,
          p_evidence_slugs: outcome.snapshot.evidence_slugs,
          p_evidence: evidence,
          p_evidence_sources: outcome.snapshot.evidence_sources,
          p_last_news_at: latestNewsAt,
          p_requested_cap: outcome.snapshot.oracle_cap,
          p_evidence_fingerprint: outcome.snapshot.evidence_fingerprint,
          p_evidence_kind: outcome.snapshot.evidence_kind ?? "ordinary",
        };
        let { data: oracleRows, error: oracleError } = await admin.rpc("apply_news_oracle", oraclePayload);
        if (oracleError && /function .*apply_news_oracle.*does not exist|could not find the function/i.test(oracleError.message)) {
          // Rolling compatibility for a database before migration 0059. The
          // persisted snapshot ledger still prevents repeats in this state.
          const { p_evidence_fingerprint: _ignoredFingerprint, ...legacyPayload } = oraclePayload;
          ({ data: oracleRows, error: oracleError } = await admin.rpc("apply_news_oracle", legacyPayload));
        }
        if (oracleError) throw new Error(`Could not apply hybrid oracle for ${item.market.slug}: ${oracleError.message}`);
        const oracle = Array.isArray(oracleRows) ? oracleRows[0] : null;
        if (!oracle) throw new Error(`News oracle did not return an audit result for ${item.market.slug}.`);
        const priceChanged = Number(oracle.new_price_yes) !== Number(oracle.previous_price_yes);
        const scanStatus = priceChanged ? "oracle_applied" : "no_change";
        const persisted = await recordMarketCheck(item.market.id, {
          status: scanStatus,
          checked_at: now.toISOString(),
          evidence_count: evidence.length,
          provider: score.provider,
          fallback_index: score.fallback_index,
          evidence_slugs: outcome.snapshot.evidence_slugs,
          evidence_sources: outcome.snapshot.evidence_sources,
          evidence_fingerprint: outcome.snapshot.evidence_fingerprint,
          deadline_remaining_hours: outcome.snapshot.deadline_remaining_hours,
        });
        if (!persisted) {
          results.push({ slug: item.market.slug, status: "skipped_closed" });
          continue;
        }
        results.push({
          slug: item.market.slug,
          status: scanStatus,
          provider: score.provider,
          fallback_index: score.fallback_index,
          fallback_reason: score.fallback_reason,
          ...(priceChanged ? {
            email_update: {
              question: item.market.question,
              slug: item.market.slug,
              provider: score.provider,
              before_probability: Number(oracle.previous_price_yes),
              after_probability: Number(oracle.new_price_yes),
              absolute_percentage_point_change: Math.abs(Number(oracle.new_price_yes) - Number(oracle.previous_price_yes)),
              timestamp: now.toISOString(),
              remaining_hours: outcome.snapshot.deadline_remaining_hours,
              evidence_fingerprint: outcome.snapshot.evidence_fingerprint,
              verified_sources: evidence.map((article: { source?: string; title: string; slug: string; url?: string; publishedAt?: string }) => ({
                label: String(article.source ?? "Verified source"),
                title: article.title,
                slug: article.slug,
                url: article.url,
                published_at: article.publishedAt,
              })),
            },
          } : {}),
        });
      } catch (error) {
        // A failed score remains auditable and never pauses, reopens, or alters user ledgers.
        const message = String(error instanceof Error ? error.message : error);
        try {
          const persisted = await recordMarketCheck(item.market.id, { status: "oracle_failed", checked_at: now.toISOString(), evidence_count: item.evidence.length, error_class: errorClass(error) });
          results.push(persisted
            ? { slug: item.market.slug, status: "oracle_failed", error: message, error_class: errorClass(error) }
            : { slug: item.market.slug, status: "skipped_closed" });
        } catch (scanError) {
          results.push({ slug: item.market.slug, status: "oracle_failed", error: `${message}; scan persistence failed: ${String(scanError instanceof Error ? scanError.message : scanError)}`, error_class: errorClass(error) });
        }
      }
    }

    const successfulScores = results.filter((result) => result.status === "oracle_applied" || result.status === "settled");
    const emailUpdates = results.flatMap((result) => result.email_update ? [result.email_update] : []);
    const fallbacks = successfulScores.filter((result) => (result.fallback_index ?? 0) > 0);
    const skippedClosed = results.filter((result) => result.status === "skipped_closed");
    const details = {
      outcome: results.some((result) => result.status === "oracle_failed") ? "completed_with_market_errors" : "succeeded",
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      open_markets_scanned: (markets ?? []).length,
      open_markets_excluded: (openMarkets ?? []).length - (markets ?? []).length,
      markets_checked: results.filter((result) => result.status !== "skipped_closed").length,
      markets_with_evidence: plan.filter((item: { evidence: unknown[] }) => item.evidence.length > 0).length,
      updates_applied: emailUpdates.length,
      skipped_closed: skippedClosed.length,
      no_change: results.filter((result) => result.status === "no_change").length,
      provider_used: [...new Set(successfulScores.map((result) => result.provider ?? "unknown"))],
      fallback_index: fallbacks.length ? Math.max(...fallbacks.map((result) => result.fallback_index ?? 0)) : 0,
      fallback_reason: fallbacks[0]?.fallback_reason ?? null,
      error_class: results.find((result) => result.error_class)?.error_class ?? null,
      affected: emailUpdates.length,
      results,
      email_updates: emailUpdates,
      user_balances_positions_or_transactions_changed: false,
    };
    await finishRun(admin, started.run.id, "succeeded", details);
    return { ok: true, skipped: false, runKey, ...details };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await finishRun(admin, started.run.id, "failed", {
      outcome: "failed",
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      open_markets_scanned: 0,
      markets_checked: 0,
      markets_with_evidence: 0,
      updates_applied: 0,
      skipped_closed: 0,
      provider_used: [],
      fallback_index: 0,
      fallback_reason: null,
      error_class: errorClass(error),
    }, message);
    throw error;
  }
}

/** Existing local two-minute AI news repricer, retained as its own audit stream. */
export async function runRepriceAutomation(now = new Date()) {
  return runNewsReprice("reprice", twoMinuteRunKey(now), now);
}

/** Vercel's five-minute remote-only heartbeat: verified-news Groq, with Google fallback. */
export async function runTreguLiveAutomation(now = new Date()) {
  return runNewsReprice("tregu_live", fiveMinuteRunKey(now), now);
}


export async function runUpcomingF1TemplateAutomation(now = new Date()) {
  const admin = createAdminClient(); if (!admin) throw new Error("Supabase service-role configuration is required for F1 templates.");
  const runKey = `f1-template:${kosovoLocalDate(now)}:${String(now.getUTCHours()).padStart(2, "0")}:${Math.floor(now.getUTCMinutes() / 15)}`; const started = await beginRun(admin, "daily_drafts", runKey);
  if (started.existing) return { ok:true, skipped:true, runKey, reason:"already_processed", run:started.run };
  try {
    const { fetchUpcomingOpenF1Race, fetchOpenF1Roster, fetchF1OpeningFactors, buildUpcomingF1MarketTemplate } = await import("@/lib/f1-upcoming-race.mjs");
    const race = await fetchUpcomingOpenF1Race({ now, leadDays: 3 });
    if (!race) { await finishRun(admin, started.run.id, "succeeded", { created:0, reason:"no_race_within_three_days" }); return { ok:true, created:0, reason:"no_race_within_three_days" }; }
    const { data: existing, error: existingError } = await admin.from("markets").select("id,slug,status,reference_probabilities").contains("live_event", { event_id: race.event_id }).limit(1);
    if (existingError) throw new Error(`Could not check F1 template duplicate: ${existingError.message}`);
    const roster = await (fetchOpenF1Roster as any)({ sessionKey: race.session_key });
    const openingModel = await (fetchF1OpeningFactors as any)({ race, roster, now });
    const template = buildUpcomingF1MarketTemplate({ race, roster, openingModel, now });
    if (existing?.length) {
      const market = existing[0];
      if (market.status === "draft") {
        const { error: updateError } = await admin.from("markets").update({ live_event: template.live_event, reference_probabilities: template.reference_probabilities, outcome_quantities: template.outcome_quantities, sport_outcomes: template.sport_outcomes, pre_match_analysis: template.pre_match_analysis, updated_at: now.toISOString() }).eq("id", market.id).eq("status", "draft");
        if (updateError) throw new Error(`Could not refresh F1 template ${race.event_id}: ${updateError.message}`);
        const details = { created: 0, refreshed: 1, event_id: race.event_id, market: { id: market.id, slug: market.slug, status: market.status }, model_version: openingModel.model_version };
        await finishRun(admin, started.run.id, "succeeded", details);
        return { ok: true, ...details };
      }
      await finishRun(admin, started.run.id, "succeeded", { created: 0, refreshed: 0, reason: "already_exists", event_id: race.event_id });
      return { ok: true, created: 0, reason: "already_exists", event_id: race.event_id };
    }
    const { data, error } = await admin.from("markets").insert(template).select("id,slug,status").single();
    if (error) throw new Error(`Could not create F1 race template: ${error.message}`);
    await finishRun(admin, started.run.id, "succeeded", { created:1, event_id:race.event_id, market:data }); return { ok:true, created:1, event_id:race.event_id, market:data };
  } catch (error) { const message=String(error instanceof Error?error.message:error); await finishRun(admin, started.run.id, "failed", {}, message); throw error; }
}

async function f1ChampionshipRunKey(admin: any, now: Date, season: number) {
  const { data, error } = await admin.from("markets")
    .select("live_event,status")
    .eq("market_classification", "live_f1")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Could not inspect the active F1 race window: ${error.message}`);
  const raceWindow = (data ?? []).map((row: any) => row.live_event).find((event: any) => {
    if (!event || event.event_kind === "championship") return false;
    const raceStart = Date.parse(String(event.race_start ?? event.kickoff ?? ""));
    return Number.isFinite(raceStart) && now.getTime() >= raceStart - 30 * 60_000 && now.getTime() <= raceStart + 6 * 60 * 60_000;
  });
  if (raceWindow) {
    // Two minutes while the race is on, matching the race market's own clock.
    // A fifteen-minute bucket was fine when the title book only moved on a
    // published classification; now that the running order feeds it, a quarter
    // of an hour is most of a stint.
    return `f1-championship:v4:${season}:race-window:${raceWindow.event_id}:${Math.floor(now.getTime() / 120_000)}`;
  }
  return `f1-championship:v3:${season}:${kosovoLocalDate(now)}:${Math.floor(now.getTime() / (15 * 60_000))}`;
}

export async function runF1ChampionshipAutomation(now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for the F1 championship market.");
  const season = now.getUTCFullYear();
  const runKey = await f1ChampionshipRunKey(admin, now, season);
  const started = await beginRun(admin, "pre_match_refresh", runKey);
  if (started.existing) return { ok: true, skipped: true, runKey, reason: "already_processed", run: started.run };
  try {
    const { buildCurrentF1ChampionshipMarket, buildChampionshipMarketTemplate } = await import("@/lib/f1-championship.mjs");
    // The race on track feeds the title book. Every other market on the floor
    // reacts to a Grand Prix while it is being run; the championship was the
    // one that waited for the classification, so a driver could take
    // twenty-five points out of a rival's lead and the title odds would not
    // move for two hours. A live outage simply means no projection.
    let liveRace: unknown = null;
    try {
      liveRace = await fetchOpenF1LiveRace({ now });
    } catch {
      liveRace = null;
    }
    const championship = await buildCurrentF1ChampionshipMarket({ now, simulations: 5000, liveRace });
    const template = buildChampionshipMarketTemplate(championship, { now }) as any;
    const { data: matches, error: findError } = await admin.from("markets")
      .select("id,slug,status,b,live_score_state,reference_probabilities,sport_outcomes,outcome_quantities")
      .contains("live_event", { event_id: template.live_event.event_id })
      .limit(1);
    if (findError) throw new Error(`Could not find the F1 championship market: ${findError.message}`);

    let market = matches?.[0] as any;
    let created = 0;
    let rebased = false;
    if (!market) {
      const { data, error } = await admin.from("markets").insert(template).select("id,slug,status,live_score_state,reference_probabilities").single();
      if (error) throw new Error(`Could not create the F1 championship market: ${error.message}`);
      market = data;
      created = 1;
    } else if (market.status === "open" && market.live_score_state?.key !== template.live_score_state.key) {
      const oldKeys = (market.sport_outcomes ?? []).map((outcome: any) => String(outcome?.key ?? "")).filter(Boolean);
      const newKeys = template.sport_outcomes.map((outcome: any) => String(outcome?.key ?? "")).filter(Boolean);
      const removedKeys = oldKeys.filter((key: string) => !newKeys.includes(key));
      const modelChanged = market.live_score_state?.championship?.version !== championship.model.version;
      const rosterChanged = oldKeys.length !== newKeys.length || oldKeys.some((key: string) => !newKeys.includes(key));

      if (modelChanged || rosterChanged) {
        if (removedKeys.length) {
          const { data: exposedPositions, error: positionError } = await admin.from("positions")
            .select("id,side,shares")
            .eq("market_id", market.id)
            .in("side", removedKeys)
            .gt("shares", 0)
            .limit(1);
          if (positionError) throw new Error(`Could not verify stale F1 seats: ${positionError.message}`);
          if (exposedPositions?.length) throw new Error(`Cannot remove an F1 outcome with an open position: ${exposedPositions[0].side}`);
        }
        const liquidity = Number(market.b);
        const oldReference = market.reference_probabilities ?? {};
        const oldQuantities = market.outcome_quantities ?? {};
        const quantities = Object.fromEntries(newKeys.map((key: string) => {
          const oldProbability = Number(oldReference[key]);
          const oldQuantity = Number(oldQuantities[key]);
          const tradeDelta = Number.isFinite(oldQuantity) && oldProbability > 0
            ? oldQuantity - liquidity * Math.log(oldProbability)
            : 0;
          return [key, liquidity * Math.log(Math.max(0.000001, Number(championship.probabilities[key]))) + tradeDelta];
        }));
        const state = {
          ...template.live_score_state,
          previous_probabilities: market.reference_probabilities ?? null,
          rebase_reason: rosterChanged ? "roster_and_model_upgrade" : "model_upgrade",
        };
        const { error: rebaseError } = await admin.from("markets").update({
          sport_outcomes: template.sport_outcomes,
          outcome_quantities: quantities,
          reference_probabilities: championship.probabilities,
          live_score_state: state,
          pre_match_analysis: template.pre_match_analysis,
          closes_at: template.closes_at,
          updated_at: now.toISOString(),
        }).eq("id", market.id).eq("status", "open");
        if (rebaseError) throw new Error(`Could not rebase the F1 championship book: ${rebaseError.message}`);
        const { error: snapshotError } = await admin.from("market_snapshots").insert({
          market_id: market.id,
          market_prob: Math.max(...Object.values(championship.probabilities).map(Number)),
          evidence: [{ title: "F1 championship model upgrade", url: championship.sourceUrl, probabilities: championship.probabilities, model: championship.model }],
          reasoning: "Roster-safe model upgrade preserving existing driver trade deltas.",
          oracle_kind: "f1_vector",
        });
        if (snapshotError) throw new Error(`Could not record the F1 championship rebase: ${snapshotError.message}`);
        rebased = true;
      } else {
      const state = {
        key: template.live_score_state.key,
        source_url: championship.sourceUrl,
        source_provider: "OpenF1",
        previous_probabilities: market.reference_probabilities ?? null,
        championship: championship.model,
      };
      const { error } = await admin.rpc("apply_f1_race_winner_oracle", {
        p_market_id: market.id,
        p_state: state,
        p_probabilities: championship.probabilities,
        p_evidence: [{ title: "OpenF1 championship model", url: championship.sourceUrl, probabilities: championship.probabilities, model: championship.model }],
        p_reasoning: "Monte Carlo: standings, recent form, race pace, speed, reliability, constructor strength and remaining-track fit.",
        p_cap: 0.05,
        p_final: championship.model.decided,
        p_winner: championship.model.decided ? championship.outcomes.find((outcome: any) => outcome.driver_number === championship.model.winnerDriverNumber)?.key ?? null : null,
      });
      if (error) throw new Error(`Could not update the F1 championship vector: ${error.message}`);
      await admin.from("markets").update({
        pre_match_analysis: { source: "OpenF1", model: championship.model, updated_at: now.toISOString() },
        closes_at: template.closes_at,
        sport_outcomes: template.sport_outcomes,
      }).eq("id", market.id).eq("status", "open");
      }
    }

    let settled = false;
    if (championship.model.decided && market.status === "open") {
      const winner = championship.outcomes.find((outcome: any) => outcome.driver_number === championship.model.winnerDriverNumber)?.key;
      if (!winner) throw new Error("The decided F1 title has no matching market outcome.");
      const decidedAt = now.toISOString();
      const { data: closed, error: closeError } = await admin.from("markets").update({
        status: "closed",
        outcome: winner,
        official_final_at: decidedAt,
        settlement_due_at: decidedAt,
        closes_at: decidedAt,
        updated_at: decidedAt,
      })
        .eq("id", market.id)
        .eq("status", "open")
        .contains("live_event", { event_kind: "championship", source_provider: "OpenF1" })
        .eq("live_score_state->>key", template.live_score_state.key)
        .select("id")
        .maybeSingle();
      if (closeError) throw new Error(`Could not close the decided F1 championship market: ${closeError.message}`);
      if (!closed) throw new Error("The F1 championship settlement state changed before the market could close.");
      const { error: settlementError } = await admin.rpc("settle_due_sport_markets");
      if (settlementError) throw new Error(`Could not settle the F1 championship market: ${settlementError.message}`);
      settled = true;
    }
    const details = { created, updated: created ? 0 : 1, rebased, settled, season, market: { id: market.id, slug: market.slug }, state_key: template.live_score_state.key, races_remaining: championship.model.racesRemaining, model_version: championship.model.version };
    await finishRun(admin, started.run.id, "succeeded", details);
    return { ok: true, skipped: false, runKey, ...details };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await finishRun(admin, started.run.id, "failed", {}, message);
    throw error;
  }
}

export async function runUpcomingFootballTemplateAutomation(now = new Date()) {
  const admin = createAdminClient(); if (!admin) throw new Error("Supabase service-role configuration is required for football templates.");
  const runKey = `football-template:opening-v4:${kosovoLocalDate(now)}:${String(now.getUTCHours()).padStart(2, "0")}:${Math.floor(now.getUTCMinutes() / 15)}`; const started = await beginRun(admin, "pre_match_refresh", runKey);
  if (started.existing) return { ok:true, skipped:true, runKey, reason:"already_processed", run:started.run };
  try {
    const { fetchUpcomingEspnFootballFixtures, buildUpcomingFootballTemplate } = await import("@/lib/espn-upcoming-football.mjs");
    const fixtures = await fetchUpcomingEspnFootballFixtures({ now, windowHours:72 }); const created=[]; const refreshed=[]; const unchanged=[];
    for (const fixture of fixtures) {
      const { data: existing, error: checkError } = await admin.from("markets").select("id,status,slug,live_event,live_score_state,reference_probabilities").contains("live_event", { event_id:fixture.event_id }).limit(1);
      if (checkError) throw new Error(`Could not check football template duplicate: ${checkError.message}`);
      const template=buildUpcomingFootballTemplate(fixture);
      if (existing?.length) {
        const market = existing[0];
        if (market.status === "draft") {
          const { error: updateError } = await admin.from("markets").update({ live_event:template.live_event, reference_probabilities:template.reference_probabilities, outcome_quantities:template.outcome_quantities, b:template.b, pre_match_analysis:template.pre_match_analysis, updated_at:now.toISOString() }).eq("id",market.id).eq("status","draft");
          if (updateError) throw new Error(`Could not calibrate football template ${fixture.event_id}: ${updateError.message}`);
          refreshed.push({ id:market.id,slug:market.slug,status:"draft",target_probabilities:template.reference_probabilities });
        } else if (market.status === "open") {
          // The current builder embeds its source-backed opening model directly in
          // reference_probabilities; older drafts may carry an explicit opening_model.
          const preMatch = template.pre_match_analysis as Record<string, any>;
          const model = (preMatch.opening_model ?? {
            model_version: "upcoming_football_template",
            probabilities: template.reference_probabilities,
          }) as any;
          const current = market.reference_probabilities ?? {};
          const target = template.reference_probabilities;
          const atTarget = ["home", "draw", "away"].every((key) => Math.abs(Number(current[key] ?? 0) - Number(target[key] ?? 0)) <= 1e-12);
          if (atTarget) {
            unchanged.push({ id:market.id,slug:market.slug,status:"open",unchanged:true,target_probabilities:target });
            continue;
          }
          const stateValues = ["home", "draw", "away"].map((key) => `${key}:${Number(current[key] ?? 0).toFixed(12)}:${Number(target[key] ?? 0).toFixed(12)}`).join("|");
          const state = {
            key: `pre_match_model:${model.model_version ?? "v1"}:${fixture.event_id}:${stateValues}`,
            status: "STATUS_SCHEDULED",
            detail: "Scheduled",
            competitors: [{ team: fixture.home.name, homeAway: "home", score: null }, { team: fixture.away.name, homeAway: "away", score: null }],
            source_url: fixture.source_url,
            kickoff: fixture.kickoff,
            has_official_score: false,
            bookmaker_odds: (fixture as any).bookmaker_odds ?? null,
            model_version: model.model_version ?? null,
          };
          const evidence = [{
            kind: "pre_match_model",
            model_version: model.model_version ?? null,
            target_probabilities: model.probabilities,
            team_model_probabilities: model.team_model_probabilities ?? null,
            bookmaker_probabilities: model.bookmaker_probabilities ?? null,
            bookmaker_odds: model.bookmaker_odds ?? null,
            sources: model.sources,
          }];
          const { error: analysisError } = await admin.from("markets").update({ live_event:template.live_event, pre_match_analysis:template.pre_match_analysis }).eq("id",market.id).eq("status","open");
          if (analysisError) throw new Error(`Could not persist pre-match analysis ${fixture.event_id}: ${analysisError.message}`);
          const { error: oracleError } = await admin.rpc("apply_sport_market_oracle", {
            p_market_id: market.id,
            p_provider: "espn",
            p_event_id: fixture.event_id,
            p_state: state,
            p_reference_probabilities: model.probabilities,
            p_evidence: evidence,
            p_reasoning: model.method,
            p_requested_cap: 0.10,
            p_close_market: false,
            p_verified_outcome: null,
            p_settlement_due_at: null,
          });
          if (oracleError) throw new Error(`Could not apply pre-match football oracle ${fixture.event_id}: ${oracleError.message}`);
          refreshed.push({ id:market.id,slug:market.slug,status:"open",target_probabilities:model.probabilities,oracle_cap:0.10 });
        }
        continue;
      }
      const { data, error }=await admin.from("markets").insert(template).select("id,slug,status").single();
      if (error) throw new Error(`Could not create football template ${fixture.event_id}: ${error.message}`); created.push(data);
    }
    await finishRun(admin, started.run.id, "succeeded", { created:created.length, refreshed:refreshed.length, unchanged:unchanged.length, fixtures:fixtures.length, markets:created, refreshed_markets:refreshed, unchanged_markets:unchanged }); return { ok:true, created:created.length, refreshed:refreshed.length, unchanged:unchanged.length, fixtures:fixtures.length, markets:created, refreshed_markets:refreshed, unchanged_markets:unchanged };
  } catch (error) { const message=String(error instanceof Error?error.message:error); await finishRun(admin, started.run.id, "failed", {}, message); throw error; }
}
