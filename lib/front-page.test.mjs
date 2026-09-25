import { test } from "node:test";
import assert from "node:assert/strict";
import { frontRank, isSameStory, pickFrontPage } from "./front-page.mjs";

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
