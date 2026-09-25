import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_CATEGORY_BLOCK,
  buildHomeSections,
  claim,
  createLedger,
  groupDosjeEntries,
} from "./home-sections.mjs";

const NOW = Date.parse("2026-09-25T13:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();
let n = 0;
const art = (category, title, { score = 7, age = 1 } = {}) => ({
  id: `a${++n}`,
  title,
  category,
  engagementScore: score,
  publishedAt: hoursAgo(age),
});

test("a story claimed once is never claimed again, by id or by a second write-up", () => {
  const lead = art("Kosovë", "Kosovë: Hargreaves shpreson për president para 6 tetorit");
  const followUp = art("Kosovë", "Kosovë: Hargreaves uron Kurtin, kërkon zgjedhjen e presidentit");
  const other = art("Kosovë", "Kosovë: MPB vendos gurthemelin e obeliskut për Bunjakun");
  const ledger = createLedger([lead]);
  const picked = claim(ledger, [lead, followUp, other], 5);
  assert.deepEqual(picked.map((a) => a.id), [other.id]);
});

test("the front block's articles are excluded from every section", () => {
  const pool = Array.from({ length: 30 }, (_, i) => art(i % 2 ? "Kosovë" : "Botë", `Titull i veçantë numër ${i} për testim`, { age: i }));
  const top = pool.slice(0, 5);
  const ledger = createLedger(top);
  const sections = buildHomeSections(pool, ledger, [
    { key: "latest", count: 8 },
    { key: "kosove", count: 5, category: "Kosovë" },
    { key: "bote", count: 5, category: "Botë" },
  ], { now: NOW });
  const shown = Object.values(sections).flat().map((a) => a.id);
  for (const a of top) assert.ok(!shown.includes(a.id), `${a.id} reappeared`);
  assert.equal(new Set(shown).size, shown.length, "an article appeared twice");
});

test("latest takes the newest; categories take their best-ranked", () => {
  const old = art("Sport", "Sport: ndeshja e djeshme mbyllet barazim", { score: 9, age: 20 });
  const fresh = art("Sport", "Sport: trajneri i ri prezantohet sot", { score: 6, age: 0.5 });
  const mid = art("Sport", "Sport: federata publikon kalendarin e ri", { score: 8, age: 3 });
  const extra = art("Sport", "Sport: stadiumi rinovohet para sezonit", { score: 7.5, age: 2 });
  const latest = buildHomeSections([old, fresh, mid, extra], createLedger(), [{ key: "latest", count: 2 }], { now: NOW });
  assert.deepEqual(latest.latest.map((a) => a.id), [fresh.id, extra.id]);
  const sport = buildHomeSections([old, fresh, mid, extra], createLedger(), [{ key: "sport", count: 4, category: "Sport" }], { now: NOW });
  assert.equal(sport.sport[0].id, mid.id);
});

test("a category with too few stories is skipped and gives them back", () => {
  const titles = ["Showbiz: këngëtarja publikon albumin e ri", "Showbiz: festivali i filmit hap dyert", "Showbiz: aktori fiton çmimin ndërkombëtar"];
  const few = titles.slice(0, MIN_CATEGORY_BLOCK - 1).map((title) => art("Showbiz", title));
  const ledger = createLedger();
  const sections = buildHomeSections(few, ledger, [
    { key: "showbiz", count: 5, category: "Showbiz" },
    { key: "latest", count: 5 },
  ], { now: NOW });
  assert.deepEqual(sections.showbiz, []);
  assert.equal(sections.latest.length, few.length);
});

test("dosje entries collapse to one row per dossier, preferring an unshown headline", () => {
  const entry = (slug, dossier) => ({
    articleSlug: slug,
    articleTitle: slug,
    dossierSlug: dossier,
    dossierTitle: dossier,
    articleHref: `/article/${slug}`,
    dossierHref: `/dosje/${dossier}`,
  });
  const rows = groupDosjeEntries(
    [entry("kurti-1", "bllokada"), entry("kurti-2", "bllokada"), entry("kurti-3", "bllokada"), entry("dialog-1", "dialogu")],
    new Set(["kurti-1"])
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].articleSlug, "kurti-2");
  assert.equal(rows[0].moreCount, 2);
  assert.equal(rows[1].moreCount, 0);
});
