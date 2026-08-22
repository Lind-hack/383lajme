import assert from "node:assert/strict";
import test from "node:test";

import {
  NAV_CATEGORIES,
  DEFAULT_CATEGORY,
  SLUG_TO_CATEGORY,
  CATEGORY_TO_SLUG,
  RESOLVABLE_SLUGS,
  normalizeCategory,
  categoryQueryValues,
} from "./category-map.ts";

test("the sections are exposed in the order the navigation shows them", () => {
  assert.deepEqual(
    NAV_CATEGORIES.map((c) => c.label),
    ["Kosovë", "Shqipëri", "Sport", "Teknologji", "Ekonomi", "Botë", "Showbiz"]
  );
});

test("no retired section survives anywhere in the navigation source", () => {
  const labels = NAV_CATEGORIES.map((c) => c.label);
  const slugs = NAV_CATEGORIES.map((c) => c.slug);
  for (const retired of ["Siguri", "Shoqëri", "Kulturë"]) {
    assert.ok(!labels.includes(retired), `${retired} is still a nav label`);
  }
  for (const retired of ["siguri", "shoqeri", "kulture"]) {
    assert.ok(!slugs.includes(retired), `${retired} is still a nav slug`);
  }
});

test("slug and label maps are exact inverses of each other", () => {
  for (const { label, slug } of NAV_CATEGORIES) {
    assert.equal(SLUG_TO_CATEGORY[slug], label);
    assert.equal(CATEGORY_TO_SLUG[label], slug);
  }
  assert.equal(Object.keys(SLUG_TO_CATEGORY).length, NAV_CATEGORIES.length);
});

test("a live section normalizes to itself", () => {
  for (const { label } of NAV_CATEGORIES) {
    assert.equal(normalizeCategory(label), label);
  }
});

test("retired sections fold onto the section that absorbed them", () => {
  assert.equal(normalizeCategory("Siguri"), "Kosovë");
  assert.equal(normalizeCategory("Shoqëri"), "Kosovë");
  assert.equal(normalizeCategory("Kulturë"), "Showbiz");
  assert.equal(normalizeCategory("Diasporë"), "Botë");
  assert.equal(normalizeCategory("Biznes"), "Ekonomi");
  assert.equal(normalizeCategory("Tech"), "Teknologji");
});

test("lookup ignores case, diacritics and surrounding whitespace", () => {
  for (const spelling of ["Botë", "bote", "BOTE", "  botë  ", "BoTë"]) {
    assert.equal(normalizeCategory(spelling), "Botë", `failed on ${JSON.stringify(spelling)}`);
  }
  assert.equal(normalizeCategory("shoqëri"), "Kosovë");
  assert.equal(normalizeCategory("SHOQERI"), "Kosovë");
});

test("a slug normalizes as readily as a label, so either side of a link resolves", () => {
  for (const { label, slug } of NAV_CATEGORIES) {
    assert.equal(normalizeCategory(slug), label);
  }
});

test("an absent, empty or unrecognised category falls back rather than leaking", () => {
  for (const input of [null, undefined, "", "   ", "Kategori Që Nuk Ekziston", "42"]) {
    assert.equal(normalizeCategory(input), DEFAULT_CATEGORY);
  }
});

test("normalizing is idempotent — a normalized value never shifts again", () => {
  for (const input of ["Siguri", "Shoqëri", "Kulturë", "bote", "", "nonsense"]) {
    const once = normalizeCategory(input);
    assert.equal(normalizeCategory(once), once);
  }
});

test("retired slugs still resolve, so existing links and indexed results do not 404", () => {
  assert.equal(RESOLVABLE_SLUGS.siguri, "Kosovë");
  assert.equal(RESOLVABLE_SLUGS.shoqeri, "Kosovë");
  assert.equal(RESOLVABLE_SLUGS.kulture, "Showbiz");
  assert.equal(RESOLVABLE_SLUGS.diaspora, "Botë");
  for (const { label, slug } of NAV_CATEGORIES) {
    assert.equal(RESOLVABLE_SLUGS[slug], label);
  }
});

test("query values carry the store's own spelling, diacritics included", () => {
  const kosove = categoryQueryValues("Kosovë");
  assert.ok(kosove.includes("Kosovë"));
  // Everything the old section held has to be queried for by its stored
  // spelling, or Kosovë launches empty beside a full archive of Politikë rows.
  assert.ok(kosove.includes("Politikë"));
  // The rows are stored with the diacritic; querying the folded key would miss.
  assert.ok(kosove.includes("Shoqëri"));
  assert.ok(kosove.includes("Siguri"));
  assert.ok(!kosove.includes("shoqeri"));
  assert.equal(categoryQueryValues("Showbiz")[0], "Showbiz");
  assert.ok(categoryQueryValues("Showbiz").includes("Kulturë"));
});

test("every query value normalizes back to the section that claims it", () => {
  for (const { label } of NAV_CATEGORIES) {
    for (const value of categoryQueryValues(label)) {
      assert.equal(normalizeCategory(value), label, `${value} does not belong to ${label}`);
    }
  }
});

test("no alias is claimed by two sections at once", () => {
  const seen = new Map();
  for (const { label } of NAV_CATEGORIES) {
    for (const value of categoryQueryValues(label)) {
      assert.ok(!seen.has(value), `${value} is claimed by both ${seen.get(value)} and ${label}`);
      seen.set(value, label);
    }
  }
});

test("the two place sections carry the colours the design asks for", async () => {
  const { getCategoryColor } = await import("./category-colors.ts");
  // Kosovë keeps the blue readers already associate with that spotlight.
  assert.equal(getCategoryColor("Kosovë"), "#0047FF");
  assert.equal(getCategoryColor("Shqipëri"), "#E41E20");
  // Rows still filed under the old label must not fall back to the orange
  // default and break the spotlight they appear in.
  assert.equal(getCategoryColor("Politikë"), "#0047FF");
});

test("Albania lands in its own section rather than under Botë", () => {
  assert.equal(normalizeCategory("Shqipëri"), "Shqipëri");
  assert.equal(normalizeCategory("Albania"), "Shqipëri");
  assert.equal(normalizeCategory("tirana"), "Shqipëri");
});

test("an article with no category is domestic, not political", () => {
  assert.equal(normalizeCategory(""), "Kosovë");
  assert.equal(normalizeCategory(null), "Kosovë");
});

test("the old section address still resolves instead of 404ing", () => {
  assert.equal(RESOLVABLE_SLUGS.politike, "Kosovë");
});

