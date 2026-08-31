import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "Lind-hack/383lajme";
const PRODUCTION_BRANCH = "main";
const PRODUCTION_REPOSITORY_OWNER = "Lind-hack";
const PRODUCTION_REPOSITORY_SLUG = "383lajme";
const PRODUCTION_REPOSITORY_ID = "1245103522";
const CHART_UI_VERSION = "smooth-inspector-v3";
const F1_RACE_UI_VERSION = "race-grid-v3";
const FOOTBALL_MARKET_UI_VERSION = "stage-aware-v3";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");

/**
 * Invariants. Losing any of these is a behaviour regression, not a refactor:
 * how a market settles, how a bet is placed or sold, what the migrations
 * constrain, how production proves it came from GitHub main, and the build
 * hooks that run this guard at all. A missing marker here fails the build.
 *
 * This set is what caught b256881, the stale overlay that quietly reverted
 * two-legged tie settlement and deleted the guard in the same commit.
 */
const REQUIRED_CHART_MARKERS = {
  "app/tregu/[slug]/page.tsx": [
    'kind: "f1_race_winner"',
    "outcomeKey: f1OutcomeKey",
    'kind: "sport_outcome"',
    "outcomeKey: selectedOutcome.key",
    "previewSportOutcomeSell",
    "canSellFootball",
  ],
  "app/api/tregu/markets/[slug]/route.ts": [
    'market.market_type === "two_outcome" || market.market_type === "three_outcome"',
    "sport_oracle_events",
    "outcome_prices",
    "aggregate_then_extra_time_then_penalties",
  ],
  "lib/football-market-format.mjs": [
    "export function classifyFootballFixture(",
    'marketIntent: decisive ? "to_qualify" : "match_result"',
    'outcomeMode: decisive ? "two_way" : "three_way"',
    "leg === 2",
  ],
  "lib/espn-upcoming-football.mjs": [
    "classifyFootballFixture",
    'status: "open"',
    "football_format: footballFormat",
    "outcomes: outcomeKeys",
  ],
  "lib/football-pre-match.mjs": [
    "buildFootballOpeningModel",
    "americanOddsToProbability",
    "market_value_status",
  ],
  "lib/f1-pre-match.mjs": [
    "buildF1RaceWinnerOpeningModel",
    "simulator_probability",
    "circuitHistory",
  ],
  "supabase/migrations/0049_tregu_f1_race_winner_oracle.sql": [
    "apply_f1_race_winner_oracle",
    "record_f1_vector_snapshot",
    "f1_vector",
  ],
  "app/api/tregu/markets/[slug]/live/route.ts": [
    "lmsrSportOutcomePrices",
    "f1History",
    "Vercel-CDN-Cache-Control",
  ],
  "components/tregu/exact-market-chart.tsx": [
    "const displayPoints = item.points.length ? item.points : item.hold ? [item.hold] : []",
    "displayPoints.length >= 1",
    "!model.hasDisplayData",
  ],
  "lib/tregu-probability-domain.mjs": [
    "const hold = start == null ? undefined",
    "return { ...item, points, hold }",
  ],
  "lib/tregu-sport-market.mjs": [
    "function decisiveWinnerTeam(",
    '"final_unresolved"',
    "aggregate_score",
    "shootout_score",
  ],
  "lib/tregu-automation-server.ts": [
    "runUpcomingFootballTemplateAutomation(now)",
    "football_template: footballTemplate",
    '"awaiting_official_winner"',
    "validateDailyDraftSubmission",
    "nonSportOnly: !expectedLiveEventRunKey",
    "getLatestArticles(200)",
    "open_markets_excluded",
    "body=title",
    "market_snapshots",
    "evidenceIdentity",
    "p_evidence_fingerprint",
    "market_classification === \"general_news\"",
    "newsDeadlineAction(currentMarket, now)",
    "deadlineAction === \"settle\"",
    "deadlineAction === \"decay\"",
    "deadline_action: deadlineAction",
    "reason: \"deadline_result_not_persisted\"",
    "deadlineBefore.probability <= 0.050000000001",
    "reason: \"deadline_floor_reached\"",
    "deadline_decay_rate_limited",
    "apply_news_deadline_decay_window",
    "newsDeadlineDecayCap(deadlineRemainingHours)",
    "NEWS_DEADLINE_DECAY_INTERVAL_MS",
  ],
  "supabase/migrations/0059_tregu_reprice_evidence_fingerprint.sql": [
    "evidence_fingerprint",
    "create unique index",
    "for update",
  ],
  "supabase/migrations/0060_tregu_deadline_decay_window.sql": [
    "apply_news_deadline_decay_window",
    "interval '72 hours'",
    "p_max_move",
  ],
  "supabase/migrations/0062_tregu_deadline_decay_horizon.sql": [
    "horizon-based deadline decay",
    "14 * 24",
    "7 * 24",
    "created_at",
    "p_max_move",
  ],
  "lib/tregu-live-email-content.mjs": [
    "graphSvg",
    "logoImage",
    "Persisted probability graph",
    "outcomeDisplayName",
  ],
  "app/api/admin/tregu/health/route.ts": [
    "newsRepriceResult",
    "runner_identity",
    "383-tregu-reprice.timer",
  ],
  "lib/tregu-automation.mjs": [
    "NEWS_EVIDENCE_LOOKBACK_MS",
    "news.google.com",
    "SUBJECT_ACTION_GROUPS",
    "subjectActionGroups",
    "isUsableVerifiedEvidence",
  ],
  "lib/tregu-ai-provider.mjs": [
    "gemini-3.6-flash",
    "isFallbackEligible",
  ],
  "lib/tregu.ts": [
    "të filtruar për këtë treg",
    "Kthe vetëm një objekt JSON të vlefshëm",
  ],
  "lib/tregu-daily-market-quality.mjs": [
    '"daily-market-v2"',
    "headline_restatement_already_known",
    "duplicate_topic",
    "deadline_outside_trading_window",
  ],
  "scripts/run-tregu-daily-drafts.mjs": [
    "Active non-sports markets to avoid",
    "market_archetype",
    "topic_key",
    "Do not use closes_in_days",
    "process.argv.includes(\"--dry-run\")",
    "const sendReceipt",
    "const escapeHtml",
    "accepted_count",
    "rejected_count",
    "no_publish_reason",
  ],
  "app/api/automation/tregu/daily-drafts/route.ts": [
    "selectDailySourceArticles",
    "activeMarkets",
    "body: String(article.body",
  ],
  "lib/live-news.ts": [
    "url?: string",
    "liveNewsSearchUrls",
    "parseLiveNewsRss",
    "<link>",
    "out.push({ title, source, ageMin",
  ],
  "lib/tregu.ts": [
    "selectDailySourceArticles",
    "market_archetype",
    "closes_in_hours",
    "String(a.body ?? \"\").slice(0, 2200)",
    "Mos perdor closes_in_days",
  ],
  "app/api/admin/tregu/draft/route.ts": [
    "getLatestArticles",
    "validateDailyDraftSubmission",
    "buildDailyDraftPlan",
    "dailyDraftPublicationReason",
    "status: \"draft\"",
  ],
  "supabase/migrations/0038_tregu_football_stage_template.sql": [
    "market_type in ('two_outcome', 'three_outcome', 'f1_race_winner')",
    "sport_outcomes @> jsonb_build_array",
    "home_team",
    "away_team",
  ],
  "supabase/migrations/0039_tregu_sport_outcome_sell_and_tape.sql": [
    "sell_sport_market_shares",
    "outcome_prices",
    "market_trades_side_check",
    "positions_side_check",
  ],
  "app/api/tregu/bet/route.ts": [
    'body.kind === "sport_outcome"',
    '"place_sport_market_bet"',
  ],
  "app/api/tregu/sell/route.ts": [
    'body.kind === "sport_outcome"',
    '"sell_sport_market_shares"',
  ],
  "app/api/deployment-info/route.ts": [
    "F1_RACE_UI_VERSION",
    "TREGU_CHART_UI_VERSION",
    "FOOTBALL_MARKET_UI_VERSION",
    'return isVerifiedGitHubMain ? "github-main" : "unverified"',
    "deployment_source: deploymentSource()",
    "production_release: process.env.VERCEL_GIT_COMMIT_SHA",
    "football_market_ui_version",
    '"Cache-Control": "no-store, max-age=0"',
  ],
  "package.json": [
    '"prebuild": "node scripts/verify-production-deployment.mjs"',
    '"postbuild": "node scripts/verify-production-deployment.mjs"',
  ],
  "scripts/codex_automation_support.py": [
    'contract.get("f1_race_ui_version", "")',
    'contract.get("football_market_ui_version", "")',
    "VERCEL deploy delegated to the GitHub main integration",
  ],
};

