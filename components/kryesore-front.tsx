"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo, calcReadingTime } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER, RADIUS, SHADOW } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";

interface KryesoreFrontProps {
  lead: Article;
  secondary: Article[];
  mostRead: Article[];
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
    initial: { opacity: 0, y: 16 },
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
        <div style={{ padding: "24px 28px 26px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{
            fontSize: "clamp(22px, 2.2vw, 30px)",
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
            fontSize: "15px",
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
            <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500, marginLeft: "auto" }}>
              {timeAgo(article.publishedAt)}
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
        <div style={{ width: "112px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {article.imageUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", inset: 0 }}
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
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: catColor,
          }}>
            {article.category}
          </span>
          <h4 style={{
            fontSize: "16px",
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
          <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500, marginTop: "auto" }}>
            {article.source} · {timeAgo(article.publishedAt)}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

function MostReadRail({ articles }: { articles: Article[] }) {
  const reveal = useReveal(1);

  return (
    <motion.aside
      {...reveal}
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)",
        borderRadius: RADIUS.md,
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: SHADOW.card,
        padding: "24px 24px 16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
        <span style={{
          fontSize: "12px",
          fontWeight: 800,
          letterSpacing: "0.18em",
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
              gap: "16px",
              alignItems: "flex-start",
              padding: "14px 0",
              borderTop: i === 0 ? "none" : "1px solid #E8E3DB",
            }}
          >
            <span style={{
              fontSize: "22px",
              fontWeight: 800,
              lineHeight: 1,
              color: "#FF4422",
              letterSpacing: "-0.02em",
              flexShrink: 0,
              width: "30px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
              <span className="most-read-title" style={{
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1.35,
                letterSpacing: "-0.01em",
                color: "#111111",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {article.title}
              </span>
              <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500 }}>
                {article.category} · {timeAgo(article.publishedAt)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </motion.aside>
  );
}

export default function KryesoreFront({ lead, secondary, mostRead }: KryesoreFrontProps) {
  if (!lead) return null;

  return (
    <section>
      <SectionLabel
        label="KRYESORE"
        marginBottom={28}
        right={
          <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            Përditësuar {timeAgo(lead.publishedAt)}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Lead story */}
        <div className={mostRead.length > 0 ? "lg:col-span-8" : "lg:col-span-12"}>
          <LeadCard article={lead} />
        </div>

        {/* Right rail: most read, ranked by engagement (drops below secondaries on mobile) */}
        {mostRead.length > 0 && (
          <div className="lg:col-span-4 order-last lg:order-none">
            <MostReadRail articles={mostRead} />
          </div>
        )}

        {/* Secondary stories — two-up beneath */}
        {secondary.map((article, i) => (
          <div key={article.id} className="lg:col-span-6">
            <SecondaryCard article={article} index={i + 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
