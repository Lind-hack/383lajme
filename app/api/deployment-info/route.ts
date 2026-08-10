import { NextResponse } from "next/server";
import {
  F1_RACE_UI_VERSION,
  FOOTBALL_MARKET_UI_VERSION,
  TREGU_CHART_UI_VERSION,
} from "@/lib/tregu-ui-contract";
import productionRelease from "../../../public/production-release.json";

export const dynamic = "force-dynamic";

const deploymentSource = () => {
  const isVerifiedGitHubMain =
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_GIT_COMMIT_REF === "main" &&
    Boolean(process.env.VERCEL_GIT_COMMIT_SHA) &&
    process.env.VERCEL_GIT_REPO_OWNER === "Lind-hack" &&
    process.env.VERCEL_GIT_REPO_SLUG === "383lajme" &&
    process.env.VERCEL_GIT_REPO_ID === "1245103522";

  return isVerifiedGitHubMain ? "github-main" : "unverified";
};

export function GET() {
  return NextResponse.json(
    {
      commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commit_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      deployment_source: deploymentSource(),
      production_release: productionRelease.release,
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
