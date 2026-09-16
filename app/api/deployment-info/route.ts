import { NextResponse } from "next/server";
import {
  F1_RACE_UI_VERSION,
  FOOTBALL_MARKET_UI_VERSION,
  TREGU_CHART_UI_VERSION,
} from "@/lib/tregu-ui-contract";

export const dynamic = "force-dynamic";

const deploymentSource = () => {
  const isVerifiedGitHubMain =
    process.env.RAILWAY_ENVIRONMENT_NAME === "production" &&
    process.env.RAILWAY_GIT_BRANCH === "main" &&
    Boolean(process.env.RAILWAY_GIT_COMMIT_SHA) &&
    process.env.RAILWAY_GIT_REPO_OWNER === "Lind-hack" &&
    process.env.RAILWAY_GIT_REPO_NAME === "383lajme";

  return isVerifiedGitHubMain ? "github-main" : "unverified";
};

export function GET() {
  return NextResponse.json(
    {
      commit_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      commit_ref: process.env.RAILWAY_GIT_BRANCH ?? null,
      environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? null,
      deployment_source: deploymentSource(),
      production_release: process.env.RAILWAY_GIT_COMMIT_SHA
        ? `github-main-${process.env.RAILWAY_GIT_COMMIT_SHA}`
        : null,
      tregu_chart_ui_version: TREGU_CHART_UI_VERSION,
      f1_race_ui_version: F1_RACE_UI_VERSION,
      football_market_ui_version: FOOTBALL_MARKET_UI_VERSION,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
