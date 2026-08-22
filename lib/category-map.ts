/**
 * The single source of truth for what a category is on 383.
 *
 * Six categories are shown to readers, in this order. Everything the pipeline
 * has ever written lands on one of them: "Siguri" and "Shoqëri" were being
 * surfaced as if they were sections of their own, and "Shoqëri" in particular
 * was never editorial at all, it is what lib/db.ts assigns when an incoming
 * article carries no category.
 *
 * Navigation, the footer, the pill row and the category pages all derive from
 * here, so the order and the membership are changed in one place.
 */

export type NavCategory =
  | "Kosovë"
  | "Shqipëri"
  | "Sport"
  | "Teknologji"
  | "Ekonomi"
  | "Botë"
  | "Showbiz";

export const NAV_CATEGORIES: ReadonlyArray<{ label: NavCategory; slug: string }> = [
  { label: "Kosovë", slug: "kosove" },
  { label: "Shqipëri", slug: "shqiperi" },
  { label: "Sport", slug: "sport" },
  { label: "Teknologji", slug: "teknologji" },
  { label: "Ekonomi", slug: "ekonomi" },
  { label: "Botë", slug: "bote" },
  { label: "Showbiz", slug: "showbiz" },
];

/**
 * Where an article with no usable category of its own lands.
 *
 * Kosovë, because 383 is a Kosovo newsroom: an uncategorised story is far more
 * likely to be domestic than to be about anywhere else. This is also what the
 * retired "Politikë" default resolved to in practice.
 */
export const DEFAULT_CATEGORY: NavCategory = "Kosovë";

/** `/kategori/<slug>` for the six live sections. */
export const SLUG_TO_CATEGORY: Record<string, NavCategory> = Object.fromEntries(
  NAV_CATEGORIES.map(({ slug, label }) => [slug, label])
) as Record<string, NavCategory>;

export const CATEGORY_TO_SLUG: Record<NavCategory, string> = Object.fromEntries(
  NAV_CATEGORIES.map(({ slug, label }) => [label, slug])
) as Record<NavCategory, string>;

/**
 * Everything the data has carried that is not one of the six, folded onto the
 * closest one. Siguri and Shoqëri follow the grouping lib/tregu.ts already uses
 * (`politike: ["Politikë", "Siguri", "Shoqëri"]`), so this is not a new opinion.
 * Keys are compared case-insensitively and without diacritics.
 */
const CATEGORY_ALIASES: Record<NavCategory, string[]> = {
  // Spelled exactly as the store writes them, because these strings are also
  // what a category query has to match on. Folding happens on lookup.
  //
  // Kosovë replaced Politikë as a section: the reader's question is "what is
  // happening here", not "which desk filed it", and domestic politics, security
  // and society were three names for the same answer. Every one of those rows
  // is still in the store, so they are all listed here — a query for Kosovë has
  // to match them or the section would launch empty next to a full archive.
  "Kosovë": ["Politikë", "Siguri", "Shoqëri", "Kosovo", "Vendi", "Lajme"],
  // Albania used to arrive under Botë or Rajoni. Nothing files "Shqipëri" yet;
  // the pipeline's vocabulary gains it alongside this change.
  "Shqipëri": ["Albania", "Shqipëria", "Tiranë", "Tirana"],
  Showbiz: ["Kulturë", "Argëtim", "Jeta"],
  "Botë": ["Diasporë", "Diaspora", "Rajoni"],
  Ekonomi: ["Biznes", "Bizneset"],
  Teknologji: ["Tech", "Teknologjia"],
  Sport: ["Sporti"],
};

/** Lowercase, strip diacritics, so "Botë"/"bote"/"BOTE" all key the same.
 *  The combining-mark range is written as escapes, not literal marks, so it
 *  survives copy, paste and re-encoding intact. */
function foldKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const CANONICAL_BY_KEY: Record<string, NavCategory> = {
  ...Object.fromEntries(NAV_CATEGORIES.map(({ label }) => [foldKey(label), label])),
  ...Object.fromEntries(NAV_CATEGORIES.map(({ slug, label }) => [slug, label])),
  ...Object.fromEntries(
    (Object.entries(CATEGORY_ALIASES) as [NavCategory, string[]][]).flatMap(
      ([canonical, aliases]) => aliases.map((alias) => [foldKey(alias), canonical])
    )
  ),
};

/**
 * Every category that reaches a reader passes through here, so a stray value in
 * the data can never render as a section that does not exist.
 */
export function normalizeCategory(raw: string | null | undefined): NavCategory {
  if (!raw) return DEFAULT_CATEGORY;
  return CANONICAL_BY_KEY[foldKey(raw)] ?? DEFAULT_CATEGORY;
}

/**
 * Category page slugs that still resolve. The six live ones plus the retired
 * sections, which keep working so existing links and search results do not 404;
 * they simply land on the section that absorbed them.
 */
export const RESOLVABLE_SLUGS: Record<string, NavCategory> = {
  ...SLUG_TO_CATEGORY,
  // /kategori/politike is the section's old address. It has been linked from
  // search results, the sitemap and anything a reader ever bookmarked, so it
  // keeps resolving — to the section that absorbed it.
  politike: "Kosovë",
  siguri: "Kosovë",
  shoqeri: "Kosovë",
  kulture: "Showbiz",
  diaspora: "Botë",
};

/**
 * Raw values to match when querying for a canonical category. The store still
 * holds "Siguri" and "Shoqëri" rows, so filtering on the label alone would hide
 * them from the section that now owns them.
 */
export function categoryQueryValues(category: NavCategory): string[] {
  return [...new Set([category, ...(CATEGORY_ALIASES[category] ?? [])])];
}
