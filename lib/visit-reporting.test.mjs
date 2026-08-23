import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommunityReport,
  hashReportIdentity,
  reporterModeFromHash,
  resolveReporterMode,
} from "./visit-reporting.ts";

test("account reporting requires a signed-in user", () => {
  assert.equal(resolveReporterMode(false, undefined), null);
  assert.equal(resolveReporterMode(false, "user-123"), "account");
  assert.equal(resolveReporterMode(true, "user-123"), "anonymous");
});

test("report hashes reveal the mode but never the identity", () => {
  const account = hashReportIdentity({ mode: "account", userId: "user-123", forwarded: "127.0.0.1", secret: "test" });
  const anonymous = hashReportIdentity({ mode: "anonymous", deviceId: "device-123", forwarded: "127.0.0.1", secret: "test" });
  assert.equal(reporterModeFromHash(account), "account");
  assert.equal(reporterModeFromHash(anonymous), "anonymous");
  assert.equal(account.includes("user-123"), false);
  assert.equal(anonymous.includes("device-123"), false);
});

test("community reports retain trusted readings and quarantine outliers", () => {
  assert.deepEqual(classifyCommunityReport(18, 20), { status: "accepted", confidence: "high" });
  assert.deepEqual(classifyCommunityReport(35, 20), { status: "accepted", confidence: "medium" });
  assert.deepEqual(classifyCommunityReport(90, 20), { status: "quarantined", confidence: "rejected_outlier" });
  assert.deepEqual(classifyCommunityReport(25, null), { status: "accepted", confidence: "low" });
});
