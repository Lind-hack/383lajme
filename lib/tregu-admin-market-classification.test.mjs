import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin drafts can be classified as General / News, Live Football, or Live F1", () => {
  const client = source("app/admin/tregu/TreguAdminClient.tsx");
  const route = source("app/api/admin/tregu/markets/[id]/route.ts");
  const migration = source("supabase/migrations/0023_tregu_market_classification.sql");

  assert.match(client, /market_classification\??:\s*MarketClassification/);
  assert.match(client, /aria-label="Klasifikimi i tregut"/);
  assert.match(client, /<option value="general_news">General \/ News<\/option>/);
  assert.match(client, /<option value="live_football">Live Football<\/option>/);
  assert.match(client, /<option value="live_f1">Live F1<\/option>/);
  assert.match(client, /marketAction\(m\.id, \{ market_classification: value \}\)/);

  assert.match(route, /market_classification\?: MarketClassification/);
  assert.match(route, /MARKET_CLASSIFICATIONS\.includes\(marketClassification\)/);
  assert.match(route, /\.eq\("status", "draft"\)/);

  assert.match(migration, /add column if not exists market_classification text not null default 'general_news'/);
  assert.match(migration, /market_classification in \('general_news', 'live_football', 'live_f1'\)/);
  assert.match(migration, /market_classification = 'live_f1'/);
  assert.match(migration, /market_classification = 'live_football'/);
});