/**
 * The UI surface: component names, data attributes, class names and the UI
 * version strings. These change legitimately every time the Tregu interface
 * is reworked, so they are reported and never fatal.
 *
 * Making them fatal is not free caution. It blocked a deploy the same week
 * the chart work landed: the version was bumped to smooth-inspector-v3 and
 * GroupChart became ExactMarketChart, both deliberate. A guard that has to
 * be re-baselined after every refactor gets re-baselined without reading,
 * which is how it stops guarding anything.
 */
const TRACKED_UI_MARKERS = {
  "lib/tregu-ui-contract.ts": [
    `TREGU_CHART_UI_VERSION = "${CHART_UI_VERSION}"`,
    `F1_RACE_UI_VERSION = "${F1_RACE_UI_VERSION}"`,
    `FOOTBALL_MARKET_UI_VERSION = "${FOOTBALL_MARKET_UI_VERSION}"`,
  ],
  "components/tregu/chart-hooks.ts": [
    "export function useLiveTape(",
    "export function useLiveTapeVector(",
    "normalize ? curRef.current.map",
    "setInterval(() =>",
  ],
  "components/tregu/market-chart.tsx": [
    "useLiveTape",
    "getCategoryColor",
    "data-tregu-chart-version",
  ],
  "components/tregu/group-chart.tsx": [
    "useLiveTapeVector",
    "tapeDataKey",
    "data-tregu-chart-version",
    "data-live-outcome-chart",
    "data-refresh-cadence-ms",
  ],
  "components/tregu/trending-strip.tsx": [
    'label: "Mundësia"',
    "data-chart-line-count={chartSeries.length}",
    "normalize={!isBinary}",
  ],
  "components/tregu/f1-race-control.tsx": [
    "ExactMarketChart",
    "data-f1-race-ui-version",
    'className="f1-grid-pair"',
    "aria-expanded={showAllDrivers}",
    "{!isLive && (",
    "timingRow?.gap",
    "onBetDriver",
  ],
  "components/tregu/f1-archive-feature.tsx": [
    "data-f1-archive-feature",
    "F1ProbabilityHistory",
    "Shiko arkivin",
  ],
  "app/tregu/page.tsx": [
    'const qs = category === "all" ? "?status=all"',
    "function isF1Archive(",
    "<F1ArchiveFeature",
  ],
  "lib/f1-driver-presentation.ts": [
    "f1DriverHeadshot",
    "f1TeamColor",
    "media.formula1.com",
  ],
  "app/tregu/[slug]/page.tsx": [
    'id={f1 ? "f1-bet-slip" : undefined}',
    "data-football-market-ui-version={FOOTBALL_MARKET_UI_VERSION}",
    "data-market-intent={football.format.marketIntent}",
    "football.format.drawAllowed",
  ],
  "app/api/tregu/markets/[slug]/route.ts": [
    "team_colour: row.team_colour",
    'status: "ARCHIVED"',
    "grid_position: gridPosition",
    "timing: board",
    "refreshMs: 1_000",
  ],
  "scripts/codex_automation_support.py": [
    `F1_RACE_UI_VERSION = "${F1_RACE_UI_VERSION}"`,
    `FOOTBALL_MARKET_UI_VERSION = "${FOOTBALL_MARKET_UI_VERSION}"`,
  ],
};

