import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const registry = readFileSync(new URL("./tregu-sport-branding.ts", import.meta.url), "utf8");
const mark = readFileSync(
  new URL("../components/tregu/sport-brand-mark.tsx", import.meta.url),
  "utf8"
);

const activeBrands = [
  ["eng.1", "Premier League", "premierleague.svg"],
  ["esp.1", "La Liga", "laliga.svg"],
  ["ita.1", "Serie A", "seriea.svg"],
  ["ger.1", "Bundesliga", "bundesliga.svg"],
  ["f1", "Formula 1", "f1.svg"],
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("active football leagues and Formula 1 have local, attributable logo assets", () => {
  for (const [key, label, file] of activeBrands) {
    const block = new RegExp(
      `${escapeRegex(key)}[\\s\\S]*?label: "${escapeRegex(label)}"[\\s\\S]*?logo: "\\/logos\\/${escapeRegex(file)}"[\\s\\S]*?sourceUrl: "https:\\/\\/`,
      "m"
    );
    assert.match(registry, block, `${label} must keep its local logo and official source`);

    const assetUrl = new URL(`../public/logos/${file}`, import.meta.url);
    assert.equal(existsSync(assetUrl), true, `${file} must exist`);
    assert.match(readFileSync(assetUrl, "utf8"), /<svg\b/i, `${file} must be SVG`);
  }
});

test("NBA and Kosovo basketball are reserved in the registry with text fallbacks", () => {
  assert.match(registry, /nba:\s*\{[\s\S]*?label: "NBA"[\s\S]*?accent: "#17408B"/);
  assert.match(
    registry,
    /fbk:\s*\{[\s\S]*?label: "Superliga e Kosovës"[\s\S]*?shortLabel: "FBK"/
  );
  assert.match(registry, /normalized\.includes\("nba"\).*SPORT_BRANDS\.nba/);
  assert.match(registry, /normalized\.includes\("fbk"\).*SPORT_BRANDS\.fbk/);
  assert.match(mark, /brand\.logo \?/);
  assert.match(mark, /<b aria-hidden>\{brand\.shortLabel\}<\/b>/);
});
