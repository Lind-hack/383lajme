import { test } from "node:test";
import assert from "node:assert/strict";
import { frontRank, isSameStory, pickFrontPage, pickMostRead } from "./front-page.mjs";

const NOW = Date.parse("2026-09-25T13:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();
const art = (id, title, score, ageH) => ({
  id,
  title,
  engagementScore: score,
  publishedAt: hoursAgo(ageH),
});

// Titles as they stood on the live homepage, 2026-09-25.
test("the lead and its follow-up are one story", () => {
  assert.equal(
    isSameStory(
      "Kosovë: Hargreaves shpreson për president para 6 tetorit",
      "Kosovë: Hargreaves uron Kurtin, kërkon zgjedhjen e presidentit"
    ),
    true
  );
});

test("different stories from the same place stay apart", () => {
  assert.equal(
    isSameStory(
      "Tiranë: 49-vjeçari plagoset; policia arreston 50-vjeçarin",
      "Tiranë: Kreshnik Cara vdes pas plagosjes me thikë"
    ),
    false
  );
  assert.equal(
    isSameStory(
      "Kosovë: MPB vendos gurthemelin e obeliskut për Bunjakun",
      "Kosovë: Hargreaves shpreson për president para 6 tetorit"
    ),
    false
  );
});

test("a fresh story outranks a day-old one with a higher score", () => {
  const old = art("old", "Polonia ngre avionët pas hyrjes së Mi-8 rus", 9.0, 26);
  const fresh = art("fresh", "Prishtinë: Haxhiu u ofron familjeve takim", 7.2, 1);
  assert.ok(frontRank(fresh, NOW) > frontRank(old, NOW));
});

test("a strong story still leads over a weak fresh one within its morning", () => {
  const strong = art("strong", "Trump pret Xi Jinping para samitit", 9.0, 6);
  const weak = art("weak", "Moti: diell në Prishtinë", 6.2, 1);
  assert.ok(frontRank(strong, NOW) > frontRank(weak, NOW));
});

test("undated articles rank as old, not new", () => {
  const undated = { id: "u", title: "Pa datë", engagementScore: 9 };
  assert.ok(frontRank(undated, NOW) < frontRank(art("d", "Me datë", 8, 2), NOW));
});

test("pickFrontPage drops the repeat and the duplicate id, and keeps order", () => {
  const pool = [
    art("a", "Kosovë: Hargreaves shpreson për president para 6 tetorit", 9.0, 20),
    art("b", "Kosovë: Hargreaves uron Kurtin, kërkon zgjedhjen e presidentit", 8.9, 21),
    art("c", "Prishtinë: Haxhiu u ofron familjeve të UÇK-së takim", 7.8, 1),
    art("d", "Botë: Papa Leo në Francë kërkon AI që u shërben njerëzve", 7.6, 3),
  ];
  const picked = pickFrontPage([...pool, pool[2]], 7, NOW).map((a) => a.id);
  assert.deepEqual(picked, ["c", "d", "a"]);
});

test("pickFrontPage stops at count and tolerates a missing pool", () => {
  const words = ["Ministria", "Gjykata", "Kuvendi", "Policia", "Spitali", "Shkolla", "Aeroporti", "Stadiumi", "Banka", "Teatri"];
  const pool = words.map((w, i) => art(String(i), `${w} hap zyrë`, 8, i));
  assert.equal(pickFrontPage(pool, 7, NOW).length, 7);
  assert.deepEqual(pickFrontPage(undefined, 7, NOW), []);
});

test("pickMostRead keeps to the last day and ranks by decayed score", () => {
  const pool = [
    art("old", "Zgjedhjet e vjetra në Prishtinë", 9.8, 60),
    art("a", "Qeveria miraton buxhetin e ri", 8.1, 3),
    art("b", "Kombëtarja fiton ndeshjen në Vjenë", 8.9, 10),
    art("c", "Çmimet e naftës rriten sërish", 7.2, 20),
  ];
  assert.deepEqual(pickMostRead(pool, 3, { now: NOW }).map((a) => a.id), ["a", "b", "c"]);
});

test("pickMostRead widens the window only when the day is short", () => {
  const pool = [
    art("fresh", "Qeveria miraton buxhetin e ri", 7.0, 2),
    art("day2", "Kombëtarja fiton ndeshjen në Vjenë", 9.0, 30),
    art("day4", "Protesta para kuvendit komunal", 9.9, 100),
  ];
  // The 24h story stays first even though the 30h one scores higher; the
  // 100h one never qualifies.
  assert.deepEqual(pickMostRead(pool, 3, { now: NOW }).map((a) => a.id), ["fresh", "day2"]);
});

test("pickMostRead drops excluded ids, repeats and undated rows", () => {
  const pool = [
    art("top", "Kurti takon Vuçiqin në Bruksel", 9.5, 1),
    art("dup", "Takimi Kurti Vuçiq në Bruksel përfundon", 9.4, 2),
    art("lead", "Tjetër lajm krejt i ndryshëm sot", 9.9, 1),
    { id: "undated", title: "Pa datë", engagementScore: 10 },
    art("ok", "Çmimet e naftës rriten sërish", 7.0, 5),
  ];
  const out = pickMostRead(pool, 5, { exclude: new Set(["lead"]), now: NOW }).map((a) => a.id);
  assert.deepEqual(out, ["top", "ok"]);
});

test("pickMostRead falls back to the newest when nothing is within three days", () => {
  const pool = [art("older", "Protesta para kuvendit komunal", 9.9, 200), art("newer", "Qeveria miraton buxhetin e ri", 6.0, 90)];
  assert.deepEqual(pickMostRead(pool, 5, { now: NOW }).map((a) => a.id), ["newer", "older"]);
});
