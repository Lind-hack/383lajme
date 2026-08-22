import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/tregu/[slug]/page.tsx", import.meta.url), "utf8");
const detailApi = readFileSync(new URL("../app/api/tregu/markets/[slug]/route.ts", import.meta.url), "utf8");
const betApi = readFileSync(new URL("../app/api/tregu/bet/route.ts", import.meta.url), "utf8");

test("native generic three-outcome markets use a three-line event chart without sibling binary markets", () => {
  assert.match(page, /isNativeSportMarket/);
  assert.match(page, /isEventMarket/);
  assert.match(page, /<GroupChart/);
  assert.match(page, /nativeSportOutcomes/);
  assert.match(detailApi, /sport_oracle_events/);
  assert.match(detailApi, /sport_outcomes/);
});

test("native generic three-outcome market detail exposes home, draw, and away trade choices through the sport RPC", () => {
  assert.match(page, /nativeSportOutcomes\.map/);
  assert.match(page, /\/api\/tregu\/bet/);
  assert.match(betApi, /place_sport_market_bet/);
  assert.match(betApi, /sport_outcomes/);
});
