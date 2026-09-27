import CategoryRail from "@/components/category-rail";
import type { NavCategory } from "@/lib/category-map";

/** One line under the section name: what a reader finds here. */
const DESCRIPTIONS: Record<NavCategory, string> = {
  Kosovë: "Politika, siguria dhe jeta e përditshme në Kosovë",
  Shqipëri: "Politika, shoqëria dhe ngjarjet në Shqipëri",
  Sport: "Kombëtarja, Superliga dhe shqiptarët nëpër Evropë",
  Teknologji: "Inteligjenca artificiale, startup-et dhe bota digjitale",
  Ekonomi: "Çmimet, tregu dhe paratë e qytetarëve",
  Botë: "Ngjarjet që lëvizin botën dhe prekin rajonin",
  Showbiz: "Muzika, filmi dhe yjet shqiptarë",
};

/**
 * The top of a category page: the category row and the section's title as one
 * block on the section colour.
 *
 * It used to be the row, then a separate 320–380px banner that said the name
 * three times (the selected card, a watermark, the title) and showed portraits
 * of public figures. On a phone that pushed the first story below the fold.
 * The row now sits on the colour with the current card lit up like a selected
 * tab, and the title is one line with a real count of today's stories — the
 * old badge printed the query limit, so every section said "50 artikuj".
 */
export default function CategoryBanner({
  categoryName,
  from,
  to,
  lightBg = false,
  todayCount,
}: {
  categoryName: NavCategory;
  from: string;
  to: string;
  /** Botë's amber is too light for white text, so it takes dark ink. */
  lightBg?: boolean;
  todayCount: number;
}) {
  return (
    <section
      className="cat-hero"
      data-light={lightBg ? "true" : undefined}
      style={{ ["--hero-from" as string]: from, ["--hero-to" as string]: to }}
    >
      <CategoryRail active={categoryName} variant="hero" />
      <div className="cat-hero-title">
        <h1>
          {categoryName.toUpperCase()}
          {todayCount > 0 && (
            <span className="cat-hero-count">
              <i aria-hidden="true" />
              {todayCount} sot
            </span>
          )}
        </h1>
        <p>{DESCRIPTIONS[categoryName]}</p>
      </div>
    </section>
  );
}
