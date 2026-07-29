import { getArticles } from "@/lib/db";
import { liveHeadlinesFor } from "@/lib/live-news";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreMarketWithAI, slugifyQuestion, type Market } from "@/lib/tregu";
import { buildDailyDraftPlan, buildLiveEventDraftRunKey, buildRepricePlan, repriceMarketSkipReason, validateDailyDraftSubmission } from "@/lib/tregu-automation.mjs";
import { kosovoLocalDate } from "@/lib/tregu-date-key.mjs";
import { fetchEspnLiveEvents } from "@/lib/espn-live-score.mjs";
import { ARGENTINA_SPAIN_PAIR, buildArgentinaSpainPairedBinaryPlan, buildSportMarketPlan } from "@/lib/tregu-sport-market.mjs";
import { buildF1MarketPlan, buildF1RaceWinnerPlan, buildF1SettlementPlan, openF1ToWinnerLeaderboard } from "@/lib/f1-live-lite.mjs";
import { fetchOpenF1LiveRace } from "@/lib/openf1-live.mjs";
import { classifyProviderFailure } from "@/lib/tregu-ai-provider.mjs";
import { hasPersistedMaterialPairedBinaryChange } from "@/lib/tregu-live-email-content.mjs";
import { sendTreguLiveNotification } from "@/lib/tregu-live-email";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type RunAction = "daily_drafts" | "reprice" | "live_sports" | "tregu_live";

function oneMinuteRunKey(now: Date): string {
  const bucket = Math.floor(now.getTime() / 60_000) * 60_000;
  return `live-sports:${new Date(bucket).toISOString()}`;
}

function twoMinuteRunKey(now: Date): string {
  const bucket = Math.floor(now.getTime() / 120_000) * 120_000;
  return `reprice:${new Date(bucket).toISOString()}`;
}

function fiveMinuteRunKey(now: Date): string {
  const bucket = Math.floor(now.getTime() / 300_000) * 300_000;
  return `tregu-live:${new Date(bucket).toISOString()}`;
}

