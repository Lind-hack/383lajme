"use client";

import { useRef } from "react";
import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import CategoryMark from "@/components/category-mark";
import type { PickerCity } from "./city-picker";

/**
 * The phone's city filter: one button naming the current choice, opening a
 * sheet from the bottom with every city, its emblem and its count.
 *
 * A native <dialog> opened with showModal(), so focus is trapped, Escape and
 * Back-gesture close it, and the page behind is inert without any of that
 * being rebuilt here. Picking a city navigates and closes the sheet.
 */
export default function CitySheet({
  section,
  slug,
  cities,
  current,
}: {
  section: string;
  slug: string;
  cities: PickerCity[];
  current: PickerCity | null;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const close = () => dialogRef.current?.close();

  return (
    <div className="kc-filter">
      <button
        type="button"
        className="kc-filter-button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {current ? (
          <img className="kc-emblem" src={current.emblem} alt="" width={26} height={26} decoding="async" />
        ) : (
          <span className="kc-mark" aria-hidden="true">
            <CategoryMark category={section} size={16} />
          </span>
        )}
        <span className="kc-filter-label">
          <span>Qyteti</span>
          <strong>{current?.name ?? "Të gjitha"}</strong>
        </span>
        <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        className="kc-sheet"
        aria-labelledby="kc-sheet-title"
        // A tap on the backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="kc-sheet-panel">
          <div className="kc-sheet-head">
            <h2 id="kc-sheet-title">Zgjidh qytetin</h2>
            <button type="button" className="kc-sheet-close" onClick={close} aria-label="Mbyll">
              <X size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
          <ul className="kc-sheet-list">
            <li>
              <Link href={`/kategori/${slug}`} scroll={false} onClick={close} aria-current={!current ? "page" : undefined}>
                <span className="kc-mark" aria-hidden="true">
                  <CategoryMark category={section} size={16} />
                </span>
                <span className="kc-sheet-name">Të gjitha</span>
                {!current && <Check size={18} strokeWidth={2.4} aria-hidden="true" />}
              </Link>
            </li>
            {cities.map((city) => (
              <li key={city.id}>
                <Link
                  href={`/kategori/${slug}?qyteti=${city.id}`}
                  scroll={false}
                  onClick={close}
                  aria-current={current?.id === city.id ? "page" : undefined}
                >
                  <img className="kc-emblem" src={city.emblem} alt="" width={30} height={30} loading="lazy" decoding="async" />
                  <span className="kc-sheet-name">{city.name}</span>
                  <span className="kc-count">
                    {city.count}
                    <span className="sr-only"> lajme</span>
                  </span>
                  {current?.id === city.id && <Check size={18} strokeWidth={2.4} aria-hidden="true" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  );
}
