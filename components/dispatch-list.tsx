"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { type Article } from "@/lib/mock-data";
import TimeAgo from "./time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";
import { LoadMoreButton, focusFirstNew, useArticlePages } from "./load-more-articles";
import { FeedAd, FeedMarket } from "./feed-sponsored";

interface DispatchListProps {
  articles: Article[];
  /** How many rows to render up front. */
  max?: number;
  label?: string;
  /** Anchor for the homepage's "Kalo te" row. */
  id?: string;
  /** Two columns of smaller rows on wide screens. */
  columns?: 1 | 2;
  /** Large rows: a bigger photograph and the standfirst in full. */
  size?: "md" | "lg";
  /**
   * Pages further back with "Shfaq më shumë". `seenIds` are the stories the
   * page already shows, so none of them comes back a second time.
   */
  /**
   * Older stories on demand. `infinite` loads them as the reader nears the
   * end of the list instead of waiting for the button, and brings the feed
   * back where it was after Back from an article.
   */
  loadMore?: {
    category?: string;
    seenIds: string[];
    infinite?: boolean;
    /** Page /kerko's ranked results for this query, from position `startOffset`. */
    search?: string;
    startOffset?: number;
  };
  /**
   * Cards between rows, for the /kerko feed: the matching Tregu market after
   * the fourth story and the ad slot every `every` stories.
   */
  sponsored?: { every?: number; market?: { title: string; href: string; meta?: string } | null };
}

/** The default: a shortlist, for callers that do not ask for more. */
const MAX_ITEMS = 10;

/**
 * One dispatch: number, photograph, headline, provenance.
 *
 * The row used to be 60px of thumbnail and 15px of headline, grouped into a
 * category heading per one or two stories. At twenty items that produced five
 * sub-lists of tiny rows, and the photographs were too small to identify
 * anything in them — the section read as a table of contents rather than as
 * news, and readers said plainly that it was barely readable.
 *
 * It is one list of ten now. Dropping the grouping is what buys the space: a
 * heading over a group of two costs more room than it returns, and the section
 * a story belongs to is better said on the row itself, where it also survives
 * being read out of order.
 */
export function DispatchRow({ article, index }: { article: Article; index: number }) {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();
  const color = getCategoryColor(article.category);
  const imageSrc = failed ? undefined : article.imageUrl;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: Math.min(index, 6) * STAGGER, duration: DUR.reveal, ease: EASE }}
    >
      <Link href={`/article/${article.slug}`} className="dispatch-row">
        <span className="dispatch-no" style={{ color }}>
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* The tint sits behind the photograph, not instead of it. A lazy image
            that has not arrived yet used to leave a flat grey rectangle, and at
            this size grey reads as a broken image rather than as one still
            loading. */}
        <span
          className="dispatch-thumb"
          style={{ background: `linear-gradient(135deg, ${color}, rgba(17,17,17,0.55))` }}
        >
          {imageSrc && (
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(max-width: 768px) 40vw, 400px"
              quality={90}
              onError={() => setFailed(true)}
            />
          )}
        </span>

        <span className="dispatch-body">
          <span className="dispatch-cat" style={{ color }}>
            <i style={{ background: color }} />
            {article.category}
          </span>
          <span className="dispatch-title">{article.title}</span>
          {article.excerpt && <span className="dispatch-excerpt">{article.excerpt}</span>}
          <span className="dispatch-meta">
            <SourceBadge
              source={article.source}
              flag={article.sourceFlag}
              size="sm"
              bias={article.sourceBias}
            />
            <span className="dispatch-time">
              <TimeAgo iso={article.publishedAt} /> më parë
            </span>
          </span>
        </span>
      </Link>
    </motion.div>
  );
}

