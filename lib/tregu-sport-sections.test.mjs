import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOOTBALL_LEAGUES,
  FOOTBALL_TOURNAMENTS_SOON,
  footballLeagueCounts,
  f1Calendar,
  isF1Market,
  leagueOf,
  marketsForFootballLeague,
} from "./tregu-sport-sections.mjs";

const OPEN = () => true;

function football(league, overrides = {}) {
  return {
    slug: `ndeshje-${league}-${Math.random().toString(36).slice(2, 7)}`,
    market_classification: "live_football",
    live_event: { provider: "espn", league, event_id: "123" },
    closes_at: "2026-08-30T19:00:00Z",
    ...overrides,
  };
}

test("the four big leagues and three UEFA cups are declared", () => {
  assert.deepEqual(
    FOOTBALL_LEAGUES.map((l) => l.key),
    ["eng.1", "esp.1", "ita.1", "ger.1"]
  );
  assert.deepEqual(
    FOOTBALL_TOURNAMENTS_SOON.map((t) => t.key),
    ["uefa.champions", "uefa.europa", "uefa.europa.conf"]
  );
});

test("leagueOf reads only live football markets", () => {
  assert.equal(leagueOf(football("eng.1")), "eng.1");
  assert.equal(leagueOf({ market_classification: "general_news" }), null);
  assert.equal(leagueOf(football("esp.1", { live_event: {} })), null);
});

test("counts aggregate open markets per league and skip non-football", () => {
  const counts = footballLeagueCounts(
    [
      football("eng.1"),
      football("eng.1"),
      football("esp.1"),
      { market_classification: "general_news", slug: "lajm" },
      football("ita.1", { status: "closed" }),
    ],
    (m) => m.status !== "closed"
  );
  assert.deepEqual(counts, { "eng.1": 2, "esp.1": 1 });
});

test("marketsForFootballLeague filters and sorts by nearest deadline", () => {
  const list = [
    football("ger.1", { slug: "a", closes_at: "2026-09-02T19:00:00Z" }),
    football("eng.1", { slug: "b", closes_at: "2026-09-01T19:00:00Z" }),
    football("ger.1", { slug: "c", closes_at: "2026-08-28T19:00:00Z" }),
  ];
  const filtered = marketsForFootballLeague(list, "ger.1");
  assert.deepEqual(
    filtered.map((m) => m.slug),
    ["c", "a"]
  );
});

test("isF1Market accepts both classification and market_type spellings", () => {
  assert.equal(isF1Market({ market_classification: "live_f1" }), true);
  assert.equal(isF1Market({ market_type: "f1_race_winner" }), true);
  assert.equal(isF1Market({ market_classification: "live_football" }), false);
});

test("f1Calendar lists upcoming races in race order, stripped of the question frame", () => {
  const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
  const calendar = f1Calendar(
    [
      { slug: "zandvoort", market_classification: "live_f1", question: "Kush fiton GP-në e Hollandës?", closes_at: future(9), market_prob: 0.4 },
      { slug: "monza", market_classification: "live_f1", question: "Kush fiton GP-në e Italisë?", closes_at: future(3), market_prob: 0.55 },
      { slug: "e-vjetër", market_classification: "live_f1", question: "Kush fiton GP-në e vjetër?", closes_at: "2020-01-01T00:00:00Z", market_prob: 1 },
      { slug: "lajm", market_classification: "general_news", question: "Tjet?", closes_at: future(1), market_prob: 0.5 },
    ],
    { OPEN, limit: 3 }
  );
  assert.deepEqual(
    calendar.map((r) => r.slug),
    ["monza", "zandvoort"]
  );
  assert.equal(calendar[0].name, "GP-në e Italisë");
});

test("f1Calendar respects the isOpen gate and limit", () => {
  const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
  const races = [1, 2, 3, 4].map((i) => ({
    slug: `race-${i}`,
    market_classification: "live_f1",
    question: `Kush fiton garën ${i}?`,
    closes_at: future(i),
    market_prob: 0.5,
  }));
  const calendar = f1Calendar(races, { isOpen: (m) => m.slug !== "race-1", limit: 2 });
  assert.deepEqual(
    calendar.map((r) => r.slug),
    ["race-2", "race-3"]
  );
});
