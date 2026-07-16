import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildArgentinaEnglandDraft,
  lmsrThreeOutcomePrices,
  previewThreeOutcomeBet,
} from "./tregu-three-outcome.mjs";

test("three-outcome LMSR prices are normalized and a virtual 383C trade changes only its selected outcome", () => {
  const market = { q_england: 0, q_draw: 0, q_argentina: 0, b: 400 };
  assert.deepEqual(lmsrThreeOutcomePrices(market), { england: 1 / 3, draw: 1 / 3, argentina: 1 / 3 });

  const preview = previewThreeOutcomeBet(market, "ENGLAND", 40);
  assert.equal(preview.shares > 0, true);
  assert.equal(preview.prices.england > 1 / 3, true);
  assert.equal(preview.prices.draw < 1 / 3, true);
  assert.equal(preview.prices.argentina < 1 / 3, true);
  assert.ok(Math.abs(preview.prices.england + preview.prices.draw + preview.prices.argentina - 1) < 1e-12);
});

test("Argentina-England market row is deterministic, open, and refuses unsourced pre-match claims", () => {
  const now = new Date("2026-07-14T10:00:00.000Z");
  const input = {
    event: {
      provider: "espn",
      event_id: "760515",
      league: "fifa.world",
      date: "2026-07-15T19:00:00.000Z",
      competitors: [{ team: "England" }, { team: "Argentina" }],
      source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760515",
    },
    verifiedNews: [{ title: "Official tournament preview", url: "https://www.fifa.com/example", source: "FIFA" }],
    now,
  };

  const first = buildArgentinaEnglandDraft(input);
  const second = buildArgentinaEnglandDraft(input);
  assert.deepEqual(first, second);
  assert.equal(first.status, "open");
  assert.equal(first.market_type, "three_outcome");
  assert.deepEqual(first.outcomes, ["ENGLAND", "DRAW", "ARGENTINA"]);
  assert.equal(first.live_event.event_id, "760515");
  assert.equal(first.closes_at > "2026-07-15T19:00:00.000Z", true);
  assert.deepEqual(first.sport_outcomes.map((outcome) => outcome.key), ["england", "draw", "argentina"]);
  assert.match(first.resolution_criteria, /FULL_TIME|90 minuta/i);
  assert.equal(first.analysis.claims.length, 0);
  assert.throws(() => buildArgentinaEnglandDraft({ ...input, verifiedNews: [] }), /verified news/i);
});

test("Argentina-England market accepts equivalent ESPN ISO kickoff spellings", () => {
  const input = {
    event: {
      provider: "espn",
      event_id: "760515",
      league: "fifa.world",
      competitors: [{ team: "England" }, { team: "Argentina" }],
      source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760515",
    },
    verifiedNews: [{ title: "Official tournament preview", url: "https://www.fifa.com/example", source: "FIFA" }],
    now: new Date("2026-07-14T10:00:00.000Z"),
  };

  for (const date of ["2026-07-15T19:00:00.000Z", "2026-07-15T19:00:00Z"]) {
    const draft = buildArgentinaEnglandDraft({ ...input, event: { ...input.event, date } });
    assert.equal(draft.live_event.kickoff, "2026-07-15T19:00:00.000Z");
  }
});

test("three-outcome migration preserves binary PO/JO and confines the special market to virtual 383C", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0010_tregu_three_outcome_argentina_england.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists market_type/i);
  assert.match(migration, /q_england numeric not null default 0/i);
  assert.match(migration, /q_draw numeric not null default 0/i);
  assert.match(migration, /q_argentina numeric not null default 0/i);
  assert.match(migration, /lmsr_three_outcome_prices/i);
  assert.match(migration, /p_side not in \('PO', 'JO', 'ENGLAND', 'DRAW', 'ARGENTINA'\)/i);
  assert.match(migration, /v_market\.market_type <> 'three_outcome'/i);
  assert.match(migration, /p_side not in \('ENGLAND', 'DRAW', 'ARGENTINA'\)/i);
  assert.match(migration, /event_id.*760515/i);
  assert.match(migration, /update public\.profiles set coins = coins - p_coins/i);
  assert.match(migration, /no real-money capability/i);
});
