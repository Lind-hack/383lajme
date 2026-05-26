"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";

interface ColorSpotlightProps {
  articles: Article[];
  category: string;
  label: string;
}

export default function ColorSpotlight({ articles, category, label }: ColorSpotlightProps) {
  const color = getCategoryColor(category);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      style={{
        background: color,
        padding: "64px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Big faint label watermark */}
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
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "36px",
          }}
        >
          <div style={{ width: "4px", height: "28px", background: "rgba(255,255,255,0.6)", borderRadius: "2px" }} />
          <span
            style={{
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {label}
          </span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.2)" }} />
        </motion.div>

        {/* Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {articles.slice(0, 3).map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: "100%" }}
            >
              <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "24px",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: color,
                      }}
                    >
                      {article.category}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      lineHeight: 1.3,
                      color: "#111111",
                      margin: "0 0 10px",
                      letterSpacing: "-0.01em",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {article.title}
                  </h3>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6B6B6B",
                      fontWeight: 500,
                      marginTop: "auto",
                    }}
                  >
                    {article.source} · {timeAgo(article.publishedAt)} më parë
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
