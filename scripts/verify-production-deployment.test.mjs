import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyChartContract,
  verifyProductionSource,
} from "./verify-production-deployment.mjs";

const CURRENT_SHA = "a".repeat(40);
const STALE_SHA = "b".repeat(40);

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
    },
    fetchImpl: githubMain(CURRENT_SHA),
  });
  assert.equal(result.skipped, false);
  assert.equal(result.commitSha, CURRENT_SHA);
  assert.equal(result.chartUiVersion, "live-tape-v1");
  assert.equal(result.f1RaceUiVersion, "race-grid-v3");
  assert.equal(result.footballMarketUiVersion, "stage-aware-v3");
});
