import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "Lind-hack/383lajme";
const PRODUCTION_BRANCH = "main";
const CHART_UI_VERSION = "live-tape-v1";
const F1_RACE_UI_VERSION = "race-grid-v3";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");

const REQUIRED_CHART_MARKERS = {
  "lib/tregu-ui-contract.ts": [
    `TREGU_CHART_UI_VERSION = "${CHART_UI_VERSION}"`,
    `F1_RACE_UI_VERSION = "${F1_RACE_UI_VERSION}"`,
  ],
  "components/tregu/chart-hooks.ts": [
    "export function useLiveTape(",
    "export function useLiveTapeVector(",
    "setInterval(() =>",
  ],
  "components/tregu/market-chart.tsx": [
    "useLiveTape",
    "getCategoryColor",
    "data-tregu-chart-version",
  ],
  "components/tregu/group-chart.tsx": [
    "useLiveTapeVector",
    "data-tregu-chart-version",
  ],
  "components/tregu/f1-race-control.tsx": [
    "GroupChart",
    "data-f1-race-ui-version",
    'className="f1-grid-pair"',
    "aria-expanded={showAllDrivers}",
    "timingRow?.gap",
    "onBetDriver",
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
  ],
  "app/api/tregu/markets/[slug]/route.ts": [
    "team_colour: row.team_colour",
    "timing: board",
  ],
  "scripts/codex_automation_support.py": [
    `F1_RACE_UI_VERSION = "${F1_RACE_UI_VERSION}"`,
    'contract.get("f1_race_ui_version", "")',
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
  if (!deployedSha) {
    throw new Error(
      "Refusing production deployment without VERCEL_GIT_COMMIT_SHA. Production must deploy from GitHub main."
    );
  }
  if (deployedRef && deployedRef !== PRODUCTION_BRANCH) {
    throw new Error(
      `Refusing production deployment from ${JSON.stringify(deployedRef)}; expected ${PRODUCTION_BRANCH}.`
    );
  }

  const response = await fetchImpl(
    `https://api.github.com/repos/${REPOSITORY}/commits/${PRODUCTION_BRANCH}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "383-production-deployment-guard",
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `Could not verify GitHub ${PRODUCTION_BRANCH} (HTTP ${response.status}); failing production build closed.`
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
  };
}

async function main() {
  const result = await verifyProductionSource();
  if (result.skipped) {
    console.log(`DEPLOY GUARD skipped: ${result.reason}`);
    return;
  }
  console.log(
    `DEPLOY GUARD ok: ${result.commitSha.slice(0, 12)} includes Tregu ${result.chartUiVersion} and F1 ${result.f1RaceUiVersion}`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`DEPLOY GUARD failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
