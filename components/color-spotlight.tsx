"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type Article } from "@/lib/mock-data";
import TimeAgo from "./time-ago";
import { getCategoryColor, getCategoryGradient } from "@/lib/category-colors";
import { CATEGORY_TO_SLUG, type NavCategory } from "@/lib/category-map";
import { EASE, DUR, STAGGER } from "@/lib/tokens";

interface ColorSpotlightProps {
  articles: Article[];
  category: string;
  label: string;
}

/**
 * The place sections, as a stop rather than a strip.
 *
 * This was three equal text-only cards on a wide blue band: no picture, no
 * hierarchy, and — because the grid was auto-fill with a 280px minimum — three
 * small boxes huddled at the left of a 1280px row with the rest of the colour
 * empty. Nothing in it asked to be read, so the eye treated the band as a
 * divider and carried on scrolling.
 *
 * It is now a front page in miniature: one story large enough to actually look
 * at, with its own photograph, and a rail of three beside it. Hierarchy is what
 * stops a scroll — a row of equals gives the eye nowhere to land, while a
 * dominant image gives it somewhere to start and a rail gives it somewhere to
 * go next.
 *
 * The band is shared by Kosovë (blue) and Shqipëri (red) and takes its colour
 * from the category, so both sections read as the same kind of thing.
 */
export default function ColorSpotlight({ articles, category, label }: ColorSpotlightProps) {
  const color = getCategoryColor(category);
  const [, deep] = getCategoryGradient(category);
  const reduce = useReducedMotion();
  const slug = CATEGORY_TO_SLUG[category as NavCategory];

  const [lead, ...rest] = articles;
  if (!lead) return null;
  // Four, so the rail reaches roughly the depth of the lead. At three the
  // right-hand column stopped halfway down and left a large empty field of
  // colour beside the story, which reads as an unfinished layout.
  const rail = rest.slice(0, 4);

  const rise = () =>
    reduce
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 } }
      : { initial: { opacity: 0, y: 22 }, whileInView: { opacity: 1, y: 0 } };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: DUR.reveal, ease: EASE }}
      style={{
        // The section's colour reaches the card tags as a variable, so the
        // stylesheet does not need a copy of the palette.
        ["--spot-color" as string]: color,
        background: color,
        padding: "clamp(26px, 3vw, 42px) 24px",
        position: "relative",
        overflow: "hidden",
        marginBottom: "var(--space-section)",
      }}
    >
      {/* The watermark, and a deep vignette so white cards keep their edge
          against the flat colour instead of floating on it. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 90% at 85% 110%, ${deep} 0%, transparent 62%)`,
          opacity: 0.55,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "-40px",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "clamp(120px, 16vw, 220px)",
          fontWeight: 800,
          letterSpacing: "-0.06em",
          color: "rgba(255,255,255,0.07)",
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative" }}>
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DUR.base, ease: EASE }}
          className="spot-head"
        >
          <div className="spot-rule" />
          <span className="spot-label">{label}</span>
          <div className="spot-line" />
          {slug && (
            <Link href={`/kategori/${slug}`} className="spot-all">
              Të gjitha
              <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
            </Link>
          )}
        </motion.div>

        <div className="spot-grid" data-solo={rail.length === 0 || undefined}>
          {/* Lead */}
          <motion.div
            {...rise()}
            viewport={{ once: true }}
            transition={{ duration: DUR.slow, ease: EASE }}
          >
            <Link href={`/article/${lead.slug}`} className="spot-lead">
              <Cover article={lead} color={color} deep={deep} reduce={!!reduce} />
              <div className="spot-lead-body">
                <span className="spot-tag">
                  <i />
                  {lead.category}
                </span>
                <h3>{lead.title}</h3>
                {lead.excerpt && <p className="spot-lead-excerpt">{lead.excerpt}</p>}
                <span className="spot-meta">
                  {lead.source} · <TimeAgo iso={lead.publishedAt} /> më parë
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Rail */}
          {rail.length > 0 && (
            <div className="spot-rail">
              {rail.map((article, i) => (
                <motion.div
                  key={article.id}
                  {...rise()}
                  viewport={{ once: true }}
                  transition={{
                    delay: (i + 1) * STAGGER * 2,
                    duration: DUR.slow,
                    ease: EASE,
                  }}
                >
                  <Link href={`/article/${article.slug}`} className="spot-item">
                    <Thumb article={article} color={color} deep={deep} />
                    <span className="spot-item-body">
                      <span className="spot-item-title">{article.title}</span>
                      <span className="spot-meta">
                        {article.source} · <TimeAgo iso={article.publishedAt} /> më parë
                      </span>
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

/** The lead photograph, or a coloured panel that holds the same shape. */
function Cover({
  article,
  color,
  deep,
  reduce,
}: {
  article: Article;
  color: string;
  deep: string;
  reduce: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const coverSrc = failed ? undefined : article.imageUrl;
  const ok = Boolean(coverSrc);

  return (
    <span className="spot-cover" aria-hidden={ok ? undefined : true}>
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <Image
          src={coverSrc}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          onError={() => setFailed(true)}
          style={reduce ? { transition: "none" } : undefined}
        />
      ) : (
        <span
          className="spot-cover-blank"
          style={{ background: `linear-gradient(135deg, ${color}, ${deep})` }}
        />
      )}
    </span>
  );
}

/** A rail thumbnail. Falls back to the same coloured panel, at rail size. */
function Thumb({ article, color, deep }: { article: Article; color: string; deep: string }) {
  const [failed, setFailed] = useState(false);
  const ok = article.imageUrl && !failed;

  return (
    <span className="spot-thumb">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span
          className="spot-cover-blank"
          style={{ background: `linear-gradient(135deg, ${color}, ${deep})` }}
        />
      )}
    </span>
  );
}
