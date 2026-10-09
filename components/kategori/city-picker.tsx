import Link from "next/link";
import CategoryMark from "@/components/category-mark";

export type PickerCity = { id: string; name: string; emblem: string; count: number };

/**
 * Kosovë and Shqipëri read by city: one chip per city that has stories, with
 * its municipal emblem and how many of the section's recent stories are from
 * it. A city with nothing to show is not offered.
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
  return (
    <nav className="kc" aria-label={`Lajmet e ${section} sipas qytetit`}>
      <ul className="kc-list">
        <li>
          <Link
            href={`/kategori/${slug}`}
            scroll={false}
            className="kc-chip"
            aria-current={!selected ? "page" : undefined}
          >
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
  );
}
