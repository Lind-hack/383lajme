import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRepricePlan, newsDeadlineAction, newsDeadlineDecayCap, newsDeadlineDecayStartHours, NEWS_DEADLINE_DECAY_INTERVAL_MS, repriceMarketSkipReason } from "./tregu-automation.mjs";

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

test("deadline actions use a 7-14 day horizon window and stronger two-minute caps", () => {
  const now = new Date("2026-07-15T20:00:00.000Z");
  const base = { status: "open", market_type: "binary", market_classification: "general_news", category: "bote" };
  assert.equal(newsDeadlineAction({ ...base, closes_at: "2026-07-15T19:59:00.000Z" }, now), "settle");
  assert.equal(newsDeadlineAction({ ...base, created_at: "2026-07-01T20:00:00.000Z", closes_at: "2026-07-21T20:00:00.000Z" }, now), "decay");
  assert.equal(newsDeadlineAction({ ...base, created_at: "2025-12-01T20:00:00.000Z", closes_at: "2026-07-28T20:00:00.000Z" }, now), "decay");
  assert.equal(newsDeadlineAction({ ...base, created_at: "2025-12-01T20:00:00.000Z", closes_at: "2026-07-31T20:00:00.000Z" }, now), null);
  assert.equal(newsDeadlineAction({ ...base, category: "sport", closes_at: "2026-07-15T19:59:00.000Z" }, now), null);
  assert.equal(newsDeadlineDecayStartHours({ ...base, created_at: "2026-07-01T20:00:00.000Z", closes_at: "2026-07-21T20:00:00.000Z" }), 168);
  assert.equal(newsDeadlineDecayStartHours({ ...base, created_at: "2025-12-01T20:00:00.000Z", closes_at: "2026-07-28T20:00:00.000Z" }), 336);
  assert.equal(newsDeadlineDecayCap(337), null);
  assert.equal(newsDeadlineDecayCap(200), 0.0025);
  assert.equal(newsDeadlineDecayCap(120), 0.004);
  assert.equal(newsDeadlineDecayCap(72), 0.006);
  assert.equal(newsDeadlineDecayCap(24), 0.01);
  assert.equal(newsDeadlineDecayCap(6), 0.015);
  assert.equal(NEWS_DEADLINE_DECAY_INTERVAL_MS, 90_000);
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(automation, /newsDeadlineDecayCap\(deadlineRemainingHours\)/);
  assert.match(automation, /NEWS_DEADLINE_DECAY_INTERVAL_MS/);
  assert.match(automation, /created_at/);
  assert.doesNotMatch(automation, /lastDecayAt[^\n]+60 \* 60 \* 1000/);
});

