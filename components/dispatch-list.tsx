"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { type Article } from "@/lib/mock-data";
import TimeAgo from "./time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";

interface DispatchListProps {
  articles: Article[];
}

/** The tail of the front page is a shortlist, not an archive. */
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
function DispatchRow({ article, index }: { article: Article; index: number }) {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();
  const color = getCategoryColor(article.category);
  const hasImage = Boolean(article.imageUrl) && !failed;

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
          {hasImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
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

export default function DispatchList({ articles }: DispatchListProps) {
  const items = articles.slice(0, MAX_ITEMS);
  if (items.length === 0) return null;

  return (
    <section className="dispatch">
      <SectionLabel
        label="LAJMET E FUNDIT"
        marginBottom={8}
        right={<span className="dispatch-count">{items.length}</span>}
      />

      <div className="dispatch-rows">
        {items.map((article, i) => (
          <DispatchRow key={article.id} article={article} index={i} />
        ))}
      </div>
    </section>
  );
}
