"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { NAV_CATEGORIES, normalizeCategory } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import { CATEGORY_ICONS as ICONS } from "@/lib/category-icons";

/**
 * The seven sections as a row of icon cards, under the homepage's latest-news
 * strip and at the top of category and article pages. It replaced the
 * navbar's "Kategoritë" dropdown: a category one click away and recognisable
 * by its mark, instead of hidden behind a menu.
 *
 * The marks live in lib/category-icons, shared with "Kalo te" and Top 5.
 *
 * `hero` sets the row on a category page's colour (components/category-banner),
 * with the current card lit up like a selected tab.
 */

export default function CategoryRail({ active, variant = "plain" }: { active?: string; variant?: "plain" | "hero" }) {
  const current = active ? normalizeCategory(active) : undefined;
  const listRef = useRef<HTMLUListElement>(null);

  // On a phone the row scrolls, and Showbiz is off-screen to the right: bring
  // the current card into view so the page shows where the reader is. Only
  // the row scrolls, never the page, and nothing moves when it already fits.
  useEffect(() => {
    const list = listRef.current;
    const card = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !card || list.scrollWidth <= list.clientWidth) return;
    const cardRight = card.offsetLeft + card.offsetWidth;
    if (card.offsetLeft < list.scrollLeft || cardRight > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = Math.max(0, card.offsetLeft - 16);
    }
  }, [current]);

  return (
    <nav className="cat-rail" data-variant={variant} aria-label="Kategoritë">
      <ul className="cat-rail-list" ref={listRef}>
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