function missingMarkers(table, root) {
  const failures = [];
  for (const [relativePath, markers] of Object.entries(table)) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath} is missing`);
      continue;
    }
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const marker of markers) {
      if (!source.includes(marker)) {
        failures.push(`${relativePath} is missing ${JSON.stringify(marker)}`);
      }
    }
  }
  return failures;
}

/** Invariants. A non-empty result must stop the build. */
export function verifyChartContract(root = DEFAULT_ROOT) {
  return missingMarkers(REQUIRED_CHART_MARKERS, root);
}

/**
 * UI markers that have drifted. Reported so a wholesale revert of the Tregu
 * interface is still visible in the build log, never fatal.
 */
export function trackedUiDrift(root = DEFAULT_ROOT) {
  return missingMarkers(TRACKED_UI_MARKERS, root);
}

export async function verifyProductionSource({
  env = process.env,
  fetchImpl = fetch,
  root = DEFAULT_ROOT,
} = {}) {
  const chartFailures = verifyChartContract(root);
  if (chartFailures.length > 0) {
    throw new Error(
      `Refusing deployment without the modern Tregu chart contract:\n- ${chartFailures.join("\n- ")}`
    );
  }

  if (env.VERCEL_ENV !== "production") {
    return { skipped: true, reason: "not a Vercel production build" };
  }

  const deployedSha = String(env.VERCEL_GIT_COMMIT_SHA ?? "").trim();
  const deployedRef = String(env.VERCEL_GIT_COMMIT_REF ?? "").trim();
  const deployedRepositoryOwner = String(env.VERCEL_GIT_REPO_OWNER ?? "").trim();
  const deployedRepositorySlug = String(env.VERCEL_GIT_REPO_SLUG ?? "").trim();
  const deployedRepositoryId = String(env.VERCEL_GIT_REPO_ID ?? "").trim();
  if (!deployedSha) {
    throw new Error(
      "Refusing production deployment without VERCEL_GIT_COMMIT_SHA. Production must deploy from GitHub main."
    );
  }
  if (deployedRef !== PRODUCTION_BRANCH) {
    throw new Error(
      `Refusing production deployment from ${JSON.stringify(deployedRef)}; expected ${PRODUCTION_BRANCH}.`
    );
  }
  if (
    deployedRepositoryOwner !== PRODUCTION_REPOSITORY_OWNER ||
    deployedRepositorySlug !== PRODUCTION_REPOSITORY_SLUG ||
    deployedRepositoryId !== PRODUCTION_REPOSITORY_ID
  ) {
    throw new Error(
      "Refusing production deployment without verified Vercel Git integration metadata for Lind-hack/383lajme."
    );
  }

  const githubToken = String(env.GITHUB_TOKEN ?? env.GH_TOKEN ?? "").trim();
  const response = await fetchImpl(
    `https://api.github.com/repos/${REPOSITORY}/commits/${PRODUCTION_BRANCH}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "383-production-deployment-guard",
        ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `Could not verify GitHub ${PRODUCTION_BRANCH} (HTTP ${response.status}); refusing production build.`
    );
  }
  const payload = await response.json();
  const mainSha = String(payload?.sha ?? "").trim();
  if (!/^[0-9a-f]{40}$/i.test(mainSha)) {
    throw new Error("GitHub returned an invalid main commit SHA; failing production build closed.");
  }
  if (deployedSha !== mainSha) {
    throw new Error(
      `Refusing stale production deployment ${deployedSha.slice(0, 12)}; GitHub main is ${mainSha.slice(0, 12)}.`
    );
  }

  return {
    skipped: false,
    commitSha: deployedSha,
    chartUiVersion: CHART_UI_VERSION,
    f1RaceUiVersion: F1_RACE_UI_VERSION,
    footballMarketUiVersion: FOOTBALL_MARKET_UI_VERSION,
  };
}

async function main() {
  const drift = trackedUiDrift();
  if (drift.length > 0) {
    console.warn(
      `DEPLOY GUARD notice: the Tregu UI has moved on from ${drift.length} tracked marker(s). `
        + "Expected after interface work; worth a look only if you did not change the UI."
    );
    for (const item of drift) console.warn(`  - ${item}`);
  }

  const result = await verifyProductionSource();
  if (result.skipped) {
    console.log(`DEPLOY GUARD skipped: ${result.reason}`);
    return;
  }
  console.log(
    `DEPLOY GUARD ok: ${result.commitSha.slice(0, 12)} includes Tregu ${result.chartUiVersion}, football ${result.footballMarketUiVersion}, and F1 ${result.f1RaceUiVersion}`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`DEPLOY GUARD failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