async function beginRun(admin: AdminClient, action: RunAction, runKey: string) {
  const { data: existing, error: findError } = await admin
    .from("market_automation_runs")
    .select("id, status, details, error")
    .eq("run_key", runKey)
    .maybeSingle();
  if (findError) throw new Error(`Could not check automation idempotency: ${findError.message}`);
  if (existing) return { existing: true, run: existing };

  const { data: created, error } = await admin
    .from("market_automation_runs")
    .insert({ run_key: runKey, action, status: "running" })
    .select("id")
    .single();
  if (error) {
    const { data: raced } = await admin
      .from("market_automation_runs")
      .select("id, status, details, error")
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

export async function runDailyDraftAutomation(candidates: unknown, now = new Date(), requestedRunKey?: unknown) {
  if (requestedRunKey !== undefined && typeof requestedRunKey !== "string") throw new Error("Invalid live-event draft run key.");
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const sourceArticles = await getArticles(30);
  const validated = validateDailyDraftSubmission(candidates, new Set(sourceArticles.map((article) => article.slug)));
  if (!validated.ok) throw new Error(validated.error);
  const expectedLiveEventRunKey = typeof requestedRunKey === "string" ? buildLiveEventDraftRunKey({ candidates, now }) : null;
  if (expectedLiveEventRunKey && requestedRunKey !== expectedLiveEventRunKey) throw new Error("Invalid live-event draft run key.");
  const runKey = expectedLiveEventRunKey ?? `daily-drafts:${kosovoLocalDate(now)}`;
  const started = await beginRun(admin, "daily_drafts", runKey);
  if (started.existing) return { ok: true, skipped: true, runKey, reason: "already_processed", run: started.run };

  try {
    const { data: existingMarkets, error: existingError } = await admin.from("markets").select("question");
    if (existingError) throw new Error(`Could not load existing markets: ${existingError.message}`);

    const plan = buildDailyDraftPlan({
      candidates: validated.candidates,
      existingQuestions: (existingMarkets ?? []).map((market) => String(market.question)),
      now,
    });
    if (expectedLiveEventRunKey && plan.rows.length !== 4) {
      throw new Error("Live-event submission must create exactly four unique review-only draft cards.");
    }
    const dateSuffix = kosovoLocalDate(now).replace(/-/g, "");
    const rows = plan.rows.map((row, index) => ({
      ...row,
      slug: `${slugifyQuestion(row.question) || "treg"}-${dateSuffix}-${index + 1}`,
    }));
    if (rows.length < 3 || rows.length > 5) {
      throw new Error("Codex draft payload must produce 3 to 5 unique draft markets after validation.");
    }
    let createdMarkets: Array<Record<string, unknown>> = [];
    if (rows.length) {
      const { data, error } = await admin.from("markets").insert(rows).select();
      if (error) throw new Error(`Could not insert market drafts: ${error.message}`);
      createdMarkets = data ?? [];
    }
    const details = { created: rows.length, rejected: plan.rejected, admin_approval_required: true };
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

/** Validates and renders a no-write draft preview. It never allocates a run key or inserts a market. */
export async function previewDailyDraftAutomation(candidates: unknown, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const sourceArticles = await getArticles(30);
  const validated = validateDailyDraftSubmission(candidates, new Set(sourceArticles.map((article) => article.slug)));
  if (!validated.ok) throw new Error(validated.error);
  const { data: existingMarkets, error } = await admin.from("markets").select("question");
  if (error) throw new Error(`Could not load existing markets: ${error.message}`);
  const plan = buildDailyDraftPlan({ candidates: validated.candidates, existingQuestions: (existingMarkets ?? []).map((market) => String(market.question)), now });
  return { ok: true, preview: true, created: 0, rejected: plan.rejected, markets: plan.rows };
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
    const events = await fetchEspnLiveEvents([...standardMarkets.map((market) => market.live_event), ...(pairMarkets.length === 2 ? [ARGENTINA_SPAIN_PAIR.event] : [])]);
    const signals = buildSportMarketPlan({ markets: standardMarkets, events, now });
    const pairedSignals = buildArgentinaSpainPairedBinaryPlan({ markets: pairMarkets, events, now });
    const results: Array<{ slug: string; status: "applied" | "no_change" | "no_score" | "awaiting_official_winner" | "failed"; error?: string }> = [];
    const pairedBinaryEmailUpdates: Array<{ persisted: true; material_change: true; timestamp: string; state: Record<string, unknown> }> = [];
    const f1Results: Array<{ slug: string; status: "applied" | "unchanged" | "unavailable" | "failed"; error?: string }> = [];
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
          results.push({ slug: signal.market.slug, status: "no_score" });
          continue;
        }
        if (signal.kind === "final_unresolved") {
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
        if (signal.material_change === true) pairedBinaryEmailUpdates.push({ persisted: true, material_change: true, timestamp: now.toISOString(), state: signal.state });
      } catch (pairOracleError) {
        const error = String(pairOracleError instanceof Error ? pairOracleError.message : pairOracleError);
        results.push({ slug: signal.spainMarket.slug, status: "failed", error }, { slug: signal.argentinaMarket.slug, status: "failed", error });
      }
    }
    const f1EmailUpdates: Array<{ question: string; driver_code: string; position: number; gap: string; pits: number; before_probability: number; after_probability: number; source_url: string }> = [];
    if ((f1Markets ?? []).length) {
      try {
        const openF1Live = await fetchOpenF1LiveRace({ now });
        const leaderboard = openF1ToWinnerLeaderboard(openF1Live);
        if (!leaderboard) throw new Error("OpenF1 did not expose a complete active race session.");
        const f1Signals = buildF1MarketPlan({ markets: f1Markets, leaderboard });
        const f1RaceWinnerSignals = buildF1RaceWinnerPlan({ markets: f1Markets, leaderboard });
        for (const signal of f1RaceWinnerSignals) {
          try {
            const { error: f1RaceOracleError } = await admin.rpc("apply_f1_race_winner_oracle", { p_market_id: signal.market.id, p_state: signal.state, p_probabilities: signal.probabilities, p_evidence: signal.evidence, p_reasoning: signal.reasoning, p_cap: signal.oracle_cap, p_final: false, p_winner: null });
            if (f1RaceOracleError) throw new Error(f1RaceOracleError.message);
            const { error: f1SnapshotError } = await admin.rpc("record_f1_vector_snapshot", { p_market_id: signal.market.id, p_state: signal.state, p_probabilities: signal.probabilities, p_reasoning: signal.reasoning });
            if (f1SnapshotError) throw new Error(f1SnapshotError.message);
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
            f1EmailUpdates.push({ question: signal.market.question, driver_code: signal.config.driver_code, position: signal.row.position, gap: signal.row.gap, pits: signal.row.pits, before_probability: Number(oracle.previous_price_yes), after_probability: Number(oracle.new_price_yes), source_url: leaderboard.source_url });
          } catch (f1OracleError) { f1Results.push({ slug: signal.market.slug, status: "failed", error: String(f1OracleError instanceof Error ? f1OracleError.message : f1OracleError) }); }
        }
        // A FINISHED classification settles explicitly mapped markets only via
        // the existing idempotent settlement authority; provisional rows cannot settle.
        for (const settlement of buildF1SettlementPlan({ markets: f1Markets, leaderboard })) {
          const { error: resolveError } = await admin.rpc("resolve_market", { p_market_id: settlement.market.id, p_outcome: settlement.outcome });
          if (resolveError) throw new Error(`Could not settle F1 ${settlement.market.slug}: ${resolveError.message}`);
        }
      } catch (f1Error) {
        for (const market of f1Markets ?? []) f1Results.push({ slug: market.slug, status: "unavailable", error: String(f1Error instanceof Error ? f1Error.message : f1Error) });
      }
    }
    const { data: settled, error: settlementError } = await admin.rpc("settle_due_sport_markets");
    if (settlementError) throw new Error(`Could not settle verified sport markets: ${settlementError.message}`);
    const officialUpdates = results.filter((result) => result.status === "applied").length + f1Results.filter((result) => result.status === "applied").length + Number(settled ?? 0);
    const details = { official_espn_events: signals.length, results, official_f1_markets: (f1Markets ?? []).length, f1_results: f1Results, f1_email_updates: f1EmailUpdates, settled_market_count: settled ?? 0, official_updates: officialUpdates, paired_binary_email_updates: pairedBinaryEmailUpdates, user_trade_ledger_changed_only_by_due_settlement: true };
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
    return { ok: true, skipped: false, runKey, ...details };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await finishRun(admin, started.run.id, "failed", {}, message);
    throw error;
  }
}

/** One-minute official sports/settlement unit. It is deliberately isolated from news repricing. */
export async function runLiveSportsAutomation(now = new Date()) {
  const [template, footballTemplate] = await Promise.all([
    runUpcomingF1TemplateAutomation(now),
    runUpcomingFootballTemplateAutomation(now).catch((error) => ({
      ok: false,
      error: String(error instanceof Error ? error.message : error),
    })),
  ]);
  const live = await runOfficialSportsRefresh("live_sports", oneMinuteRunKey(now), now);
  return { ...live, f1_template: template, football_template: footballTemplate };
}

/** Shared news-only AI repricer. The caller selects an explicit audit action and idempotency bucket. */
async function runNewsReprice(action: "reprice" | "tregu_live", runKey: string, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service-role configuration is required for Tregu automation.");
  const started = await beginRun(admin, action, runKey);
  if (started.existing) return { ok: true, skipped: true, runKey, reason: "already_processed", run: started.run };
  const startedAt = Date.now();

  try {
    const { data: markets, error: marketsError } = await admin.from("markets").select("*").eq("status", "open");
    if (marketsError) throw new Error(`Could not load open markets: ${marketsError.message}`);

    // Per-market external discovery only. Never use 383's article pool as repricing evidence.
    const researchedMarkets = await Promise.all((markets ?? []).map(async (market) => {
      const headlines = await liveHeadlinesFor(String(market.question ?? ""), market.category as Parameters<typeof liveHeadlinesFor>[1]);
      return { market, articles: headlines.map((headline, index) => ({
        slug: `google-news:${encodeURIComponent(`${headline.source}:${headline.title}`).slice(0, 180)}:${index}`,
        category: "external-google-news", publishedAt: new Date(now.getTime() - headline.ageMin * 60_000).toISOString(),
        source: headline.source, title: headline.title, excerpt: headline.title, verification: "external_google_news",
      })) };
    }));
    const plan = researchedMarkets.flatMap(({ market, articles }) => buildRepricePlan({ markets: [market], verifiedArticles: articles, now }));
    const results: Array<{
      slug: string;
      status: "oracle_applied" | "settled" | "deadline_settled" | "deadline_decay" | "oracle_failed" | "no_change" | "no_fresh_evidence" | "skipped_closed";
      provider?: string;
      fallback_index?: number;
      fallback_reason?: string | null;
      error?: string;
      error_class?: string;
      email_update?: {
        question: string;
        slug: string;
        provider: string;
        before_probability: number;
        after_probability: number;
        absolute_percentage_point_change: number;
        timestamp: string;
        verified_sources: Array<{ label: string; title: string; slug: string; url?: string }>;
      };
    }> = [];
    const recordMarketCheck = async (marketId: string, scan: Record<string, unknown>) => {
      const { data, error } = await admin
        .from("markets")
        .update({ last_checked_at: now.toISOString(), last_scan_result: scan })
        .eq("id", marketId)
        .eq("status", "open")
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
          .select("id, status, closes_at")
          .eq("id", item.market.id)
          .maybeSingle();
        if (currentMarketError) throw new Error(`Could not recheck market ${item.market.slug}: ${currentMarketError.message}`);
        if (item.deadline?.requires_deadline_oracle) {
          const { error: deadlineError } = await admin.rpc("apply_news_deadline_settlement", { p_market_id: item.market.id });
          if (deadlineError) throw new Error(`Could not apply deadline settlement for ${item.market.slug}: ${deadlineError.message}`);
          results.push({ slug: item.market.slug, status: "deadline_settled" });
          continue;
        }
        if (repriceMarketSkipReason(currentMarket, now)) {
          results.push({ slug: item.market.slug, status: "skipped_closed" });
          continue;
        }
        if (item.deadline && !item.deadline.requires_deadline_oracle && item.deadline.reference_probability != null) {
          const { error: deadlineDecayError } = await admin.rpc("apply_news_deadline_decay", {
            p_market_id: item.market.id,
            p_reference_probability: item.deadline.reference_probability,
          });
          if (deadlineDecayError) throw new Error(`Could not apply deadline decay for ${item.market.slug}: ${deadlineDecayError.message}`);
          const persisted = await recordMarketCheck(item.market.id, { status: "deadline_decay", checked_at: now.toISOString(), reference_probability: item.deadline.reference_probability });
          results.push(persisted ? { slug: item.market.slug, status: "deadline_decay" } : { slug: item.market.slug, status: "skipped_closed" });
          continue;
        }
        if (item.evidence.length === 0) {
          const persisted = await recordMarketCheck(item.market.id, { status: "no_fresh_evidence", checked_at: now.toISOString(), evidence_count: 0 });
          results.push(persisted
            ? { slug: item.market.slug, status: "no_fresh_evidence" }
            : { slug: item.market.slug, status: "skipped_closed" });
          continue;
        }
        // Score only the already-filtered fresh evidence; social-only articles can
        // neither influence Groq nor reach the database adjustment boundary.
        const score = await scoreMarketWithAI(item.market as Market, item.evidence);
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
        const latestNewsAt = item.evidence.map((article: { publishedAt: string }) => article.publishedAt).sort().at(-1) ?? now.toISOString();
        const { data: oracleRows, error: oracleError } = await admin.rpc("apply_news_oracle", {
          p_market_id: item.market.id,
          p_reference_probability: outcome.snapshot.reference_probability,
          p_oracle_reasoning: outcome.snapshot.oracle_reasoning,
          p_evidence_slugs: outcome.snapshot.evidence_slugs,
          p_evidence: evidence,
          p_evidence_sources: outcome.snapshot.evidence_sources,
          p_last_news_at: latestNewsAt,
          p_requested_cap: outcome.snapshot.oracle_cap,
          p_evidence_kind: outcome.snapshot.evidence_kind,
        });
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
              verified_sources: evidence.map((article: { source?: string; title: string; slug: string; url?: string }) => ({
                label: String(article.source ?? "Verified source"),
                title: article.title,
                slug: article.slug,
                url: article.url,
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
    const fallbacks = successfulScores.filter((result) => (result.fallback_index ?? 0) > 0);
    const skippedClosed = results.filter((result) => result.status === "skipped_closed");
    const details = {
      outcome: results.some((result) => result.status === "oracle_failed") ? "completed_with_market_errors" : "succeeded",
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      open_markets_scanned: (markets ?? []).length,
      markets_checked: results.filter((result) => result.status !== "skipped_closed").length,
      markets_with_evidence: plan.filter((item: { evidence: unknown[] }) => item.evidence.length > 0).length,
      updates_applied: successfulScores.length,
      skipped_closed: skippedClosed.length,
      no_change: results.filter((result) => result.status === "no_change").length,
      provider_used: [...new Set(successfulScores.map((result) => result.provider ?? "unknown"))],
      fallback_index: fallbacks.length ? Math.max(...fallbacks.map((result) => result.fallback_index ?? 0)) : 0,
      fallback_reason: fallbacks[0]?.fallback_reason ?? null,
      error_class: results.find((result) => result.error_class)?.error_class ?? null,
      affected: successfulScores.length,
      results,
      email_updates: successfulScores.flatMap((result) => result.email_update ? [result.email_update] : []),
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
  const runKey = `f1-template:${kosovoLocalDate(now)}`; const started = await beginRun(admin, "daily_drafts", runKey);
  if (started.existing) return { ok:true, skipped:true, runKey, reason:"already_processed", run:started.run };
  try {
    const { fetchUpcomingOpenF1Race, fetchOpenF1Roster, buildUpcomingF1MarketTemplate } = await import("@/lib/f1-upcoming-race.mjs");
    const race = await fetchUpcomingOpenF1Race({ now, leadDays: 3 });
    if (!race) { await finishRun(admin, started.run.id, "succeeded", { created:0, reason:"no_race_within_three_days" }); return { ok:true, created:0, reason:"no_race_within_three_days" }; }
    const { data: existing, error: existingError } = await admin.from("markets").select("id,slug").contains("live_event", { event_id: race.event_id }).limit(1);
    if (existingError) throw new Error(`Could not check F1 template duplicate: ${existingError.message}`);
    if (existing?.length) { await finishRun(admin, started.run.id, "succeeded", { created:0, reason:"already_exists", event_id:race.event_id }); return { ok:true, created:0, reason:"already_exists", event_id:race.event_id }; }
    const roster = await (fetchOpenF1Roster as any)({ sessionKey: race.session_key });
    const template = buildUpcomingF1MarketTemplate({ race, roster, now });
    const { data, error } = await admin.from("markets").insert(template).select("id,slug,status").single();
    if (error) throw new Error(`Could not create F1 race template: ${error.message}`);
    await finishRun(admin, started.run.id, "succeeded", { created:1, event_id:race.event_id, market:data }); return { ok:true, created:1, event_id:race.event_id, market:data };
  } catch (error) { const message=String(error instanceof Error?error.message:error); await finishRun(admin, started.run.id, "failed", {}, message); throw error; }
}

export async function runUpcomingFootballTemplateAutomation(now = new Date()) {
  const admin = createAdminClient(); if (!admin) throw new Error("Supabase service-role configuration is required for football templates.");
  const runKey = `football-template:${kosovoLocalDate(now)}`; const started = await beginRun(admin, "daily_drafts", runKey);
  if (started.existing) return { ok:true, skipped:true, runKey, reason:"already_processed", run:started.run };
  try {
    const { fetchUpcomingEspnFootballFixtures, buildUpcomingFootballTemplate } = await import("@/lib/espn-upcoming-football.mjs");
    const fixtures = await fetchUpcomingEspnFootballFixtures({ now, windowHours:72 }); const created=[];
    for (const fixture of fixtures) {
      const { data: existing, error: checkError } = await admin.from("markets").select("id").contains("live_event", { event_id:fixture.event_id }).limit(1);
      if (checkError) throw new Error(`Could not check football template duplicate: ${checkError.message}`);
      if (existing?.length) continue;
      const template=buildUpcomingFootballTemplate(fixture); const { data, error }=await admin.from("markets").insert(template).select("id,slug,status").single();
      if (error) throw new Error(`Could not create football template ${fixture.event_id}: ${error.message}`); created.push(data);
    }
    await finishRun(admin, started.run.id, "succeeded", { created:created.length, fixtures:fixtures.length, markets:created }); return { ok:true, created:created.length, fixtures:fixtures.length, markets:created };
  } catch (error) { const message=String(error instanceof Error?error.message:error); await finishRun(admin, started.run.id, "failed", {}, message); throw error; }
}
