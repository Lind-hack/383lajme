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
const mobileBar = read("components/tregu/mobile-account-bar.tsx");
const mobileTrade = read("components/tregu/mobile-trade-sheet.tsx");
const tradeSound = read("components/tregu/trade-success-sound.ts");
const matchStats = read("components/tregu/match-stats.tsx");
const marketShare = read("components/tregu/market-share-actions.tsx");
const shareCard = read("app/api/tregu/share-card/route.tsx");
const sportSections = read("components/tregu/sport-sections.tsx");
const upcomingFootball = read("lib/espn-upcoming-football.mjs");
const videoHero = read("components/tregu/video-hero.tsx");
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
  assert.match(exact, /angularRecordedPath\(points, model\.x, model\.y\)/);
  assert.match(exact, /smoothRecordedPath\(points, model\.x, model\.y\)/);
  assert.match(exact, /recordedRangeDisplaySeries\(selected\.series, selected\.start, selected\.end\)/);
  assert.match(exact, /\(t - firstT\) \/ Math\.max\(1, lastT - firstT\)/);
  assert.match(exact, /onPointerMove/);
  assert.match(exact, /onPointerDown/);
  assert.match(exact, /tregu-exact-chart-inspector/);
  assert.match(exact, /range === "1s" \|\| range === "1m" \|\| range === "5m"/);
  assert.match(exact, /tregu-exact-chart-line--live/);
});

test("sports detail keeps league and team identity beside the chart", () => {
  assert.match(detail, /<SportBrandMark brandKey=\{sportBrandKey\}/);
  assert.match(detail, /<FootballOutcomeMark outcome=\{outcome\} size=\{26\}/);
  assert.match(detail, /footballOutcomeSelected|footballSelectedOutcome/);
  assert.match(detail, /<FootballOutcomeMark outcome=\{footballSelectedOutcome\} size=\{52\}/);
});

