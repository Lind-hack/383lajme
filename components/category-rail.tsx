import Link from "next/link";
import { ChartNoAxesColumnIncreasing, Clapperboard, Cpu, Earth, Trophy, type LucideIcon } from "lucide-react";
import { NAV_CATEGORIES, normalizeCategory, type NavCategory } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";

/**
 * The seven sections as a row of icon cards, under the homepage's latest-news
 * strip and at the top of category and article pages. It replaced the
 * navbar's "Kategoritë" dropdown: a category one click away and recognisable
 * by its mark, instead of hidden behind a menu.
 *
 * Kosovë and Shqipëri use the shapes from their public-domain flags (the map
 * and the eagle, in /public/images/categories), tinted through a CSS mask so
 * they take the section colour like the line icons do.
 */
const ICONS: Record<NavCategory, LucideIcon | string> = {
  Kosovë: "/images/categories/kosove.svg",
  Shqipëri: "/images/categories/shqiperi.svg",
  Sport: Trophy,
  Teknologji: Cpu,
  Ekonomi: ChartNoAxesColumnIncreasing,
  Botë: Earth,
  Showbiz: Clapperboard,
};

export default function CategoryRail({ active }: { active?: string }) {
  const current = active ? normalizeCategory(active) : undefined;
  return (
    <nav className="cat-rail" aria-label="Kategoritë">
      <ul className="cat-rail-list">
        {NAV_CATEGORIES.map(({ label, slug }) => {
          const Icon = ICONS[label];
          const isCurrent = current === label;
          return (
            <li key={slug}>
              <Link
                href={`/kategori/${slug}`}
                className="cat-rail-item"
                aria-current={isCurrent ? "page" : undefined}
                style={{ ["--cat" as string]: getCategoryColor(label) }}
              >
                <span className="cat-rail-icon" aria-hidden="true">
                  {typeof Icon === "string" ? (
                    <span className="cat-rail-shape" style={{ ["--shape" as string]: `url("${Icon}")` }} />
                  ) : (
                    <Icon size={22} strokeWidth={2.2} />
                  )}
                </span>
                <span className="cat-rail-label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
