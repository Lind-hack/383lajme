"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo, calcReadingTime } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER, RADIUS, SHADOW } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";
import DoubleRule from "./double-rule";

// ── Lead story ──────────────────────────────────────────────

function LeadStory({ article, index }: { article: Article; index: number }) {
  const catColor = getCategoryColor(article.category);
  const [imgFailed, setImgFailed] = useState(false);
  const readMins = calcReadingTime(article.body);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * STAGGER, duration: DUR.reveal, ease: EASE }}
    >
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: DUR.base, ease: EASE }}
          style={{ cursor: "pointer" }}
        >
          {/* Image */}
          <div style={{ aspectRatio: "4/3", borderRadius: RADIUS.md, overflow: "hidden", position: "relative", marginBottom: "16px" }}>
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
              <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)` }} />
            )}
            {/* Category pill */}
            <div style={{
              position: "absolute", bottom: "12px", left: "12px",
              display: "flex", alignItems: "center", gap: "5px",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              border: "0.5px solid rgba(255,255,255,0.4)",
              borderRadius: RADIUS.pill, padding: "4px 10px 4px 7px",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: catColor, flexShrink: 0 }} />
              <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFF" }}>
                {article.category}
              </span>
            </div>
          </div>

          {/* Headline */}
          <h2 style={{
            fontSize: "clamp(22px, 2.5vw, 30px)",
            fontFamily: "var(--font-fraunces), 'Fraunces', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: "#111111",
            margin: "0 0 10px",
          }}>
            {article.title}
          </h2>

          <p style={{
            fontSize: "14px",
            lineHeight: 1.65,
            color: "#6B6B6B",
            margin: "0 0 14px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.excerpt}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
            <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500 }}>{timeAgo(article.publishedAt)} · {readMins} min</span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ── Compact story ────────────────────────────────────────────

function CompactStory({ article, index, showRule }: { article: Article; index: number; showRule?: boolean }) {
  const catColor = getCategoryColor(article.category);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * STAGGER, duration: DUR.reveal, ease: EASE }}
    >
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
        <motion.div
          whileHover={{ background: "rgba(0,0,0,0.02)" }}
          transition={{ duration: DUR.base, ease: EASE }}
          style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "4px 0", borderRadius: "8px" }}
        >
          {/* Thumbnail */}
          <div style={{ width: "72px", height: "72px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
            {article.imageUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.imageUrl} alt="" aria-hidden="true" onError={() => setImgFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)` }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "inline-block", marginBottom: "4px",
              fontSize: "9px", fontWeight: 800, letterSpacing: "0.15em",
              textTransform: "uppercase", color: catColor,
            }}>{article.category}</span>
            <p style={{
              fontSize: "14px",
              fontFamily: "var(--font-fraunces), 'Fraunces', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 600,
              lineHeight: 1.3,
              color: "#111111",
              margin: "0 0 4px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {article.title}
            </p>
            <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500 }}>{timeAgo(article.publishedAt)}</span>
          </div>
        </motion.div>
      </Link>
      {showRule && <div style={{ height: "1px", background: "#E8E3DB", margin: "12px 0" }} />}
    </motion.div>
  );
}

// ── Magazine Grid ────────────────────────────────────────────

interface MagazineGridProps {
  articles: Article[];
  title?: string;
  accentColor?: string;
}

export default function MagazineGrid({ articles, title = "KRYESORE", accentColor = "#FF4422" }: MagazineGridProps) {
  if (articles.length === 0) return null;

  const [lead, ...rest] = articles;
  const sideStories = rest.slice(0, 3);
  const bottomStories = rest.slice(3);

  return (
    <section>
      <SectionLabel label={title} accent={accentColor} marginBottom={24} />

      {/* Main row: lead (left) + sidebar (right) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "32px",
        alignItems: "start",
        marginBottom: bottomStories.length ? "32px" : 0,
      }}
        className="magazine-grid-row"
      >
        {/* Lead story */}
        <LeadStory article={lead} index={0} />

        {/* Side stories */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <DoubleRule marginBottom={16} />
          {sideStories.map((a, i) => (
            <CompactStory key={a.id} article={a} index={i + 1} showRule={i < sideStories.length - 1} />
          ))}
          <DoubleRule marginTop={16} />
        </div>
      </div>

      {/* Bottom row: remaining as equal-width grid */}
      {bottomStories.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "20px",
        }}>
          {bottomStories.map((a, i) => (
            <CompactStory key={a.id} article={a} index={i + sideStories.length + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
