"use client";

import { motion } from "framer-motion";
import { timeAgo, type Article } from "@/lib/mock-data";
import SourceBadge from "@/components/source-badge";
import ArticleCard from "@/components/article-card";
import ArticleSidebar from "@/components/article-sidebar";

interface Props {
  article: Article;
  related: Article[];
  catColor: string;
  catBg: string;
}

export default function ArticleContent({ article, related, catColor, catBg }: Props) {
  const dynamicReadTime = Math.max(1, Math.ceil(article.body.split(/\s+/).length / 200));

  return (
    <main
      style={{
        position: "relative",
        zIndex: 1,
        paddingTop: "80px",
        background: "#F9F6F1",
        minHeight: "100vh",
      }}
    >
      {/* Category color accent bar */}
      <div style={{ height: "4px", background: catColor, width: "100%" }} />

      {/* 2-column layout: article + sidebar */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "56px 24px 64px",
          display: "flex",
          gap: "48px",
          alignItems: "flex-start",
        }}
      >
        {/* ── Article column ── */}
        <article style={{ flex: 1, minWidth: 0 }}>
          {/* Dispatch + category label row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "28px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#FF4422",
                background: "rgba(255,68,34,0.08)",
                padding: "5px 12px",
                borderRadius: "100px",
                border: "1.5px solid rgba(255,68,34,0.2)",
              }}
            >
              NJOFTIM #{String(article.dispatch).padStart(2, "0")}
            </span>
            <span style={{ color: "#E8E3DB", fontSize: "12px" }}>◆</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: catColor,
                background: catBg,
                padding: "5px 12px",
                borderRadius: "100px",
                border: `1.5px solid ${catColor}33`,
              }}
            >
              {article.category}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#111111",
              margin: "0 0 28px",
            }}
          >
            {article.title}
          </motion.h1>

          {/* Meta row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "32px",
              paddingBottom: "32px",
              borderBottom: "1px solid #E8E3DB",
            }}
          >
            <SourceBadge source={article.source} flag={article.sourceFlag} />
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 500 }}>
              {timeAgo(article.publishedAt)} më parë
            </span>
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 500 }}>
              {dynamicReadTime} min lexim
            </span>
          </motion.div>

          {/* Hero image */}
          {article.imageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              style={{ marginBottom: "36px" }}
            >
              <img
                src={article.imageUrl}
                alt={article.title}
                style={{
                  width: "100%",
                  maxHeight: "460px",
                  objectFit: "cover",
                  borderRadius: "16px",
                  display: "block",
                }}
              />
            </motion.div>
          )}

          {/* Excerpt lead */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: "20px",
              fontWeight: 500,
              lineHeight: 1.65,
              color: "#111111",
              margin: "0 0 32px",
              borderLeft: `4px solid ${catColor}`,
              paddingLeft: "20px",
            }}
          >
            {article.excerpt}
          </motion.p>

          {/* Body */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              fontSize: "17px",
              lineHeight: 1.85,
              color: "#333333",
            }}
          >
            {article.body.split("\n\n").map((paragraph, i) => (
              <p key={i} style={{ margin: "0 0 28px" }}>
                {paragraph}
              </p>
            ))}
          </motion.div>
        </article>

        {/* ── Sidebar column ── */}
        <div className="article-sidebar-col" style={{ width: "280px", flexShrink: 0 }}>
          <ArticleSidebar article={article} related={related} />
        </div>
      </div>

      {/* Collapse sidebar on narrow screens */}
      <style>{`
        @media (max-width: 1023px) {
          .article-sidebar-col { display: none; }
        }
      `}</style>

      {/* Related articles */}
      {related.length > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid #E8E3DB",
            padding: "56px 24px 80px",
          }}
        >
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              <div style={{ width: "4px", height: "28px", background: catColor, borderRadius: "2px" }} />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#111111",
                }}
              >
                NJOFTIME TË LIDHURA
              </span>
              <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
              }}
            >
              {related.map((a, i) => (
                <ArticleCard key={a.id} article={a} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
