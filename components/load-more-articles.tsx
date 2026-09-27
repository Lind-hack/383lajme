"use client";

import { useCallback, useRef, useState } from "react";
import type { Article } from "@/lib/mock-data";

type PageItem = Pick<Article, "id" | "slug" | "title" | "excerpt" | "source" | "sourceFlag" | "sourceBias" | "category" | "publishedAt"> & {
  imageUrl?: string | null;
};

/** A list row only reads these fields; the rest get neutral defaults. */
function toArticle(item: PageItem): Article {
  return {
    ...item,
    imageUrl: item.imageUrl ?? undefined,
    dispatch: "",
    body: "",
    tone: "neutral",
    readingTime: 1,
    featured: false,
  };
}

/**
 * Pages through /api/articles from a cursor, skipping anything the page
 * already shows. A button drives it by default; category pages also drive it
 * from scroll position (DispatchList `infinite`), keeping the button as the
 * fallback when a page fails to load.
 */
export function useArticlePages({
  cursor,
  category,
  search,
  seenIds,
  pageSize = 12,
}: {
  cursor: string | null;
  category?: string;
  /** Page through /kerko's ranked results instead; the cursor is a position. */
  search?: string;
  seenIds: readonly string[];
  pageSize?: number;
}) {
  const [items, setItems] = useState<Article[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">(cursor ? "idle" : "done");
  const next = useRef<string | null>(cursor);
  const seen = useRef<Set<string>>(new Set(seenIds));

  const loadMore = useCallback(async () => {
    if (!next.current) return [];
    setStatus("loading");
    const fresh: Article[] = [];
    try {
      // A page can come back mostly made of stories already on screen, so keep
      // asking until there is a full page of new ones or the archive ends.
      for (let round = 0; round < 4 && fresh.length < pageSize && next.current; round++) {
        if (search !== undefined) {
          // Ranked results page by position: take each page whole, so the
          // next offset is exactly where this one ended.
          const params = new URLSearchParams({ q: search, offset: next.current, limit: String(pageSize) });
          const response = await fetch(`/api/search/results?${params}`);
          if (!response.ok) throw new Error(`search ${response.status}`);
          const data = (await response.json()) as { items?: PageItem[]; next?: string | null };
          for (const item of data?.items ?? []) {
            if (!item?.id || seen.current.has(item.id)) continue;
            seen.current.add(item.id);
            fresh.push(toArticle(item));
          }
          next.current = data?.next ?? null;
          continue;
        }
        const params = new URLSearchParams({ before: next.current, limit: "24" });
        if (category) params.set("category", category);
        const response = await fetch(`/api/articles?${params}`);
        if (!response.ok) throw new Error(`articles ${response.status}`);
        const data = (await response.json()) as { items?: PageItem[]; next?: string | null };
        for (const item of data?.items ?? []) {
          if (!item?.id || seen.current.has(item.id)) continue;
          seen.current.add(item.id);
          fresh.push(toArticle(item));
          if (fresh.length >= pageSize) break;
        }
        next.current = fresh.length >= pageSize
          ? fresh[fresh.length - 1].publishedAt
          : data?.next ?? null;
      }
      setItems((current) => [...current, ...fresh]);
      setStatus(next.current ? "idle" : "done");
      return fresh;
    } catch {
      setStatus("error");
      return [];
    }
  }, [category, search, pageSize]);

  /** Put back a feed saved earlier this session (Back from an article). */
  const restore = useCallback((saved: Article[], cursorAfter: string | null) => {
    for (const a of saved) seen.current.add(a.id);
    next.current = cursorAfter;
    setItems(saved);
    setStatus(cursorAfter ? "idle" : "done");
  }, []);

  // Stable, so effects that read the cursor do not re-run on every render.
  const getCursor = useCallback(() => next.current, []);

  return { items, status, loadMore, restore, getCursor };
}

/**
 * The control under a list. It names what it does, reports how many arrived
 * to screen readers, and fails in place with a retry rather than silently.
 */
export function LoadMoreButton({
  status,
  added,
  onClick,
  label = "Shfaq më shumë lajme",
}: {
  status: "idle" | "loading" | "error" | "done";
  added: number;
  onClick: () => void;
  label?: string;
}) {
  if (status === "done" && added === 0) return null;
  return (
    <div className="load-more">
      {status === "done" ? (
        <p className="load-more-end">Kaq për tani. Lajmet e reja shfaqen këtu sapo publikohen.</p>
      ) : (
        <button
          type="button"
          className="load-more-button"
          onClick={onClick}
          disabled={status === "loading"}
          aria-busy={status === "loading"}
        >
          {status === "loading" ? "Duke ngarkuar…" : status === "error" ? "Provo përsëri" : label}
        </button>
      )}
      {status === "error" && (
        <p className="load-more-error" role="alert">
          Lajmet nuk u ngarkuan. Kontrollo lidhjen dhe provo përsëri.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {added > 0 ? `${added} lajme të shtuara` : ""}
      </p>
    </div>
  );
}

/** Moves focus to the first new row, so keyboard readers continue from it. */
export function focusFirstNew(container: HTMLElement | null, fromIndex: number) {
  const links = container?.querySelectorAll<HTMLAnchorElement>("a[href]");
  links?.[fromIndex]?.focus({ preventScroll: false });
}
