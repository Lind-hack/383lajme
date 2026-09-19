"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { type Article, calcReadingTime } from "@/lib/mock-data";
import TimeAgo from "./time-ago";
import { getCategoryColor, getCategoryTextColor } from "@/lib/category-colors";

/** Every card in this row sits on the cream body, which is darker than any of
 *  the card fills above it — so it is the honest ground to measure against. */
const CARD_GROUND = "#F9F6F1";
import { EASE, DUR, STAGGER, RADIUS, SHADOW } from "@/lib/tokens";
import SourceBadge from "./source-badge";

interface KryesoreFrontProps {
  lead: Article;
  /** The column beside the lead: photo cards, not a ranked text list. Their
   *  count is free — the stack divides the lead's height evenly however many
   *  arrive, so a thin news day degrades to three without leaving a gap. */
  stack: Article[];
  secondary: Article[];
}

/** Red warning badge for hostile (Serbian) sources — country code instead of emoji flag. */
function HostileBadge({ left = "12px" }: { left?: string }) {
  return (
    <div style={{
      position: "absolute",
      top: "12px",
      left,
      display: "flex",
      alignItems: "center",
      gap: "5px",
      background: "#E41E20",
      color: "#fff",
      fontSize: "9px",
      fontWeight: 900,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "3px 8px",
      borderRadius: "4px",
      zIndex: 2,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontWeight: 700, letterSpacing: "0.08em", opacity: 0.85 }}>RS</span>
      <span>SERBI PËR KOSOVËN</span>
    </div>
  );
}

// Tone transparency chip — how the source covers the story. Matches the
// bias-dot palette used in SourceBadge / ToneDashboard.
const TONE_META: Record<Article["tone"], { color: string; label: string }> = {
  positive: { color: "#00A651", label: "Pozitiv" },
  neutral:  { color: "#9CA3AF", label: "Neutral" },
  negative: { color: "#E41E20", label: "Negativ" },
};

function ToneChip({ tone }: { tone: Article["tone"] }) {
  const meta = TONE_META[tone] ?? TONE_META.neutral;
  return (
    <span
      title="Toni i mbulimit nga burimi"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: RADIUS.pill,
        padding: "3px 8px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#6B6B6B",
        letterSpacing: "0.04em",
        cursor: "help",
      }}
    >
      <span style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: meta.color,
        flexShrink: 0,
      }} />
      <span>Toni: {meta.label}</span>
    </span>
  );
}

function useReveal(index: number) {
  return {
    // Editorial content must remain visible even when IntersectionObserver is
    // delayed or unavailable; motion enhances the card instead of gating it.
    initial: false,
    whileInView: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR.reveal, ease: EASE, delay: Math.min(index, 6) * STAGGER },
    },
    viewport: { once: true, margin: "-60px" },
  } as const;
}

