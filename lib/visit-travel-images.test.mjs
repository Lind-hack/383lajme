import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(path.join(root, "lib", "visit-v2-data.ts"), "utf8");
const images = [...source.matchAll(/image: "([^"]+)"/g)].map((match) => match[1]);

test("every travel stop owns a unique local image", () => {
  // Seven places per city, one pack of cards each (lib/xhep/packs.mjs).
  assert.equal(images.length, 49);
  assert.equal(new Set(images).size, 49);
  for (const image of images) {
    assert.equal(image.startsWith("/visit/places/"), true);
    assert.equal(existsSync(path.join(root, "public", image)), true, `${image} must exist`);
  }
});

test("known city-level substitutes cannot return", () => {
  const replacements = [
    ["Patrikana e Pejës", "peje-patriarchate.webp"],
    ["Burimi i Drinit të Bardhë", "peje-white-drin.webp"],
    ["Muzeu i Pejës", "peje-museum.webp"],
    ["Muzeu Etnografik", "gjakove-museum.webp"],
    ["Kulla e Sahatit", "gjakove-clock-tower.webp"],
    ["Ujëvarat e Mirushës", "gjakove-mirusha.webp"],
    ["Liqeni i Ujmanit", "mitrovice-ujman.webp"],
    ["Xhamia e Madhe", "gjilan-great-mosque.webp"],
    ["Liqeni i Livoçit", "gjilan-livoc.webp"],
    ["Bifurkacioni i Nerodimes", "ferizaj-nerodime.webp"],
    // These four showed a different place (the bridge, the riverside, a street).
    ["Kalaja e Prizrenit", "prizren-fortress-walls.webp"],
    ["Shadërvani", "prizren-shadervan-fountain.webp"],
    ["Xhamia e Sinan Pashës", "prizren-sinan-pasha.webp"],
    ["Xhamia e Hadumit", "gjakove-hadum-mosque.webp"],
  ];
  for (const [place, filename] of replacements) {
    assert.match(source, new RegExp(`name: "${place}"[^\\n]+image: "/visit/places/${filename}"`));
  }
});

test("every new stop credits its photo: source, author and a free licence", () => {
  const rows = source.split(/\r?\n/).filter((line) => line.includes('image: "/visit/places/') && line.includes("imageSourceUrl"));
  for (const row of rows) {
    assert.match(row, /imageSourceUrl: "https:\/\/commons\.wikimedia\.org\/wiki\/File:/, row.slice(0, 60));
    assert.match(row, /imageCredit: "[^"]+"/, row.slice(0, 60));
    assert.match(row, /imageLicense: "(CC BY(-SA)? [0-9.]+|CC0|Public domain)/, row.slice(0, 60));
  }
});
