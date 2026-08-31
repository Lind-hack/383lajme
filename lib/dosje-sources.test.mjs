import test from "node:test";
import assert from "node:assert/strict";
import { relevanceGroupsForQuery, sourceMatchesProfile } from "./dosje-sources.mjs";
test("sourceMatchesProfile rejects a reputable but unrelated page", () => {
  assert.equal(sourceMatchesProfile({ title: "Brazil joins BRICS", text: "The summit discussed trade and membership." }, [["kosovo", "president"], ["kosovo", "parliament"]]), false);
});
test("sourceMatchesProfile accepts the same event context", () => {
  assert.equal(sourceMatchesProfile({ title: "Kosovo parliament fails to elect president", text: "Lawmakers missed the constitutional deadline after months of political deadlock and a new election was triggered." }, [["kosovo", "president"], ["kosovo", "parliament"], ["kosovo", "deadlock"]]), true);
});
test("relevanceGroupsForQuery profiles Kosovo institutional crisis terms", () => {
  const groups = relevanceGroupsForQuery("Kosovo presidential election parliamentary deadlock 2025 2026");
  assert.ok(groups.some((group) => group.includes("kosovo") && group.includes("president")));
  assert.ok(groups.some((group) => group.includes("kosovo") && group.includes("parliament")));
});
