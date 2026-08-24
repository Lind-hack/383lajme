import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const mini = read("components/tregu/market-mini-card.tsx");
const featured = read("components/tregu/featured-carousel.tsx");
const eventCard = read("components/tregu/market-event-card.tsx");
const detail = read("app/tregu/[slug]/page.tsx");
const exact = read("components/tregu/exact-market-chart.tsx");
const domain = read("lib/tregu-probability-domain.mjs");
const hubPage = read("app/tregu/page.tsx");
const hubApi = read("app/api/tregu/markets/route.ts");
const detailApi = read("app/api/tregu/markets/[slug]/route.ts");
const styles = read("app/globals.css");

test("editorial hub cards use contextual media and recorded charts instead of depth bars", () => {
  assert.match(mini, /<MarketContextMedia media=\{market\.marketMedia\} variant="card"/);
  assert.match(mini, /points: exactPoints/);
  assert.match(mini, /<ExactMarketChart[\s\S]*series=\{chartSeries\}/);
  assert.match(mini, /minimal/);
  assert.doesNotMatch(mini, /tregu-side-mult/);
  assert.doesNotMatch(mini, /tregu-depth|<Sparkline|market\.spark\.map/);
  assert.match(featured, /<MarketContextMedia media=\{market\.marketMedia\} variant="featured"/);
  assert.match(featured, /<ExactMarketChart/);
  assert.doesNotMatch(featured, /tregu-depth|<Sparkline/);
});

test("grouped event charts normalize recorded books without simulated chart components", () => {
  assert.match(eventCard, /normalizeRecordedOutcomeSeries/);
  assert.match(eventCard, /<ExactMarketChart/);
  assert.doesNotMatch(eventCard, /GroupChart|Math\.random|dramatize/);
});

test("every public detail chart uses exact tape, restored ranges and contextual tone", () => {
  assert.match(detail, /<ExactMarketChart/g);
  assert.match(detail, /showRanges/);
  assert.match(detail, /showPulse/);
  assert.match(detail, /tone=\{detailTone\}|tone="sport"/);
  assert.match(detail, /<MarketContextMedia media=\{market\.market_media\} variant="detail"/);
  assert.doesNotMatch(detail, /from "@\/components\/tregu\/market-chart"|from "@\/components\/tregu\/group-chart"/);
  assert.doesNotMatch(detail, /dramatizeSeries|dramatizeSpark|<MarketChart|<GroupChart|<OutcomeMiniChart/);
});

test("range controls expose the complete legacy key set and disclose the zoom scale", () => {
  for (const key of ["1s", "1m", "5m", "15m", "1h", "4h", "1d", "1w", "Gjithë"]) {
    assert.match(domain, new RegExp(`key: "${key}"`));
  }
  assert.match(exact, /Pamje e zmadhuar/);
  assert.match(exact, /Shkallë \{scaleLabel\}/);
  assert.match(exact, /data-tregu-chart-version=\{TREGU_CHART_UI_VERSION\}/);
  assert.match(exact, /smoothRecordedPath\(item\.points, model\.x, model\.y\)/);
  assert.match(exact, /onPointerMove/);
  assert.match(exact, /onPointerDown/);
  assert.match(exact, /tregu-exact-chart-inspector/);
});

test("sports detail keeps league and team identity beside the chart", () => {
  assert.match(detail, /<SportBrandMark brandKey=\{sportBrandKey\}/);
  assert.match(detail, /<FootballOutcomeMark outcome=\{outcome\} size=\{26\}/);
  assert.match(detail, /footballOutcomeSelected|footballSelectedOutcome/);
  assert.match(detail, /<FootballOutcomeMark outcome=\{footballSelectedOutcome\} size=\{52\}/);
});

test("sports details use distinct restrained themes and plain-language movement", () => {
  assert.match(detail, /data-sport-theme=\{sportTheme\}/);
  for (const theme of ["football", "f1", "basketball"]) {
    assert.match(styles, new RegExp(`data-sport-theme=[\\\"']${theme}[\\\"']`));
  }
  assert.match(exact, /Ndryshimi më i madh/);
  assert.match(exact, /Përditësime/);
  assert.match(exact, /percent\(biggestMove\.start\).*→.*percent\(biggestMove\.current\)/s);
  assert.doesNotMatch(exact, /Pika reale|Pika burimore|\bpp\b/);
});

test("media is fetched in one batch, propagated, and evidence keeps enriched images", () => {
  assert.match(hubApi, /from\("news_articles"\)[\s\S]*\.in\("slug", sourceSlugs\)/);
  assert.match(hubApi, /market_media: resolveMarketMedia\(m, articleMedia\)/);
  assert.match(hubPage, /marketMedia: m\.market_media/);
  assert.match(detailApi, /market_media: resolveMarketMedia\(market, articleCandidates\)/);
  assert.match(detailApi, /snapshots: snapshotsWithEvidence/);
  assert.match(detail, /e\.imageUrl \? \(/);
});
