"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo, calcReadingTime } from "@/lib/mock-data";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";
import { EASE, DUR, STAGGER, RADIUS, SHADOW, FONT } from "@/lib/tokens";
import SourceBadge from "./source-badge";

interface ArticleCardProps {
  article: Article;
  variant?: "grid" | "mini" | "wide" | "full";
  index?: number;
}

/** Red warning badge for hostile (Serbian) sources — country code instead of emoji flag. */
function HostileBadge({ left = "8px" }: { left?: string }) {
  return (
    <div style={{
      position: "absolute",
      top: "8px",
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

export default function ArticleCard({ article, variant = "grid", index = 0 }: ArticleCardProps) {
  const catColor = getCategoryColor(article.category);
  const catBg = getCategoryBg(article.category, 0.08);
  const [imgFailed, setImgFailed] = useState(false);
  const readMins = calcReadingTime(article.body);

  // Shared motion config: reveal staggered up to index 6, hover lift with capped colored shadow
  const reveal = {
    initial: { opacity: 0, y: 16 },
    whileInView: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR.reveal, ease: EASE, delay: Math.min(index, 6) * STAGGER },
    },
    viewport: { once: true, margin: "-60px" },
  } as const;
  const hoverLift = { y: -4, boxShadow: `0 16px 40px ${catColor}1F` };
  const hoverTransition = { duration: DUR.base, ease: EASE } as const;

  if (variant === "mini") {
    return (
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", flexShrink: 0 }}>
        <motion.div
          whileHover={{ y: -2 }}
          transition={hoverTransition}
          style={{
            width: "228px",
            height: "358px",
            background: "#FFFFFF",
            borderRadius: RADIUS.md,
            border: "1px solid #E8E3DB",
            overflow: "hidden",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Image area — flat, no overlays */}
          <div style={{ height: "130px", overflow: "hidden", position: "relative", flexShrink: 0 }}>
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
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)`,
                }}
              />
            )}
            {article.sourceBias === "hostile" && <HostileBadge />}
          </div>

          {/* Content */}
          <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Kicker: NJOFTIM # · category */}
            <div style={{
              fontSize: "9px",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: catColor,
              marginBottom: "8px",
            }}>
              NJOFTIM {article.dispatch} · {article.category}
            </div>

            {/* Serif title */}
            <p style={{
              fontFamily: FONT.serif,
              fontSize: "16px",
              fontWeight: 600,
              lineHeight: 1.3,
              color: "#111111",
              margin: "0 0 8px",
              flex: 1,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              letterSpacing: "-0.01em",
            }}>
              {article.title}
            </p>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
              <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
              <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500 }}>
                {timeAgo(article.publishedAt)}
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  if (variant === "full") {
    return (
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
        <motion.div
          {...reveal}
          whileHover={hoverLift}
          transition={hoverTransition}
          style={{
            background: "#FFFFFF",
            borderRadius: RADIUS.md,
            border: "1px solid #E8E3DB",
            overflow: "hidden",
            cursor: "pointer",
            height: "300px",
            display: "flex",
            flexDirection: "row",
            boxShadow: SHADOW.card,
          }}
        >
          {/* Image — left 40% */}
          <div style={{ width: "40%", position: "relative", flexShrink: 0 }}>
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
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)`,
                }}
              />
            )}
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "4px", background: catColor }} />
            {article.sourceBias === "hostile" && <HostileBadge left="16px" />}
          </div>

          {/* Content — right 60% */}
          <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              {article.featured && (
                <span style={{
                  background: "#FF4422",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "3px 10px",
                  borderRadius: RADIUS.pill,
                }}>BREAKING</span>
              )}
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: catColor }}>
                {article.category}
              </span>
            </div>

            <h3 style={{
              fontSize: "24px",
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              color: "#111111",
              margin: "0 0 12px",
              flex: 1,
            }}>
              {article.title}
            </h3>

            <p style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#6B6B6B",
              margin: "0 0 20px",
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {article.excerpt}
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
              <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
                {timeAgo(article.publishedAt)} · {readMins} min
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  if (variant === "wide") {
    return (
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
        <motion.div
          {...reveal}
          whileHover={hoverLift}
          transition={hoverTransition}
          style={{
            background: "#FFFFFF",
            borderRadius: RADIUS.md,
            border: "1px solid #E8E3DB",
            overflow: "hidden",
            cursor: "pointer",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            boxShadow: SHADOW.card,
          }}
        >
          <div style={{ aspectRatio: "16/10", overflow: "hidden", position: "relative", flexShrink: 0 }}>
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
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)`,
                }}
              />
            )}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: catColor }} />
            {article.sourceBias === "hostile" && <HostileBadge />}
          </div>

          <div style={{ padding: "20px 24px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px", alignSelf: "flex-start" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: catColor, flexShrink: 0 }} />
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: catColor }}>
                {article.category}
              </span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#6B6B6B", letterSpacing: "0.06em" }}>
                #{article.dispatch}
              </span>
            </div>

            <h3 style={{
              fontSize: "20px",
              fontWeight: 800,
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              color: "#111111",
              margin: "0 0 10px",
              flex: 1,
            }}>
              {article.title}
            </h3>

            <p style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#6B6B6B",
              margin: "0 0 20px",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {article.excerpt}
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
              <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
                {timeAgo(article.publishedAt)} · {readMins} min
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  // grid variant (default) — flat editorial
  return (
    <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <motion.div
        {...reveal}
        whileHover={{ y: -3 }}
        transition={hoverTransition}
        style={{
          background: "#FFFFFF",
          borderRadius: RADIUS.md,
          border: "1px solid #E8E3DB",
          overflow: "hidden",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Image area — flat, no overlays */}
        <div style={{ aspectRatio: "16/10", overflow: "hidden", position: "relative", flexShrink: 0 }}>
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
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(135deg, ${catColor}cc 0%, ${catColor}44 100%)`,
              }}
            />
          )}
          {article.sourceBias === "hostile" && <HostileBadge />}
        </div>

        <div style={{
          padding: "16px 20px 20px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Flat overline — category + dispatch */}
          <div style={{
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: catColor,
            marginBottom: "8px",
          }}>
            {article.category} · #{article.dispatch}
          </div>

          {/* Serif title */}
          <h3 style={{
            fontFamily: FONT.serif,
            fontSize: "18px",
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            color: "#111111",
            margin: "0 0 10px",
            flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.title}
          </h3>

          {/* Excerpt */}
          <p style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#888888",
            margin: "0 0 16px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.excerpt}
          </p>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
            <span style={{ fontSize: "11px", color: "#AAAAAA", fontWeight: 500 }}>
              {timeAgo(article.publishedAt)}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