export default function DispatchList({
  articles,
  max = MAX_ITEMS,
  label = "LAJMET E FUNDIT",
  id,
  columns = 1,
  size = "md",
  loadMore,
  sponsored,
}: DispatchListProps) {
  const items = articles.slice(0, max);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  // The cursor is the oldest row on screen: the list is newest-first, so
  // everything after it is older.
  const oldest = items.reduce<string | null>(
    (min, a) => (a.publishedAt && (!min || a.publishedAt < min) ? a.publishedAt : min),
    null
  );
  const searching = loadMore?.search !== undefined;
  const pages = useArticlePages({
    cursor: !loadMore ? null : searching ? String(loadMore.startOffset ?? items.length) : oldest,
    category: loadMore?.category,
    search: loadMore?.search,
    seenIds: loadMore?.seenIds ?? [],
  });
  const infinite = Boolean(loadMore?.infinite);
  const feedKey = searching
    ? `383-feed:search:${loadMore?.search}`
    : `383-feed:${loadMore?.category ?? "all"}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { status, loadMore: loadPage, restore, getCursor } = pages;

  // Back from an article: the stories already loaded and the scroll position
  // come back with the page, instead of the feed starting over at the top.
  useEffect(() => {
    if (!infinite) return;
    try {
      const returning = sessionStorage.getItem(`${feedKey}:return`);
      sessionStorage.removeItem(`${feedKey}:return`);
      const raw = sessionStorage.getItem(feedKey);
      if (returning === null || !raw) return;
      const saved = JSON.parse(raw) as { items?: Article[]; next?: string | null; at?: number };
      if (!saved?.items?.length || Date.now() - (saved.at ?? 0) > 30 * 60 * 1000) return;
      restore(saved.items, saved.next ?? null);
      const y = Number(returning);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    } catch {
      // Storage unavailable: the feed simply starts fresh.
    }
  }, [infinite, feedKey, restore]);

  // Remember what has been loaded, so a return can put it back.
  useEffect(() => {
    if (!infinite || pages.items.length === 0) return;
    try {
      sessionStorage.setItem(feedKey, JSON.stringify({ items: pages.items, next: getCursor(), at: Date.now() }));
    } catch {
      // Quota or private mode: nothing to restore later, nothing breaks now.
    }
  }, [infinite, feedKey, pages.items, getCursor]);

  // Load the next page while the reader is still ~2 screens from the end, so
  // the scroll never hits a wall.
  useEffect(() => {
    if (!infinite || status !== "idle") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadPage();
      },
      // The huge top margin counts a sentinel the reader has already flung
      // past (a tall footer on phones puts it above the screen) as reached.
      { rootMargin: "100000px 0px 1200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [infinite, status, loadPage]);

  if (items.length === 0) return null;

  const all = [...items, ...pages.items];

  return (
    <section className="dispatch" id={id}>
      <SectionLabel
        label={label}
        marginBottom={8}
        right={<span className="dispatch-count">{all.length}</span>}
      />

      <div
        className="dispatch-rows"
        data-cols={columns === 2 ? "2" : undefined}
        data-size={size === "lg" ? "lg" : undefined}
        ref={rowsRef}
        onClickCapture={
          infinite
            ? (event) => {
                if ((event.target as HTMLElement).closest("a[href]")) {
                  try {
                    sessionStorage.setItem(`${feedKey}:return`, String(window.scrollY));
                  } catch {
                    // No storage: Back starts the feed fresh.
                  }
                }
              }
            : undefined
        }
      >
        {all.map((article, i) => {
          const every = sponsored?.every ?? 0;
          return (
            <Fragment key={article.id}>
              <DispatchRow article={article} index={i} />
              {sponsored?.market && i === 3 && <FeedMarket {...sponsored.market} />}
              {every > 0 && (i + 1) % every === 0 && <FeedAd />}
            </Fragment>
          );
        })}
      </div>

      {infinite && status === "loading" && (
        <div className="dispatch-skeletons" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dispatch-skeleton">
              <span className="dispatch-skeleton-thumb" />
              <span className="dispatch-skeleton-lines">
                <i />
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>
      )}
      {infinite && <div ref={sentinelRef} className="dispatch-sentinel" aria-hidden="true" />}

      {loadMore && (!infinite || status === "error" || status === "done") && (
        <LoadMoreButton
          status={pages.status}
          added={pages.items.length}
          onClick={async () => {
            const from = all.length;
            const fresh = await pages.loadMore();
            if (fresh.length) requestAnimationFrame(() => focusFirstNew(rowsRef.current, from));
          }}
        />
      )}
    </section>
  );
}
