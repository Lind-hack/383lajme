"use client";

import { motion } from "framer-motion";
import { timeAgo, type Article } from "@/lib/mock-data";
import SourceBadge from "@/components/source-badge";
import ArticleCard from "@/components/article-card";
import ArticleSidebar from "@/components/article-sidebar";
import CategoryAccordion from "@/components/category-accordion";
import type { AccordionSlide } from "@/components/image-accordion";
import { EASE, DUR } from "@/lib/tokens";

interface Props {
  article: Article;
  related: Article[];
  catColor: string;
  catBg: string;
  categorySlides: AccordionSlide[];
}

export default function ArticleContent({ article, related, catColor, catBg, categorySlides }: Props) {
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
      <div style={{ height: "4px", background: catColor, width: "100%" }} />

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
        <article style={{ flex: 1, minWidth: 0 }}>

          {/* Group 1 — header block: badges + h1 + meta, single 0.45s rise */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.reveal, ease: EASE }}
          >
            <div
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
              <span
                style={{
                  width: "3px",
                  height: "3px",
                  borderRadius: "50%",
                  background: "#E8E3DB",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
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
            </div>

            <h1
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
            </h1>

            <div
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
            </div>
          </motion.div>

          {/* Group 2 — image + excerpt + body, 0.1s delay */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, delay: 0.1, ease: EASE }}
          >
            {article.imageUrl && (
              <div style={{ marginBottom: "36px" }}>
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    objectFit: "cover",
                    borderRadius: "var(--radius-md)",
                    display: "block",
                  }}
                />
              </div>
            )}

            <p
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
            </p>

            <div style={{ fontSize: "17px", lineHeight: 1.85, color: "#333333" }}>
              {article.body.split("\n\n").map((paragraph, i) => (
                <p key={i} style={{ margin: "0 0 28px" }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.div>
        </article>

        <div className="article-sidebar-col" style={{ width: "280px", flexShrink: 0 }}>
          <ArticleSidebar article={article} related={related} />
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .article-sidebar-col { display: none; }
        }
      `}</style>

      {/* Category cards (no image) — explore by category */}
      {categorySlides.length > 0 && (
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "8px 24px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
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
              EKSPLORO SIPAS KATEGORISË
            </span>
            <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
          </div>
          <CategoryAccordion slides={categorySlides} />
        </div>
      )}

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
