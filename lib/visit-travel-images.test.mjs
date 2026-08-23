import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(path.join(root, "lib", "visit-v2-data.ts"), "utf8");
const images = [...source.matchAll(/image: "([^"]+)"/g)].map((match) => match[1]);

test("every travel stop owns a unique local image", () => {
  assert.equal(images.length, 35);
  assert.equal(new Set(images).size, 35);
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
  ];
  for (const [place, filename] of replacements) {
    assert.match(source, new RegExp(`name: "${place}"[^\\n]+image: "/visit/places/${filename}"`));
  }
});
