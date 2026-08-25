import test from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_NAME,
  buildBalanceHistory,
  cleanDisplayName,
  normalizeBookmarkIds,
  publicProfileName,
} from "./profile-hub.mjs";

test("anonymous profiles never leak their display name", () => {
  assert.equal(publicProfileName({ display_name: "Arta K.", is_anonymous: true }), ANONYMOUS_NAME);
  assert.equal(publicProfileName({ display_name: "Arta K.", is_anonymous: false }), "Arta K.");
  assert.equal(publicProfileName(null), "Tregtar");
});

test("display names and bookmark ids are bounded and normalized", () => {
  assert.equal(cleanDisplayName("  Arta   Krasniqi  "), "Arta Krasniqi");
  assert.deepEqual(normalizeBookmarkIds(["a", " a ", "", null, "b"]), ["a", "b"]);
});

test("balance history anchors the requested window without inventing ledger moves", () => {
  const day = 86_400_000;
  const now = 40 * day;
  const history = buildBalanceHistory([
    { created_at: new Date(5 * day).toISOString(), amount: 100 },
    { created_at: new Date(20 * day).toISOString(), amount: -30 },
    { created_at: new Date(35 * day).toISOString(), amount: 10 },
  ], 80, now, 30);
  assert.deepEqual(history, [
    { t: 10 * day, coins: 100 },
    { t: 20 * day, coins: 70 },
    { t: 35 * day, coins: 80 },
    { t: 40 * day, coins: 80 },
  ]);
});
