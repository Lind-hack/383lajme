"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";
import SourceBadge from "./source-badge";

interface ArticleCardProps {
  article: Article;
  variant?: "grid" | "mini" | "wide" | "full";
  index?: number;
}

export default function ArticleCard({ article, variant = "grid", index = 0 }: ArticleCardProps) {
  const catColor = getCategoryColor(article.category);
  const catBg = getCategoryBg(article.category, 0.08);
  const [imgFailed, setImgFailed] = useState(false);

  if (variant === "mini") {
    return (
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", flexShrink: 0 }}>
        <motion.div
          whileHover={{
            y: -3,
            boxShadow: `0 12px 40px ${catColor}25`,
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            width: "220px",
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E8E3DB",
            overflow: "hidden",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* Image area */}
          <div style={{ height: "120px", overflow: "hidden", position: "relative", flexShrink: 0 }}>
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
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: catColor }} />
          </div>

          <div style={{ padding: "14px 16px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: catColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: catColor,
                }}
              >
                {article.category}
              </span>
            </div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1.35,
                color: "#111111",
                margin: "0 0 10px",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {article.title}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} url={article.url} />
              <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
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
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
          whileHover={{ y: -4, boxShadow: `0 16px 48px ${catColor}28` }}
          style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            border: "1px solid #E8E3DB",
            overflow: "hidden",
            cursor: "pointer",
            height: "300px",
            display: "flex",
            flexDirection: "row",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
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
          </div>

          {/* Content — right 60% */}
          <div style={{ flex: 1, padding: "32px", display: "flex", flexDirection: "column" }}>
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
                  borderRadius: "20px",
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
              <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} url={article.url} />
              <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
                {timeAgo(article.publishedAt)} · {article.readingTime}m
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
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
          whileHover={{ y: -4, boxShadow: `0 16px 48px ${catColor}28` }}
          style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            border: "1px solid #E8E3DB",
            overflow: "hidden",
            cursor: "pointer",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ height: "240px", overflow: "hidden", position: "relative", flexShrink: 0 }}>
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
          </div>

          <div style={{ padding: "24px 28px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
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
              <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} url={article.url} />
              <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
                {timeAgo(article.publishedAt)} · {article.readingTime}m
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
        whileHover={{
          y: -4,
          boxShadow: `0 16px 48px ${catColor}28`,
        }}
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          border: "1px solid #E8E3DB",
          overflow: "hidden",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        {/* Image area */}
        <div style={{ height: "190px", overflow: "hidden", position: "relative", flexShrink: 0 }}>
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
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
        </div>

        <div
          style={{
            padding: "20px 24px 24px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Category badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "12px",
              alignSelf: "flex-start",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: catColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: catColor,
              }}
            >
              {article.category}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#6B6B6B",
                letterSpacing: "0.06em",
              }}
            >
              #{article.dispatch}
            </span>
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: "17px",
              fontWeight: 800,
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              color: "#111111",
              margin: "0 0 10px",
              flex: 1,
            }}
          >
            {article.title}
          </h3>

          {/* Excerpt */}
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "#6B6B6B",
              margin: "0 0 20px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.excerpt}
          </p>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} url={article.url} />
            <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
              {timeAgo(article.publishedAt)} · {article.readingTime}m
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
