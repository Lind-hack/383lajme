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
  assert.match(route, /\["binary", "two_outcome", "three_outcome"\]\.includes\(marketType\)/);
  assert.match(route, /binary: \["PO", "JO"\]/);
  assert.match(route, /two_outcome: \["ARGENTINA", "SPAIN"\]/);
  assert.match(route, /three_outcome: \["ENGLAND", "DRAW", "ARGENTINA"\]/);
  assert.match(route, /outcomes: outcomeSchema\[marketType\]/);
  assert.match(route, /eq\("status", "draft"\)/);
});
