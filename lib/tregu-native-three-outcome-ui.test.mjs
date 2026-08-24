import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hubPage = readFileSync(new URL("../app/tregu/page.tsx", import.meta.url), "utf8");
const structuredCard = readFileSync(
  new URL("../components/tregu/structured-sport-market-card.tsx", import.meta.url),
  "utf8"
);
const exactChart = readFileSync(
  new URL("../components/tregu/exact-market-chart.tsx", import.meta.url),
  "utf8"
);
const marketsApi = readFileSync(
  new URL("../app/api/tregu/markets/route.ts", import.meta.url),
  "utf8"
);

test("native two- and three-outcome books use the structured card and exact chart", () => {
  assert.match(
    hubPage,
    /import StructuredSportMarketCard from "@\/components\/tregu\/structured-sport-market-card"/
  );
  assert.match(
    hubPage,
    /isStructuredSportMarket\(m\)\s*\?\s*\(\s*<StructuredSportMarketCard key=\{m\.id\} market=\{m\} \/>/s
  );
  assert.match(structuredCard, /import ExactMarketChart/);
  assert.match(
    structuredCard,
    /points: toExactSeries\(market\.outcome_history\?\.\[outcome\.key\]\)/
  );
  assert.match(structuredCard, /<ExactMarketChart[\s\S]*series=\{chartSeries\}/);
  assert.match(structuredCard, /outcomes\.map\(\(outcome, index\) =>/);
  assert.match(structuredCard, /\?rezultati=\$\{encodeURIComponent\(outcome\.key\)\}/);

  assert.doesNotMatch(hubPage, /dramatizeSpark/);
  assert.doesNotMatch(exactChart, /Math\.random|dramatize/i);
});

test("exact chart renders only recorded timestamps and admits an insufficient tape", () => {
  assert.match(exactChart, /item\.points\.map\(\(point\) => point\.t\)/);
  assert.match(exactChart, /selectRecordedRange\(series, showRanges \? range : "Gjithë"\)/);
  assert.match(exactChart, /cleaned\.some\(\(item\) => item\.points\.length >= 2\)/);
  assert.match(exactChart, /item\.points\.length >= 2/);
  assert.match(exactChart, /smoothRecordedPath\(item\.points, model\.x, model\.y\)/);
  assert.match(exactChart, /Ende pa lëvizje në këtë interval/);
  assert.match(exactChart, /Vija shfaqet pas ndryshimit të dytë të regjistruar/);
  assert.doesNotMatch(exactChart, /Date\.now|Math\.random|dramatize/);
});

test("the market floor polls the no-store API every 15 seconds while visible", () => {
  assert.match(
    hubPage,
    /fetch\(`\/api\/tregu\/markets\$\{qs\}`,\s*\{\s*cache: "no-store",\s*signal: controller\.signal/s
  );
  assert.match(hubPage, /document\.visibilityState === "hidden"/);
  assert.match(hubPage, /window\.setInterval\(\(\) => void load\(\), 15_000\)/);
  assert.match(hubPage, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(hubPage, /window\.addEventListener\("focus", onVisibility\)/);
  assert.match(hubPage, /controller\?\.abort\(\)/);
});

test("market API exposes exact outcome tape, traded volume and persisted freshness", () => {
  assert.match(
    marketsApi,
    /\.select\("market_id, price_yes, coins, outcome_prices, created_at"\)/
  );
  assert.doesNotMatch(marketsApi, /m\.reference_probabilities\?\.\[key\][\s\S]*m\.created_at/);
  assert.match(marketsApi, /t: new Date\(trade\.created_at\)\.getTime\(\)/);
  assert.match(marketsApi, /t: new Date\(event\.created_at\)\.getTime\(\)/);
  assert.match(marketsApi, /new Date\(m\.updated_at \?\? m\.created_at\)\.getTime\(\)/);
  assert.match(
    marketsApi,
    /trade_volume: tape\.reduce\(\(sum, row\) => sum \+ Math\.max\(0, Number\(row\.coins \?\? 0\)\), 0\)/
  );
  assert.match(marketsApi, /last_data_at: sourceTimes\.length/);
  assert.match(marketsApi, /outcome_history: outcomeHistory/);
  assert.match(marketsApi, /delta7d: hasCompactOutcomeBook \? null : delta7d/);
  assert.match(marketsApi, /"Cache-Control": "private, no-store, max-age=0"/);
});
