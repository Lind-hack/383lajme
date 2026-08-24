import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyChartContract,
  verifyProductionSource,
} from "./verify-production-deployment.mjs";

/**
 * The UI versions are asserted against lib/tregu-ui-contract.ts rather than
 * restated here. Restating them means a legitimate version bump fails this
 * test for no reason, which is exactly how it broke the first time.
 */
const contractSource = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "tregu-ui-contract.ts"),
  "utf8"
);
const contractVersion = (name) => {
  const line = contractSource.split(/\r?\n/).find((row) => row.includes(`${name} =`));
  assert.ok(line, `lib/tregu-ui-contract.ts does not define ${name}`);
  const match = line.match(/"([^"]+)"/);
  assert.ok(match, `${name} carries no string literal in lib/tregu-ui-contract.ts`);
  return match[1];
};

const CURRENT_SHA = "a".repeat(40);
const STALE_SHA = "b".repeat(40);
const githubProductionMetadata = {
  VERCEL_GIT_REPO_OWNER: "Lind-hack",
  VERCEL_GIT_REPO_SLUG: "383lajme",
  VERCEL_GIT_REPO_ID: "1245103522",
};

const githubMain = (sha = CURRENT_SHA) => async () => ({
  ok: true,
  status: 200,
  async json() {
    return { sha };
  },
});

test("the checked-in modern Tregu chart contract is complete", () => {
  assert.deepEqual(verifyChartContract(), []);
});

test("local and preview builds validate the chart contract but skip the main SHA check", async () => {
  const result = await verifyProductionSource({
    env: { VERCEL_ENV: "preview" },
    fetchImpl: async () => {
      throw new Error("preview builds must not call GitHub");
    },
  });
  assert.equal(result.skipped, true);
});

test("production rejects a stale commit", async () => {
  await assert.rejects(
    verifyProductionSource({
      env: {
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_COMMIT_SHA: STALE_SHA,
        ...githubProductionMetadata,
      },
      fetchImpl: githubMain(CURRENT_SHA),
    }),
    /Refusing stale production deployment/
  );
});

test("production accepts the exact current main commit", async () => {
  const result = await verifyProductionSource({
    env: {
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_SHA: CURRENT_SHA,
      ...githubProductionMetadata,
    },
    fetchImpl: githubMain(CURRENT_SHA),
  });
  assert.equal(result.skipped, false);
  assert.equal(result.commitSha, CURRENT_SHA);
  assert.equal(result.chartUiVersion, contractVersion("TREGU_CHART_UI_VERSION"));
  assert.equal(result.f1RaceUiVersion, contractVersion("F1_RACE_UI_VERSION"));
  assert.equal(result.footballMarketUiVersion, contractVersion("FOOTBALL_MARKET_UI_VERSION"));
});

test("production fails closed when GitHub main cannot be verified", async () => {
  await assert.rejects(
    verifyProductionSource({
      env: {
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_COMMIT_SHA: CURRENT_SHA,
        ...githubProductionMetadata,
      },
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
    /Could not verify GitHub main \(HTTP 403\); refusing production build\./
  );
});

test("production rejects a local upload without Vercel Git repository metadata", async () => {
  await assert.rejects(
    verifyProductionSource({
      env: {
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_COMMIT_SHA: CURRENT_SHA,
      },
      fetchImpl: githubMain(CURRENT_SHA),
    }),
    /without verified Vercel Git integration metadata/
  );
});
