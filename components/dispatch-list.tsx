"use client";

import { useRef, useState } from "react";
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

interface DispatchListProps {
  articles: Article[];
  /** How many rows to render up front. */
  max?: number;
  label?: string;
  /** Anchor for the homepage's "Kalo te" row. */
  id?: string;
  /** Two columns of smaller rows on wide screens. */
  columns?: 1 | 2;
  /**
   * Pages further back with "Shfaq më shumë". `seenIds` are the stories the
   * page already shows, so none of them comes back a second time.
   */
  loadMore?: { category?: string; seenIds: string[] };
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
              sizes="(max-width: 768px) 40vw, 220px"
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
  loadMore,
}: DispatchListProps) {
  const items = articles.slice(0, max);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  // The cursor is the oldest row on screen: the list is newest-first, so
  // everything after it is older.
  const oldest = items.reduce<string | null>(
    (min, a) => (a.publishedAt && (!min || a.publishedAt < min) ? a.publishedAt : min),
    null
  );
  const pages = useArticlePages({
    cursor: loadMore ? oldest : null,
    category: loadMore?.category,
    seenIds: loadMore?.seenIds ?? [],
  });
  if (items.length === 0) return null;

  const all = [...items, ...pages.items];

  return (
    <section className="dispatch" id={id}>
      <SectionLabel
        label={label}
        marginBottom={8}
        right={<span className="dispatch-count">{all.length}</span>}
      />

      <div className="dispatch-rows" data-cols={columns === 2 ? "2" : undefined} ref={rowsRef}>
        {all.map((article, i) => (
          <DispatchRow key={article.id} article={article} index={i} />
        ))}
      </div>

      {loadMore && (
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
