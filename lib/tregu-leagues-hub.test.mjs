import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { cardStatus, leaveCopy, picksDueCopy, podiumLine, sortMine, stripStatus } from "./tregu-leagues-hub.mjs";

// 3 Oct 2026, 18:00 Kosovo time (UTC+2).
const NOW = Date.parse("2026-10-03T16:00:00Z");
const iso = (hours) => new Date(NOW + hours * 3_600_000).toISOString();
const live = (extra = {}) => ({ starts_at: iso(-24), ends_at: iso(72), is_member: true, settled: false, ...extra });

test("cardStatus: open picks name the count and the first lock in Kosovo time", () => {
  const status = cardStatus(live({ open_count: 4, picked_count: 1, next_lock_at: "2026-10-03T18:45:00Z" }), NOW);
  assert.equal(status.tone, "due");
  assert.equal(status.label, "3 parashikime të hapura · e para mbyllet 20:45");
  const one = cardStatus(live({ open_count: 1, picked_count: 0, next_lock_at: "2026-10-03T21:59:00Z" }), NOW);
  assert.equal(one.label, "1 parashikim i hapur · mbyllet 23:59");
});

test("cardStatus: done, idle, upcoming, join and ended", () => {
  assert.equal(cardStatus(live({ open_count: 2, picked_count: 2 }), NOW).tone, "done");
  assert.equal(cardStatus(live({ open_count: 0, picked_count: 0 }), NOW).tone, "idle");
  assert.deepEqual(cardStatus(live({ starts_at: iso(5) }), NOW), { tone: "upcoming", label: "Nis për 5 orë" });
  assert.deepEqual(cardStatus(live({ is_member: false, active_today: 24 }), NOW), { tone: "join", label: "24 parashikuan sot" });
  assert.deepEqual(cardStatus(live({ is_member: false, members: 7 }), NOW), { tone: "join", label: "7 lojtarë brenda" });
  assert.deepEqual(cardStatus(live({ is_member: false }), NOW), { tone: "join", label: "Bëhu i pari brenda" });
  assert.equal(cardStatus(live({ ends_at: iso(-1) }), NOW).tone, "ended");
  assert.equal(cardStatus(live({ settled: true }), NOW).tone, "ended");
});

test("cardStatus: data from before the migration (no counts) reads as idle, never crashes", () => {
  assert.equal(cardStatus({ starts_at: iso(-1), ends_at: iso(1), is_member: true }, NOW).tone, "idle");
  assert.equal(cardStatus(null, NOW).tone, "join");
});

test("sortMine: picks to make first, soonest lock first, then best place", () => {
  const rows = [
    live({ id: "done", open_count: 1, picked_count: 1, my_rank: 1 }),
    live({ id: "late", open_count: 2, picked_count: 0, next_lock_at: iso(6), my_rank: 2 }),
    live({ id: "soon", open_count: 1, picked_count: 0, next_lock_at: iso(1), my_rank: 9 }),
    live({ id: "idle", open_count: 0, my_rank: 1 }),
    live({ id: "upcoming", starts_at: iso(3) }),
  ];
  assert.deepEqual(sortMine(rows, NOW).map((row) => row.id), ["soon", "late", "upcoming", "done", "idle"]);
});

test("podiumLine: leader, podium, gap, and not yet ranked", () => {
  assert.equal(podiumLine(live({ my_rank: 1, my_points: 210 })).note, "Je i pari");
  assert.equal(podiumLine(live({ my_rank: 3, my_points: 150 })).note, "Je në podium");
  assert.deepEqual(podiumLine(live({ my_rank: 6, my_points: 284, my_rank_change: 2, gap_to_podium: 32 })), {
    rank: 6, change: 2, points: 284, note: "32 pikë nga podiumi",
  });
  assert.equal(podiumLine(live({ my_rank: null, ranks_ready: false })).note, "Renditja po llogaritet");
  assert.equal(podiumLine(live({ is_member: false })), null);
});

