import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin draft cards expose a market-type selector that persists a validated draft type", () => {
  const client = source("app/admin/tregu/TreguAdminClient.tsx");
  const route = source("app/api/admin/tregu/markets/[id]/route.ts");

  assert.match(client, /market_type\??:\s*"binary"\s*\|\s*"two_outcome"\s*\|\s*"three_outcome"/);
  assert.match(client, /aria-label="Lloji i tregut"/);
  assert.match(client, /value=\{m\.market_type \?\? "binary"\}/);
  assert.match(client, /marketAction\(m\.id, \{ market_type: value \}\)/);
  assert.match(client, /<option value="binary">Binar \(PO\/JO\)<\/option>/);
  assert.match(client, /<option value="two_outcome">Dy rezultate<\/option>/);
  assert.match(client, /<option value="three_outcome">Tri rezultate<\/option>/);

  assert.match(route, /const marketType = body\.market_type/);
  // The allowlist gained `f1_race_winner` when the single-race F1 winner oracle
  // was wired up (0e5f07e). It is still a closed enumeration, which is the
  // property this guard exists to protect.
  assert.match(
    route,
    /\["binary", "two_outcome", "three_outcome", "f1_race_winner"\]\.includes\(marketType\)/
  );
  assert.match(route, /binary: \["PO", "JO"\]/);
  assert.match(route, /two_outcome: \["ARGENTINA", "SPAIN"\]/);
  assert.match(route, /three_outcome: \["ENGLAND", "DRAW", "ARGENTINA"\]/);
  // f1_race_winner carries its own 20+ driver `sport_outcomes` and must NOT be
  // overwritten with the binary/two/three outcome schema.
  assert.match(
    route,
    /marketType === "f1_race_winner" \? fields : marketType \? \{ \.\.\.fields, outcomes: outcomeSchema\[marketType as keyof typeof outcomeSchema\] \} : fields/
  );
  assert.match(route, /eq\("status", "draft"\)/);
});

test("the draft market-type allowlist stays closed", () => {
  const route = source("app/api/admin/tregu/markets/[id]/route.ts");
  const allowlist = route.match(/\[((?:"[a-z0-9_]+",?\s*)+)\]\.includes\(marketType\)/);
  assert.ok(allowlist, "market_type allowlist must remain an inline literal array");
  const values = allowlist[1].match(/"([a-z0-9_]+)"/g).map((v) => v.replaceAll('"', ""));
  assert.deepEqual(
    values,
    ["binary", "two_outcome", "three_outcome", "f1_race_winner"],
    "adding a market type here changes what an admin can persist; update deliberately"
  );
});