test("every open market scan persists a non-secret result while no-evidence scans cannot call the AI or oracle", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const plan = readFileSync(new URL("./tregu-automation.mjs", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0017_tregu_market_scan_status.sql", import.meta.url), "utf8");

  assert.doesNotMatch(plan, /\.filter\(\(item\) => item\.evidence\.length > 0\)/);
  assert.match(automation, /last_checked_at:\s*now\.toISOString\(\)/);
  assert.match(automation, /last_scan_result:\s*scan/);
  assert.match(automation, /open_markets_excluded/);
  assert.match(automation, /market_classification === "general_news"/);
  assert.match(automation, /body=title/);
  assert.doesNotMatch(automation, /const headlines = await liveHeadlinesFor/);
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

test("deadline RPCs are guarded to open binary general-news markets and report only a persisted change", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const eligibility = automation.indexOf("isEligibleNewsDeadlineMarket(currentMarket)");
  const settlement = automation.indexOf('admin.rpc("apply_news_deadline_settlement"');
  const decay = automation.indexOf('admin.rpc("apply_news_deadline_decay"');

  assert.ok(eligibility >= 0 && eligibility < settlement);
  assert.ok(eligibility < decay);
  assert.match(automation, /before_state/);
  assert.match(automation, /after_state/);
  assert.match(automation, /deadlineChange\("deadline_settlement"\)/);
  assert.match(automation, /deadlineChange\("deadline_decay"\)/);
  assert.match(automation, /newsDeadlineAction\(currentMarket, now\)/);
  assert.match(automation, /deadlineAction === "settle"/);
  assert.match(automation, /deadlineAction === "decay"/);
  assert.match(automation, /apply_news_deadline_decay_window/);
  assert.match(automation, /deadline_decay_migration_pending/);
  const migration = readFileSync(new URL("../supabase/migrations/0062_tregu_deadline_decay_horizon.sql", import.meta.url), "utf8");
  assert.match(migration, /14 \* 24/i);
  assert.match(migration, /7 \* 24/i);
  assert.match(migration, /created_at/i);
  assert.match(migration, /p_max_move/);
  assert.match(automation, /deadline_action: deadlineAction/);
  assert.match(automation, /reason: "deadline_result_not_persisted"/);
  assert.match(automation, /deadlineBefore\.probability <= 0\.050000000001/);
  assert.match(automation, /reason: "deadline_floor_reached"/);
  assert.match(automation, /if \(!stateChanged && afterProbability === deadlineBefore\.probability\) return null/);
});

test("Bitcoin threshold market accepts a current direct price article and rejects unrelated prices", () => {
  const market = {
    id: "market-bitcoin-70k",
    slug: "bitcoin-mbi-70-mije-dollare-brenda-3-muajve",
    status: "open", category: "ekonomi", market_classification: "general_news", market_type: "binary",
    question: "A do te kalojne 70 mijë dollarë çmimi i Bitcoin brenda 3 muajve?",
    source_article_slugs: [], last_news_at: null, q_yes: 0, q_no: 0, b: 100,
    closes_at: "2026-11-07T06:14:29.138Z",
  };
  const directBitcoin = {
    slug: "bitcoin-current-78000",
    title: "Bitcoin holds near $78,000 after August rally",
    excerpt: "Bitcoin price remains above the $70,000 threshold as BTC trades around $78,000.",
    source: "Cryptowisser",
    url: "https://www.cryptowisser.com/news/bitcoin-holds-near-78k-as-us-iran-tensions-rattle-oil-and-stocks/",
    publishedAt: "2026-08-31T10:00:00.000Z",
    category: "Ekonomi",
    body: "Bitcoin remained broadly stable near $78,000 during trading on August 31. The largest cryptocurrency traded around $78,050 and had gained approximately 23 percent in August. The report notes support near $77,000, resistance between $79,400 and $80,800, and says a decisive move higher could open the door to further gains. This direct publisher report provides current price facts and context for the $70,000 threshold market.",
  };
  const unrelated = { ...directBitcoin, slug: "unrelated-price", title: "Oil prices rise as a refinery shuts", excerpt: "Oil prices moved higher after a refinery incident." };
  const plan = buildRepricePlan({ markets: [market], verifiedArticles: [unrelated, directBitcoin], now: new Date("2026-08-31T12:00:00.000Z") });
  assert.deepEqual(plan[0].evidence.map((article) => article.slug), ["bitcoin-current-78000"]);
});

test("production news repricing carries a one-time evidence fingerprint into the guarded RPC", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/0059_tregu_reprice_evidence_fingerprint.sql", import.meta.url), "utf8");
  assert.match(automation, /getLatestArticles\(200\)/);
  assert.match(automation, /p_evidence_fingerprint/);
  assert.match(automation, /const latestNewsAt = evidence\.map/);
  assert.match(automation, /legacyPayload/);
  assert.match(migration, /evidence_fingerprint/);
  assert.match(migration, /create unique index/i);
  assert.match(migration, /for update/);
});

test("external live headlines remain discovery-only and cannot move odds", () => {
  const market = {
    id: "nvidia-hugging-face",
    slug: "nvidia-hugging-face",
    status: "open",
    category: "ekonomi",
    market_classification: "general_news",
    market_type: "binary",
    question: "Nvidia nënshkruan marrëveshje për blerjen e Hugging Face deri më 30 gusht?",
    source_article_slugs: [],
    last_news_at: "2026-08-27T00:00:00.000Z",
    q_yes: 0,
    q_no: 0,
    b: 400,
  };
  const plan = buildRepricePlan({
    markets: [market],
    verifiedArticles: [
      {
        slug: "google-news:techcrunch:nvidia-hugging-face",
        url: "https://news.google.com/articles/nvidia-hugging-face",
        category: "external-google-news",
        verification: "external_google_news",
        source: "TechCrunch",
        title: "Nvidia and Hugging Face acquisition talks remain unresolved",
        excerpt: "The companies have not confirmed a signed deal.",
        publishedAt: "2026-08-28T10:00:00.000Z",
      },
      {
        slug: "google-news:techcrunch:nvidia-hugging-face-no-url",
        category: "external-google-news",
        verification: "external_google_news",
        source: "Reuters",
        title: "Nvidia and Hugging Face acquisition talks remain unresolved",
        excerpt: "The companies have not confirmed a signed deal.",
        publishedAt: "2026-08-28T10:02:00.000Z",
      },
      {
        slug: "google-news:guardian:france-cheese",
        url: "https://news.google.com/articles/france-cheese",
        category: "external-google-news",
        verification: "external_google_news",
        source: "The Guardian",
        title: "France changes cheese production rules after drought",
        excerpt: "The agricultural rules were temporarily relaxed.",
        publishedAt: "2026-08-28T10:01:00.000Z",
      },
    ],
  });
  assert.deepEqual(plan[0].evidence, []);
});

test("football template checks distinguish unchanged from refreshed odds", () => {
  const automation = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(automation, /const unchanged\s*=\s*\[\]/);
  assert.match(automation, /const refreshed\s*=\s*\[\]/);
  assert.match(automation, /unchanged_markets\s*:\s*unchanged/);
  assert.match(automation, /refreshed_markets\s*:\s*refreshed/);
  assert.doesNotMatch(automation, /recalibrated_markets/);
});
