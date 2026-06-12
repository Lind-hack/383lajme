"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";

interface DispatchListProps {
  articles: Article[];
}

interface ListItemProps {
  article: Article;
  index: number;
  catColor: string;
}

function ListItem({ article, index, catColor }: ListItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: Math.min(index, 6) * STAGGER, duration: DUR.reveal, ease: EASE }}
    >
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
        <motion.div
          whileHover={{ background: "rgba(0,0,0,0.025)", x: 4 }}
          transition={{ duration: DUR.base, ease: EASE }}
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
          {/* Left accent bar */}
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

          {/* Index number */}
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
            {String(index + 1).padStart(2, "0")}
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

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
            <SourceBadge source={article.source} flag={article.sourceFlag} size="sm" bias={article.sourceBias} />
            <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
              {timeAgo(article.publishedAt)}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export default function DispatchList({ articles }: DispatchListProps) {
  // Ordered unique categories (preserving article order)
  const categories = [...new Set(articles.map((a) => a.category))];

  return (
    <section>
      {/* Section header */}
      <SectionLabel
        label="LAJMET E FUNDIT"
        marginBottom={8}
        right={
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
        }
      />

      {/* Categorised groups */}
      {categories.map((cat) => {
        const catArticles = articles.filter((a) => a.category === cat);
        const catColor = getCategoryColor(cat);
        return (
          <div key={cat} style={{ marginBottom: "24px" }}>
            {/* Category sub-header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "28px",
                marginBottom: "4px",
              }}
            >
              <div
                style={{
                  width: "3px",
                  height: "16px",
                  background: catColor,
                  borderRadius: "2px",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: catColor,
                }}
              >
                {cat}
              </span>
              <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
            </div>

            {/* Articles in this category */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {catArticles.map((article, i) => (
                <ListItem key={article.id} article={article} index={i} catColor={catColor} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
