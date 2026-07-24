import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRepricePlan, repriceMarketSkipReason } from "./tregu-automation.mjs";

test("a market closed after the open scan is recorded as skipped before AI scoring or an oracle write", () => {
  const now = new Date("2026-07-15T20:00:00.000Z");

  assert.equal(repriceMarketSkipReason({ status: "closed", closes_at: "2026-07-15T21:00:00.000Z" }, now), "skipped_closed");
  assert.equal(repriceMarketSkipReason({ status: "resolved", closes_at: "2026-07-15T21:00:00.000Z" }, now), "skipped_closed");
  assert.equal(repriceMarketSkipReason({ status: "open", closes_at: "2026-07-15T19:59:59.000Z" }, now), "skipped_closed");
  assert.equal(repriceMarketSkipReason({ status: "open", closes_at: "2026-07-15T21:00:00.000Z" }, now), null);

  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const preflight = automation.indexOf("repriceMarketSkipReason(currentMarket, now)");
  assert.ok(preflight >= 0);
  assert.ok(preflight < automation.indexOf("scoreMarketWithAI(item.market as Market, item.evidence)", preflight));
  assert.ok(preflight < automation.indexOf('admin.rpc("apply_news_oracle"', preflight));
  assert.match(automation, /status:\s*"skipped_closed"/);
});

test("every open market scan persists a non-secret result while no-evidence scans cannot call the AI or oracle", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const plan = readFileSync(new URL("./tregu-automation.mjs", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0017_tregu_market_scan_status.sql", import.meta.url), "utf8");

  assert.doesNotMatch(plan, /\.filter\(\(item\) => item\.evidence\.length > 0\)/);
  assert.match(automation, /last_checked_at:\s*now\.toISOString\(\)/);
  assert.match(automation, /last_scan_result:\s*scan/);
  const noEvidence = automation.indexOf('status: "no_fresh_evidence"');
  assert.ok(noEvidence >= 0);
  assert.ok(noEvidence < automation.indexOf("scoreMarketWithAI(item.market as Market, item.evidence)", noEvidence));
  assert.match(automation, /open_markets_scanned/);
  assert.match(automation, /markets_checked/);
  assert.match(automation, /markets_with_evidence/);
  assert.match(automation, /updates_applied/);
  assert.match(automation, /skipped_closed/);
  assert.match(migration, /add column if not exists last_checked_at/i);
  assert.match(migration, /add column if not exists last_scan_result/i);
});


test("decisive corroborated evidence reaches the real market graph while ordinary evidence stays bounded", () => {
  const market = {
    id: "rogers", status: "open", category: "sport", question: "Morgan Rogers transferohet te Arsenal deri më 31 korrik?", resolution_criteria: "PO vetëm nëse Morgan Rogers transferohet te Arsenal deri më 31 korrik.", source_article_slugs: ["club-confirmation", "reuters-confirmation"],
    q_yes: 400 * Math.log(0.3 / 0.7), q_no: 0, b: 400, last_news_at: null,
  };
  const [item] = buildRepricePlan({
    markets: [market],
    verifiedArticles: [
      { slug: "club-confirmation", category: "Sport", publishedAt: "2026-07-24T09:00:00.000Z", source: "Chelsea FC", title: "Chelsea confirm permanent Morgan Rogers transfer", excerpt: "The player has joined Chelsea on a permanent transfer." },
      { slug: "reuters-confirmation", category: "Sport", publishedAt: "2026-07-24T09:01:00.000Z", source: "Reuters", title: "Chelsea complete Morgan Rogers signing", excerpt: "Reuters confirms the permanent transfer." },
    ],
  });
  const result = item.scoreSuccess({
    probability: 0.01,
    evidence_level: "decisive",
    reasoning: "Dy burime të pavarura konfirmojnë transferimin e përhershëm, i cili e kundërshton kriterin e tregut.",
    cited_slugs: ["club-confirmation", "reuters-confirmation"],
  });

  assert.equal(result.snapshot.market_prob_before, 0.3);
  assert.equal(result.snapshot.market_prob, 0.01);
  assert.equal(result.snapshot.oracle_cap, 0.3);
  assert.equal(result.snapshot.evidence_kind, "decisive");

  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(automation, /title:\s*headline\.title/);
  assert.match(automation, /excerpt:\s*headline\.title/);
  assert.match(automation, /p_evidence_kind:\s*outcome\.snapshot\.evidence_kind/);
});

test("the evidence-and-trade-impact migration caps a single virtual bet before any ledger write", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0025_tregu_news_evidence_and_trade_impact.sql", import.meta.url), "utf8");
  assert.match(migration, /p_evidence_kind/i);
  assert.match(migration, /decisive/i);
  assert.match(migration, /least\(0\.30/i);
  assert.match(migration, /v_trade_impact\s*>\s*0\.03/i);
  assert.match(migration, /para se të preken bilanci/i);
});

test("directly outcome-final corroborated news produces a settlement instruction rather than a capped reprice", () => {
  const market = {
    id: "rogers-final", status: "open", category: "sport", question: "Morgan Rogers transferohet te Arsenal gjatë afatit veror 2026?",
    resolution_criteria: "PO vetëm nëse Morgan Rogers transferohet te Arsenal gjatë afatit veror 2026. JO nëse ai nënshkruan për një klub tjetër gjatë këtij afati.",
    source_article_slugs: ["chelsea-official", "reuters-chelsea"],
    q_yes: 400 * Math.log(0.4 / 0.6), q_no: 0, b: 400, last_news_at: null,
  };
  const [item] = buildRepricePlan({
    markets: [market],
    verifiedArticles: [
      { slug: "chelsea-official", category: "Sport", publishedAt: "2026-07-24T09:00:00.000Z", source: "Chelsea FC", title: "Chelsea confirm Morgan Rogers signing", excerpt: "Morgan Rogers has joined Chelsea on a permanent transfer." },
      { slug: "reuters-chelsea", category: "Sport", publishedAt: "2026-07-24T09:01:00.000Z", source: "Reuters", title: "Chelsea complete Morgan Rogers transfer", excerpt: "Reuters confirms he has signed for Chelsea." },
    ],
  });
  const result = item.scoreSuccess({
    probability: 0,
    evidence_level: "decisive",
    resolution_action: "settle_jo",
    reasoning: "Dy burime të pavarura konfirmojnë transferimin e përhershëm te Chelsea, që përmbush kriterin JO.",
    cited_slugs: ["chelsea-official", "reuters-chelsea"],
  });

  assert.deepEqual(result.settlement, {
    outcome: "JO",
    evidence_kind: "decisive",
    evidence_slugs: ["chelsea-official", "reuters-chelsea"],
  });
  assert.equal(result.snapshot, null);
});

test("verified-news settlement is persisted through a dedicated evidence-audited RPC before any email", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0026_tregu_verified_news_settlement.sql", import.meta.url), "utf8");
  assert.match(automation, /outcome\.settlement/);
  assert.match(automation, /apply_verified_news_settlement/);
  assert.ok(
    automation.indexOf('if ("settlement" in outcome && outcome.settlement)') < automation.indexOf('if (!outcome.snapshot)'),
    "a settlement must reach its dedicated RPC before the ordinary-reprice snapshot guard"
  );
  assert.match(migration, /p_evidence_sources text\[\]/);
  assert.match(migration, /v_source_count < 2/);
  assert.match(migration, /status = 'resolved'/);
  assert.match(migration, /evidence_kind/);
});