function LeadCard({ article }: { article: Article }) {
  const catColor = getCategoryColor(article.category);
  const [imgFailed, setImgFailed] = useState(false);
  const readMins = calcReadingTime(article.body);
  const reveal = useReveal(0);

  return (
    <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <motion.div
        {...reveal}
        whileHover={{ y: -4, boxShadow: `0 16px 40px ${catColor}1F` }}
        transition={{ duration: DUR.base, ease: EASE }}
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)",
          borderRadius: RADIUS.md,
          border: "1px solid rgba(0,0,0,0.07)",
          overflow: "hidden",
          cursor: "pointer",
          boxShadow: SHADOW.card,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Image */}
        <div style={{ aspectRatio: "16/9", overflow: "hidden", position: "relative", flexShrink: 0 }}>
          {article.imageUrl && !imgFailed ? (
            <Image
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 768px) 100vw, 620px"
              // This is the homepage's LCP element - Lighthouse resolves it to
              // exactly this node. It was lazy, which failed all three of the
              // LCP discovery checks at once: no fetchpriority, not eagerly
              // loaded, and not discoverable in the initial HTML. The image
              // itself downloads in 27ms; the cost was 1.5s of waiting before
              // the browser was allowed to ask for it.
              //
              // `priority` sets loading=eager and fetchpriority=high and emits
              // a preload link, which is all three checks. It belongs on this
              // image and no other on the page: a second priority hint only
              // dilutes the first.
              priority
              onError={() => setImgFailed(true)}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)`,
            }} />
          )}

          {/* Bottom fade */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)",
            pointerEvents: "none",
          }} />

          {/* Category pill — glass, bottom-left */}
          <div style={{
            position: "absolute",
            bottom: "14px",
            left: "14px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(16px) saturate(180%)",
            WebkitBackdropFilter: "blur(16px) saturate(180%)",
            border: "0.5px solid rgba(255,255,255,0.45)",
            borderRadius: RADIUS.pill,
            padding: "4px 10px 4px 7px",
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: catColor,
              flexShrink: 0,
              boxShadow: `0 0 6px ${catColor}`,
            }} />
            <span style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#FFFFFF",
            }}>
              {article.category}
            </span>
          </div>

          {/* Reading time — bottom-right */}
          <div style={{
            position: "absolute",
            bottom: "14px",
            right: "14px",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "0.5px solid rgba(255,255,255,0.2)",
            borderRadius: RADIUS.pill,
            padding: "2px 6px",
          }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "0.04em" }}>
              {readMins} min
            </span>
          </div>

          {article.sourceBias === "hostile" && <HostileBadge />}
        </div>

        {/* Content */}
        <div style={{ padding: "28px 32px 30px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{
            fontSize: "clamp(25px, 2.35vw, 34px)",
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: "-0.02em",
            color: "#111111",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.title}
          </h3>

          <p style={{
            fontSize: "16px",
            lineHeight: 1.6,
            color: "#6B6B6B",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.excerpt}
          </p>

          {/* Transparency strip: source + tone + freshness */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
            <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
            <ToneChip tone={article.tone} />
            <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500, marginLeft: "auto" }}>
              <TimeAgo iso={article.publishedAt} />
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function SecondaryCard({ article, index }: { article: Article; index: number }) {
  const catColor = getCategoryColor(article.category);
  const [imgFailed, setImgFailed] = useState(false);
  const reveal = useReveal(index);

  return (
    <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <motion.div
        {...reveal}
        whileHover={{ y: -4, boxShadow: `0 16px 40px ${catColor}1F` }}
        transition={{ duration: DUR.base, ease: EASE }}
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)",
          borderRadius: RADIUS.md,
          border: "1px solid rgba(0,0,0,0.07)",
          overflow: "hidden",
          cursor: "pointer",
          boxShadow: SHADOW.card,
          display: "flex",
          alignItems: "stretch",
          height: "100%",
        }}
      >
        {/* Thumbnail — left */}
        <div style={{ width: "148px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {article.imageUrl && !imgFailed ? (
            <Image
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="148px"
              onError={() => setImgFailed(true)}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)`,
            }} />
          )}
        </div>

        {/* Text */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: getCategoryTextColor(article.category, CARD_GROUND),
          }}>
            {article.category}
          </span>
          <h4 style={{
            fontSize: "18px",
            fontWeight: 800,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            color: "#111111",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.title}
          </h4>
          <span style={{ fontSize: "12px", color: "#6B6B6B", fontWeight: 500, marginTop: "auto" }}>
            {article.source} · <TimeAgo iso={article.publishedAt} />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

export function MostReadRail({ articles }: { articles: Article[] }) {
  const reveal = useReveal(1);
  if (articles.length === 0) return null;

  return (
    <motion.aside
      {...reveal}
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)",
        borderRadius: RADIUS.md,
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: SHADOW.card,
        padding: "22px 20px 14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
        <span style={{
          fontSize: "12px",
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#111111",
        }}>
          Më të lexuarat
        </span>
        <span style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#FF4422",
          flexShrink: 0,
          alignSelf: "center",
        }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {articles.map((article, i) => (
          <Link
            key={article.id}
            href={`/article/${article.slug}`}
            className="most-read-row"
            style={{
              textDecoration: "none",
              display: "flex",
              gap: "13px",
              alignItems: "flex-start",
              padding: "13px 0",
              borderTop: i === 0 ? "none" : "1px solid #E8E3DB",
            }}
          >
            <span style={{
              fontSize: "20px",
              fontWeight: 800,
              lineHeight: 1,
              color: "#FF4422",
              letterSpacing: "-0.02em",
              flexShrink: 0,
              width: "26px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
              <span className="most-read-title" style={{
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1.38,
                letterSpacing: "-0.01em",
                color: "#111111",
                textWrap: "pretty",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {article.title}
              </span>
              {/* #777777 in the original scored 4.15:1 on this ground; the
                  muted token clears 4.5:1 and is indistinguishable. */}
              <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
                {article.category} · <TimeAgo iso={article.publishedAt} />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </motion.aside>
  );
}

/**
 * A card in the column beside the lead. Photo left, headline right — the lead's
 * own shape would need a 16:9 image plus three lines of text inside ~142px of
 * height, which leaves the picture as a letterboxed strip.
 */
function StackCard({ article, index }: { article: Article; index: number }) {
  const catColor = getCategoryColor(article.category);
  const [imgFailed, setImgFailed] = useState(false);
  const reveal = useReveal(index);

  return (
    <Link href={`/article/${article.slug}`} className="kf-stack-link">
      <motion.article
        {...reveal}
        whileHover={{ y: -3, boxShadow: `0 14px 32px ${catColor}1F` }}
        transition={{ duration: DUR.base, ease: EASE }}
        className="kf-stack-card"
      >
        <span className="kf-stack-thumb">
          {article.imageUrl && !imgFailed ? (
            <Image
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="128px"
              onError={() => setImgFailed(true)}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span
              className="kf-stack-fallback"
              style={{ background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)` }}
            />
          )}
        </span>
        <span className="kf-stack-text">
          <b style={{ color: getCategoryTextColor(article.category, CARD_GROUND) }}>
            {article.category}
          </b>
          <strong>{article.title}</strong>
          <em>
            <TimeAgo iso={article.publishedAt} />
          </em>
        </span>
      </motion.article>
    </Link>
  );
}

export default function KryesoreFront({ lead, stack, secondary }: KryesoreFrontProps) {
  if (!lead) return null;

  return (
    <section>
      <div className="kf-grid">
        <div className="kf-lead">
          <LeadCard article={lead} />
        </div>

        {/* Beside the lead, sharing its height exactly. */}
        {stack.length > 0 && (
          <div className="kf-stack">
            {stack.map((article, i) => (
              <StackCard key={article.id} article={article} index={i + 1} />
            ))}
          </div>
        )}

        {/* Two-up beneath, unchanged. */}
        {secondary.map((article, i) => (
          <div key={article.id} className="kf-secondary">
            <SecondaryCard article={article} index={i + 5} />
          </div>
        ))}
      </div>
    </section>
  );
}
