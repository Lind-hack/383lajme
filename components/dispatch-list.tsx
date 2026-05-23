"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import SourceBadge from "./source-badge";

interface DispatchListProps {
  articles: Article[];
}

export default function DispatchList({ articles }: DispatchListProps) {
  return (
    <section>
      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ width: "4px", height: "32px", background: "#FF4422", borderRadius: "2px", flexShrink: 0 }} />
        <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#111111" }}>
          LAJMET E FUNDIT
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#FF4422",
            background: "rgba(255,68,34,0.08)",
            padding: "3px 10px",
            borderRadius: "100px",
            border: "1px solid rgba(255,68,34,0.2)",
          }}
        >
          {articles.length}
        </span>
        <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
      </motion.div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {articles.map((article, i) => {
          const catColor = getCategoryColor(article.category);
          return (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
            >
              <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
                <motion.div
                  whileHover={{
                    background: "rgba(0,0,0,0.025)",
                    x: 4,
                  }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #E8E3DB",
                    position: "relative",
                  }}
                >
                  {/* Left accent bar — category color */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "8px",
                      bottom: "8px",
                      width: "3px",
                      borderRadius: "2px",
                      background: catColor,
                      opacity: 0.35,
                    }}
                  />

                  {/* Dispatch number */}
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: catColor,
                      minWidth: "36px",
                      letterSpacing: "-0.02em",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Thumbnail */}
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
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
                          background: `linear-gradient(135deg, ${catColor}cc, ${catColor}44)`,
                        }}
                      />
                    )}
                  </div>

                  {/* Text block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Category pill */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
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
                    {/* Title */}
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        lineHeight: 1.35,
                        color: "#111111",
                        margin: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {article.title}
                    </p>
                  </div>

                  {/* Right side */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "6px",
                      flexShrink: 0,
                    }}
                  >
                    <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} url={article.url} />
                    <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
                      {timeAgo(article.publishedAt)}
                    </span>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
