"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paging preserves the current search, filter and sort, because losing them on
 * page 2 is the fastest way to make an operator stop using pagination and ask
 * for one long list again -- which is where the old panel started.
 */
export default function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const pathname = usePathname();
  const params = useSearchParams();

  if (pageCount <= 1) return null;

  function hrefFor(target: number): string {
    const sp = new URLSearchParams(params.toString());
    if (target <= 1) sp.delete("page");
    else sp.set("page", String(target));
    // An open editor belongs to the page it was opened from.
    sp.delete("id");
    return sp.toString() ? `${pathname}?${sp}` : pathname;
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  const linkClass = "btn btn-sm";
  const deadClass = "btn btn-sm pointer-events-none opacity-40";

  return (
    <nav className="mt-3 flex items-center justify-center gap-2.5" aria-label="Faqet">
      <Link
        href={hrefFor(prev)}
        aria-disabled={atStart}
        tabIndex={atStart ? -1 : undefined}
        className={atStart ? deadClass : linkClass}
        scroll
      >
        <ChevronLeft size={14} strokeWidth={2.3} aria-hidden />
        <span className="hidden sm:inline">Para</span>
      </Link>

      <span className="tnum text-[12px] font-semibold" style={{ color: "var(--a-muted)" }}>
        Faqja {page} nga {pageCount}
      </span>

      <Link
        href={hrefFor(next)}
        aria-disabled={atEnd}
        tabIndex={atEnd ? -1 : undefined}
        className={atEnd ? deadClass : linkClass}
        scroll
      >
        <span className="hidden sm:inline">Pas</span>
        <ChevronRight size={14} strokeWidth={2.3} aria-hidden />
      </Link>
    </nav>
  );
}
