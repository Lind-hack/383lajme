import Link from "next/link";
import CategoryMark from "@/components/category-mark";
import CitySheet from "./city-sheet";

export type PickerCity = { id: string; name: string; emblem: string; count: number };

/**
 * Kosovë and Shqipëri read by city: the busiest cities with recent news, each
 * with its municipal emblem and how many of the section's recent stories are
 * from it. A city with nothing to show is not offered.
 *
 * On wider screens it is one horizontal row under the section banner, aligned
 * with the category row above it; on a phone it is a single "Qyteti" button
 * that opens the list as a sheet (components/kategori/city-sheet).
 *
 * Plain links, so a city view can be shared and Back works; `scroll={false}`
 * keeps the reader where they tapped instead of jumping to the top.
 */
export default function CityPicker({
  section,
  slug,
  cities,
  selected,
}: {
  section: string;
  slug: string;
  cities: PickerCity[];
  selected?: string;
}) {
  if (cities.length === 0) return null;
  const current = cities.find((c) => c.id === selected);
  return (
    <div className="kc">
      <nav className="kc-strip" aria-label={`Lajmet e ${section} sipas qytetit`}>
        <ul className="kc-list">
          <li>
            <Link href={`/kategori/${slug}`} scroll={false} className="kc-chip" aria-current={!selected ? "page" : undefined}>
              <span className="kc-mark" aria-hidden="true">
                <CategoryMark category={section} size={16} />
              </span>
              Të gjitha
            </Link>
          </li>
          {cities.map((city) => (
            <li key={city.id}>
              <Link
                href={`/kategori/${slug}?qyteti=${city.id}`}
                scroll={false}
                className="kc-chip"
                aria-current={selected === city.id ? "page" : undefined}
              >
                <img className="kc-emblem" src={city.emblem} alt="" width={26} height={26} decoding="async" />
                {city.name}
                <span className="kc-count">
                  {city.count}
                  <span className="sr-only"> lajme</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <CitySheet section={section} slug={slug} cities={cities} current={current ?? null} />
    </div>
  );
}
