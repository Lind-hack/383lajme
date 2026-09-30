// The category grid.
//
// Twelve tiles, not seven chips. Seven pills in a row read as a filter control
// that happens to be sitting on the homepage; a grid of labelled tiles reads as
// somewhere to go, which is what this is. It also gives the lower half of the
// page a block of structure, which a row of pills does not.
//
// The seven news sections come from NAV_CATEGORIES — the canonical list, so
// this cannot drift the way the homepage's old hand-maintained copies did. The
// remaining tiles are the site's other real destinations, which is the point of
// the grid: a reader looking for "where is everything" finds all of it here,
// not just the news desks.

import Link from "next/link";
import {
  Globe2,
  TrendingUp,
  MapPinned,
  FolderSearch,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { NAV_CATEGORIES } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import SectionLabel from "@/components/section-label";

/** The non-category destinations that belong in the same grid. */
const FEATURES: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
}> = [
  { label: "Bota", href: "/bota-per-kosoven", icon: Globe2, color: "#0047FF" },
  { label: "Tregu", href: "/tregu", icon: TrendingUp, color: "#00A651" },
  { label: "Diaspora", href: "/visit", icon: MapPinned, color: "#FF4422" },
  { label: "Dosje", href: "/dosje", icon: FolderSearch, color: "#7C3AED" },
  { label: "Të fundit", href: "/kerko", icon: Newspaper, color: "#6B6B6B" },
];

export default function CategoryChips({
  counts = {},
}: {
  counts?: Record<string, number>;
}) {
  return (
    <section className="home-catgrid" aria-labelledby="home-chips-title">
      <SectionLabel
        label={<span id="home-chips-title">Kategoritë kryesore</span>}
        right={
          <Link href="/kerko" className="home-section-more">
            Shiko të gjitha →
          </Link>
        }
      />

      <div className="home-catgrid-row">
        {NAV_CATEGORIES.map((cat) => {
          const count = counts[cat.label] ?? 0;
          const color = getCategoryColor(cat.label);
          return (
            <Link
              key={cat.slug}
              href={`/kategori/${cat.slug}`}
              className="home-cattile"
            >
              <span
                className="home-cattile-icon"
                style={{ background: `${color}1A`, color }}
                aria-hidden="true"
              >
                {cat.label.slice(0, 1)}
              </span>
              <span className="home-cattile-label">{cat.label}</span>
              <span className="home-cattile-count">
                {count > 0 ? `${count} në përmbledhje` : "—"}
              </span>
            </Link>
          );
        })}

        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="home-cattile">
            <span
              className="home-cattile-icon"
              style={{ background: `${f.color}1A`, color: f.color }}
              aria-hidden="true"
            >
              <f.icon size={18} strokeWidth={2.2} />
            </span>
            <span className="home-cattile-label">{f.label}</span>
            <span className="home-cattile-count">Vegël</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