test("news markers retain article imagery and animate their evidence card on hover or tap", () => {
  const chart = readFileSync(new URL("../components/tregu/market-chart.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(chart, /imageUrl\?: string/);
  assert.match(chart, /newsPopupOpen/);
  assert.match(chart, /tregu-newspop-media/);
  assert.match(chart, /onPointerEnter/);
  assert.match(automation, /imageUrl: article\.imageUrl/);
  assert.match(css, /\.tregu-newspop\[data-open="true"\]/);
  assert.match(css, /\.tregu-newspop-media img/);
  assert.match(css, /prefers-reduced-motion/);
});


test("every General/News market rejects category-only and unrelated evidence before provider scoring", () => {
  const market = { id: "chelsea-transfer", status: "open", category: "sport", question: "Chelsea konfirmon transferim prej 70 milionë eurosh deri më 31 korrik?", resolution_criteria: "PO vetëm nëse Chelsea e konfirmon zyrtarisht transferimin prej 70 milionë eurosh deri më 31 korrik.", source_article_slugs: [], q_yes: 0, q_no: 0, b: 400, last_news_at: null };
  const [item] = buildRepricePlan({ markets: [market], verifiedArticles: [
    { slug: "lebron-nba", category: "Sport", publishedAt: "2026-07-24T12:00:00.000Z", source: "ESPN", title: "LeBron James signs with a new NBA team", excerpt: "The NBA veteran completed a new deal." },
    { slug: "chelsea-injury", category: "Sport", publishedAt: "2026-07-24T12:01:00.000Z", source: "BBC Sport", title: "Chelsea issue injury update", excerpt: "Chelsea provide a squad fitness update." },
    { slug: "chelsea-transfer", category: "Sport", publishedAt: "2026-07-24T12:02:00.000Z", source: "Reuters", title: "Chelsea confirm €70 million transfer", excerpt: "Chelsea officially confirmed the €70 million signing." },
  ] });
  assert.deepEqual(item.evidence.map((article) => article.slug), ["chelsea-transfer"]);
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(automation, /getArticles\(80\)/, "repricing must not consume the 383 website news pool");
});


test("a deadline market with no imminent verified evidence decays materially on its final day", () => {
  const market = { id: "iran-deadline", status: "open", question: "Trump urdhëron goditje amerikane ndaj urave ose centraleve iraniane deri më 25 korrik?", closes_at: "2026-07-25T21:59:59.000Z", q_yes: 400 * Math.log(0.40 / 0.60), q_no: 0, b: 400 };
  const plan = buildRepricePlan({ markets: [market], verifiedArticles: [], now: new Date("2026-07-25T12:00:00.000Z") });
  assert.equal(plan[0].deadline?.reference_probability <= 0.05, true);
  assert.equal(plan[0].deadline?.outcome, null);
});


test("a deadline expiry is a deterministic JO settlement candidate only after the stored close time", () => {
  const market = { id: "iran-expired", status: "open", question: "Trump urdhëron goditje amerikane deri më 25 korrik?", closes_at: "2026-07-25T21:59:59.000Z", q_yes: 0, q_no: 0, b: 400 };
  const [item] = buildRepricePlan({ markets: [market], verifiedArticles: [], now: new Date("2026-07-25T22:00:00.000Z") });
  assert.equal(item.deadline?.outcome, "JO");
  assert.equal(item.deadline?.requires_deadline_oracle, true);
});
