import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "Lind-hack/383lajme";
const PRODUCTION_BRANCH = "main";
const PRODUCTION_REPOSITORY_OWNER = "Lind-hack";
const PRODUCTION_REPOSITORY_SLUG = "383lajme";
const PRODUCTION_REPOSITORY_ID = "1245103522";
const CHART_UI_VERSION = "live-tape-v1";
const F1_RACE_UI_VERSION = "race-grid-v3";
const FOOTBALL_MARKET_UI_VERSION = "stage-aware-v3";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");

const REQUIRED_CHART_MARKERS = {
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
    "GroupChart",
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
    'kind: "f1_race_winner"',
    "outcomeKey: f1OutcomeKey",
    'id={f1 ? "f1-bet-slip" : undefined}',
    "data-football-market-ui-version={FOOTBALL_MARKET_UI_VERSION}",
    "data-market-intent={football.format.marketIntent}",
    "football.format.drawAllowed",
    "cadenceMs={120_000}",
    'kind: "sport_outcome"',
    "outcomeKey: selectedOutcome.key",
    "previewSportOutcomeSell",
    "canSellFootball",
  ],
  "app/api/tregu/markets/[slug]/route.ts": [
    "team_colour: row.team_colour",
    'status: "ARCHIVED"',
    "grid_position: gridPosition",
    "timing: board",
    'market.market_type === "two_outcome" || market.market_type === "three_outcome"',
    "sport_oracle_events",
    "outcome_prices",
    "refreshMs: 120_000",
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
    "production_release: productionRelease.release",
    "football_market_ui_version",
    '"Cache-Control": "no-store, max-age=0"',
  ],
  "package.json": [
    '"prebuild": "node scripts/verify-production-deployment.mjs"',
    '"postbuild": "node scripts/verify-production-deployment.mjs"',
  ],
  "scripts/codex_automation_support.py": [
    `F1_RACE_UI_VERSION = "${F1_RACE_UI_VERSION}"`,
    `FOOTBALL_MARKET_UI_VERSION = "${FOOTBALL_MARKET_UI_VERSION}"`,
    'contract.get("f1_race_ui_version", "")',
    'contract.get("football_market_ui_version", "")',
    "VERCEL deploy delegated to the GitHub main integration",
  ],
};

export function verifyChartContract(root = DEFAULT_ROOT) {
  const failures = [];
  for (const [relativePath, markers] of Object.entries(REQUIRED_CHART_MARKERS)) {
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