test("leaveCopy mirrors tregu_league_leave: before start, grace, forfeit, last member", () => {
  const base = { entry_fee: 50, members: 8, pot: 400, starts_at: iso(-24), joined_at: iso(-5) };
  assert.equal(leaveCopy(base, NOW).refund, 0);
  assert.match(leaveCopy(base, NOW).text, /Tarifa prej 50 383C mbetet në pot/);
  assert.equal(leaveCopy({ ...base, starts_at: iso(2) }, NOW).refund, 50);
  assert.equal(leaveCopy({ ...base, joined_at: new Date(NOW - 10 * 60_000).toISOString() }, NOW).refund, 50);
  assert.equal(leaveCopy({ ...base, joined_at: new Date(NOW - 10 * 60_000).toISOString(), has_picks: true }, NOW).refund, 0);
  const last = leaveCopy({ ...base, members: 1, pot: 90 }, NOW);
  assert.equal(last.refund, 50);
  assert.match(last.text, /poti prej 40 383C nuk ndahet/);
  assert.equal(leaveCopy({ ...base, entry_fee: 0 }, NOW).refund, 0);
});

test("picksDueCopy names place, league, count and the Kosovo lock time", () => {
  assert.deepEqual(picksDueCopy({ league: "Shokët", rank: 2, open: 3, lock_at: "2026-10-03T18:45:00Z" }), {
    title: "Je #2 te Shokët",
    body: "3 ndeshje pa parashikim · e para mbyllet në 20:45. Bëji tani.",
  });
  assert.equal(picksDueCopy({ league: "Shokët", open: 1 }).title, "Parashikimet e sotme te Shokët");
  assert.equal(picksDueCopy(null).body, "1 ndeshje pa parashikim. Bëji tani.");
});

test("public-league emblems: the SQL whitelist equals LEAGUE_EMOJIS", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0095_tregu_leagues_open.sql", import.meta.url), "utf8");
  const sqlList = [...sql.match(/array\[([^\]]+)\]::text\[\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const ts = readFileSync(new URL("./tregu-leagues.ts", import.meta.url), "utf8");
  const tsList = [...ts.match(/LEAGUE_EMOJIS = \[([^\]]+)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sqlList, tsList);
});

test("one pot definition: no new sum of fee_paid outside tregu_league_pot", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const later = readdirSync(dir).filter((name) => name >= "0095" && name.endsWith(".sql"));
  for (const name of later) {
    const sql = readFileSync(new URL(name, dir), "utf8");
    const sums = sql.match(/sum\((m\.)?fee_paid\)/g) ?? [];
    const inPot = (sql.match(/function public\.tregu_league_pot[\s\S]*?\$\$;/)?.[0].match(/sum\((m\.)?fee_paid\)/g) ?? []).length;
    assert.equal(sums.length, inPot, `${name}: sum(fee_paid) outside tregu_league_pot`);
  }
  for (const file of ["../app/api/tregu/league-card/[id]/route.tsx", "../app/api/admin/tregu/leagues/route.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    if (/fee_paid/.test(source)) assert.match(source, /forfeited/, `${file} sums fees without forfeits`);
  }
});

test("stripStatus: short enough for a phone row", () => {
  assert.equal(stripStatus(live({ open_count: 4, picked_count: 1, next_lock_at: "2026-10-03T18:45:00Z" }), NOW).short, "3 të hapura · 20:45");
  assert.equal(stripStatus(live({ open_count: 2, picked_count: 2 }), NOW).short, "Gati për sot");
  assert.equal(stripStatus(live({ open_count: 0 }), NOW).short, "Pa ndeshje sot");
  assert.equal(stripStatus(live({ is_member: false, active_today: 9 }), NOW).short, "9 parashikuan sot");
});

test("the hub's day king is scored like the standings, from the latest hub definition", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const latest = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()
    .map((name) => readFileSync(new URL(name, dir), "utf8"))
    .filter((sql) => /function public\.tregu_leagues_hub\(\)/.test(sql)).at(-1);
  const hub = latest.match(/function public\.tregu_leagues_hub\(\)[\s\S]*?\$\$;/)[0];
  const king = hub.match(/king as \([\s\S]*?\n  \),/)[0];
  assert.match(king, /tregu_league_pick_effective/);
  assert.doesNotMatch(king, /sum\(p\.points\)/);
});