test("mobile Tregu keeps the proposition first and reward feedback collision-free", () => {
  assert.match(styles, /@media \(max-width: 860px\)[\s\S]*?\.tregu-feature-chart \{ order: initial; \}/);
  assert.match(featured, /sourceOutcome\?\.logo[\s\S]*?<img[\s\S]*?src=\{sourceOutcome\.logo\}/);
  assert.match(mobileBar, /className="tregu-mbar-actions"[\s\S]*?<\/div>[\s\S]*?bonusMsg &&/);
  assert.match(styles, /\.tregu-mbar-msg \{[\s\S]*?grid-column: 1 \/ -1;/);
});

test("mobile market details trade from a compact thumb-reach dock and bottom sheet", () => {
  assert.match(detail, /<MobileTradeSheet/);
  assert.match(mobileTrade, /className="tregu-mobile-dock"/);
  assert.match(mobileTrade, /className="tregu-mobile-sheet" role="dialog"/);
  assert.match(mobileTrade, /383C/);
  assert.match(mobileTrade, /value=\{amountInput\}/);
  assert.match(mobileTrade, />\s*Max\s*<\/button>/);
  assert.match(mobileTrade, /disabled=\{!marketOpen \|\| !sellEnabled\}/);
  assert.match(styles, /\.tregu-detail-headline-row \{[\s\S]*?order: 1;/);
  assert.match(styles, /\.tregu-detail-side > \.tregu-edge \{[\s\S]*?display: none;/);
});

test("mobile sell is position-gated and explains the exit cost before confirmation", () => {
  assert.match(mobileTrade, /Shitja aktivizohet pasi të kesh blerë një pozicion/);
  assert.match(mobileTrade, /Kosto e daljes/);
  assert.match(mobileTrade, /çmimin aktual dhe ndikimin e tregut/);
  assert.match(detail, /const mobileSellEnabled = !isClosed/);
  assert.match(detail, /kind: "f1_race_winner"[\s\S]*?outcomeKey: f1OutcomeKey[\s\S]*?shares/);
});

test("successful mobile buys use team or newsroom category color in an animated receipt", () => {
  assert.match(detail, /tradeThemeColor\(market, footballChoice\?\.color, f1Choice\?\.team_colour\)/);
  assert.match(detail, /getCategoryColor\(normalizeCategory\(market\.category\)\)/);
  assert.match(mobileTrade, /U tregtuan/);
  assert.match(mobileTrade, /Fitimi i mundshëm/);
  assert.match(styles, /@keyframes tregu-trade-color-reveal/);
  assert.match(styles, /@keyframes tregu-trade-pop/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?tregu-trade-celebration-wash/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.tregu-trade-celebration \{[\s\S]*?inset: 0;[\s\S]*?width: auto;[\s\S]*?max-height: none;[\s\S]*?border-radius: 0;/);
});

test("mobile dock gives sell and buy equal space with buy in the right-hand slot", () => {
  assert.ok(mobileTrade.indexOf('className="tregu-mobile-dock-sell"') < mobileTrade.indexOf('className="tregu-mobile-dock-buy"'));
  assert.match(styles, /\.tregu-mobile-dock \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("the mobile first viewport keeps title, odds, ranges, chart and sharing compact", () => {
  assert.match(detail, /className="tregu-detail-headline-row"/);
  assert.match(detail, /<MarketShareActions/);
  assert.match(styles, /\.tregu-detail-chart-shell \.tregu-exact-chart-plot \{[\s\S]*?height: 220px !important/);
  assert.match(styles, /\.tregu-detail-chart-shell \.tregu-exact-chart-head,[\s\S]*?\.tregu-detail-chart-shell \.tregu-chart-pulse \{ display: none; \}/);
  assert.match(styles, /\.tregu-exact-chart-ranges \{[\s\S]*?overflow-x: auto/);
  assert.match(marketShare, /WhatsApp/);
  assert.match(marketShare, /Telegram/);
  assert.match(marketShare, /Facebook/);
  assert.match(marketShare, /Kopjo linkun/);
  assert.match(marketShare, /Ruaj PNG/);
  assert.match(marketShare, /Shpërndaje/);
  assert.match(shareCard, /export const contentType = "image\/png"/);
});

test("successful mobile buys prime and play bounded sport-context Web Audio feedback", () => {
  assert.match(mobileTrade, /primeTradeSuccessSound\(soundProfile\)/);
  assert.match(mobileTrade, /playTradeSuccessSound\(receipt\.soundProfile\)/);
  assert.match(tradeSound, /loadTradeSuccessSound/);
  assert.match(tradeSound, /gain\.gain\.linearRampToValueAtTime\(0, end\)/);
  assert.match(tradeSound, /Math\.min\(recorded\.duration, TRADE_SUCCESS_SOUND_MAX_DURATION_MS \/ 1_000\)/);
  assert.match(tradeSound, /context\.createOscillator\(\)/);
  assert.match(tradeSound, /playFootballCue/);
  assert.match(tradeSound, /playF1Cue/);
  assert.match(tradeSound, /playBasketballCue/);
  assert.match(tradeSound, /playChoralCue/);
  assert.match(tradeSound, /document\.hidden/);
});

test("match statistics default to a compact key view with live update motion", () => {
  assert.match(matchStats, /useState<"key" \| "all">\("key"\)/);
  assert.match(matchStats, /rows\.slice\(0, 4\)/);
  assert.match(matchStats, /Kryesore/);
  assert.match(matchStats, /Të gjitha/);
  assert.match(matchStats, /Përditësohet drejtpërdrejt/);
  assert.match(styles, /\.tregu-mstats-rows \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.tregu-mstats-rows \{ grid-template-columns: 1fr;/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.tregu-mstats-refresh\[data-live\]::before \{ animation: none;/);
});

test("football detail removes noisy feed metadata and separates layered cards", () => {
  assert.match(detail, /<ExactMarketChart[\s\S]*?showPulse[\s\S]*?concise[\s\S]*?tone="sport"/);
  assert.doesNotMatch(detail, /Shfaqje 1s|burimi zyrtar 2 min/);
  assert.doesNotMatch(detail, /tregu-football-eyebrow/);
  assert.match(exact, /!minimal && !concise/);
  assert.match(styles, /\.tregu-detail-header\[data-tone="sport"\] \{[\s\S]*?overflow: visible;[\s\S]*?margin-bottom: 20px;/);
});

test("purchase feedback uses team material finishes and separate mobile and desktop motion", () => {
  assert.match(detail, /real madrid[\s\S]*?return "gloss"/);
  assert.match(detail, /chelsea[\s\S]*?return "standard"/);
  assert.match(detail, /sportTheme === "basketball"\) return "parquet"/);
  assert.doesNotMatch(detail, /if \(!mobileTradeOpen\) return/);
  assert.match(mobileTrade, /data-finish=\{receipt\.finish\}/);
  assert.match(styles, /@keyframes tregu-trade-mark-lift/);
  assert.match(styles, /@keyframes tregu-trade-ribbon-rise/);
  assert.match(styles, /@keyframes tregu-trade-spark-lift/);
  assert.match(styles, /@keyframes tregu-trade-desktop-in/);
});

test("sports trade UI is provider-neutral and omits AI/news rationale panels", () => {
  assert.doesNotMatch(detail, /Sinjali AI|AI nga lajmet/);
  assert.match(detail, /!isSportDetail && latestEvidence\.length > 0/);
  assert.match(detail, /market\.description && !isSportDetail/);
  assert.match(detail, /Rezultati zyrtar i ndeshjes/);
  assert.doesNotMatch(detail, /ESPN/);
  assert.doesNotMatch(sportSections, /ESPN/);
  assert.match(upcomingFootball, /gjasa(t)? rifreskohen gjatë ndeshjes/);
  assert.match(upcomingFootball, /resolution_source: "Rezultati zyrtar i ndeshjes"/);
});

test("the hero CTA smoothly reaches the floor and respects reduced motion", () => {
  assert.match(videoHero, /floor\.scrollIntoView\(\{/);
  assert.match(videoHero, /prefers-reduced-motion: reduce/);
  assert.match(videoHero, /behavior: [\s\S]*?\? "auto" : "smooth"/);
  assert.match(videoHero, /onClick=\{scrollToMarkets\}/);
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
