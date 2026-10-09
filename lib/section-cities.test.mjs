import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { cityOfArticle, hasCities, sectionCities, sectionCityById } from "./section-cities.mjs";

test("only Kosovë and Shqipëri are read by city", () => {
  assert.equal(hasCities("Kosovë"), true);
  assert.equal(hasCities("Shqipëri"), true);
  assert.equal(hasCities("Sport"), false);
  assert.deepEqual(sectionCities("Botë"), []);
});

test("every city has an emblem on disk", () => {
  for (const section of ["Kosovë", "Shqipëri"]) {
    for (const city of sectionCities(section)) {
      assert.ok(existsSync(new URL(`../public${city.emblem}`, import.meta.url)), city.emblem);
    }
  }
});

test("the pipeline's city field wins over the headline", () => {
  const article = { city: "Prizren", title: "Prishtina pret delegacionin", excerpt: "" };
  assert.equal(cityOfArticle(article, "Kosovë"), "prizren");
});

test("a declined name in the headline still finds its city", () => {
  assert.equal(cityOfArticle({ title: "Spitali i Prizrenit nis renovimin e tri reparteve" }, "Kosovë"), "prizren");
  assert.equal(cityOfArticle({ title: "Aksident në rrugën Pejë-Prishtinë" }, "Kosovë"), "peje");
  assert.equal(cityOfArticle({ title: "Protestë në Shkodër për ujin" }, "Shqipëri"), "shkoder");
  assert.equal(cityOfArticle({ title: "Bashkia e Tiranës mbyll rrugën" }, "Shqipëri"), "tirane");
});

test("the headline is read before the summary", () => {
  const article = { title: "Gjilan: çmimet e bukës rriten", excerpt: "Furra në Ferizaj ndjekin të njëjtin trend." };
  assert.equal(cityOfArticle(article, "Kosovë"), "gjilan");
});

test("a story names no city, or a city from the other section, gives null", () => {
  assert.equal(cityOfArticle({ title: "Kosovë: Hoti thotë se uniformat mungojnë" }, "Kosovë"), null);
  assert.equal(cityOfArticle({ title: "Tirana pret samitin" }, "Kosovë"), null);
  assert.equal(cityOfArticle(null, "Kosovë"), null);
});

test("lookups by id stay inside their section", () => {
  assert.equal(sectionCityById("Kosovë", "prizren")?.name, "Prizren");
  assert.equal(sectionCityById("Kosovë", "tirane"), null);
  assert.equal(sectionCityById("Shqipëri", "tirane")?.emblem, "/images/cities/tirane.webp");
});
