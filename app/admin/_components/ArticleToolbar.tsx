"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import type { NavCategory } from "@/lib/category-map";

/**
 * Search, filter and sort.
 *
 * All three live in the URL and are applied in Postgres. The old panel filtered
 * an in-memory array of 1,228 rows on every keystroke and only ever matched
 * title and source; this matches the body too without ever sending one.
 *
 * The URL carrying the state is what makes a filtered view shareable and the
 * back button behave, which matters when the operator is jumping in from an
 * email link.
 */

const SORTS = [
  { key: "recent", label: "Më të rejat" },
  { key: "oldest", label: "Më të vjetrat" },
  { key: "score", label: "Rezultati" },
] as const;

export default function ArticleToolbar({
  categories,
  total,
}: {
  categories: Array<{ category: NavCategory; count: number }>;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const typed = useRef(false);

  /**
   * Keep the box in step with the URL without fighting the operator mid-word.
   *
   * `typed` was previously latched true on the first keystroke and never
   * cleared, which disabled this sync for the life of the component: pressing
   * Back then dropped `q` from the URL and re-rendered an unfiltered list while
   * the input still showed the old term. It is released once what was typed has
   * actually reached the URL, so a later external change is adopted again.
   */
  useEffect(() => {
    if (!typed.current) {
      setQ(urlQ);
      return;
    }
    if (urlQ === q.trim()) typed.current = false;
  }, [urlQ, q]);

  function apply(next: Record<string, string | null>, replace = false) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") sp.delete(key);
      else sp.set(key, value);
    }
    // Any change to what is being listed returns to the first page; staying on
    // page 4 of a filter that now has one page shows an empty screen.
    if (!("page" in next)) sp.delete("page");
    const href = sp.toString() ? `${pathname}?${sp}` : pathname;
    startTransition(() => {
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }

  // Debounced search: a request per keystroke would queue behind itself.
  useEffect(() => {
    if (!typed.current || q === urlQ) return;
    const t = setTimeout(() => apply({ q: q.trim() || null }, true), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCategory = params.get("category") ?? "";
  const activeSort = params.get("sort") ?? "recent";
  const filtered = Boolean(urlQ || activeCategory);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 sm:max-w-[380px] sm:flex-1">
          <Search
            size={15}
            strokeWidth={2.2}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--a-faint)" }}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              typed.current = true;
              setQ(e.target.value);
            }}
            placeholder="Kërko në titull, tekst, burim…"
            aria-label="Kërko artikuj"
            name="q"
            autoComplete="off"
            spellCheck={false}
            className="field field-icon-l field-icon-r"
          />
          {pending ? (
            <Loader2
              size={14}
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
              style={{ color: "var(--a-faint)" }}
            />
          ) : q ? (
            <button
              type="button"
              onClick={() => {
                typed.current = true;
                setQ("");
              }}
              aria-label="Pastro kërkimin"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md"
              style={{ color: "var(--a-faint)" }}
            >
              <X size={14} strokeWidth={2.4} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
        <select
          value={activeSort}
          onChange={(e) => apply({ sort: e.target.value === "recent" ? null : e.target.value })}
          aria-label="Rendit"
          className="field field-auto"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <span
          className="tnum ml-auto shrink-0 text-[12px] font-semibold"
          style={{ color: "var(--a-muted)" }}
          aria-live="polite"
        >
          {total} {total === 1 ? "artikull" : "artikuj"}
        </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => apply({ category: null })}
          aria-pressed={!activeCategory}
          className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold transition-colors"
          style={{
            background: !activeCategory ? "var(--a-ink)" : "var(--a-panel)",
            color: !activeCategory ? "#fff" : "var(--a-muted)",
            border: `1px solid ${!activeCategory ? "var(--a-ink)" : "var(--a-border-strong)"}`,
          }}
        >
          Të gjitha
        </button>
        {categories.map(({ category, count }) => {
          const on = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => apply({ category: on ? null : category })}
              aria-pressed={on}
              className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold transition-colors"
              style={{
                background: on ? "var(--a-ink)" : "var(--a-panel)",
                color: on ? "#fff" : "var(--a-muted)",
                border: `1px solid ${on ? "var(--a-ink)" : "var(--a-border-strong)"}`,
              }}
            >
              {category}
              <span className="tnum ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
        {filtered && (
          <button
            type="button"
            onClick={() => {
              typed.current = true;
              setQ("");
              apply({ q: null, category: null });
            }}
            className="ml-1 shrink-0 text-[12px] font-semibold underline underline-offset-2"
            style={{ color: "var(--a-muted)" }}
          >
            Pastro
          </button>
        )}
      </div>
    </div>
  );
}
