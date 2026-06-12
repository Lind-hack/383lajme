import Link from "next/link";
import { motion } from "framer-motion";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, FONT } from "@/lib/tokens";
import SourceBadge from "./source-badge";

interface LeadStoryProps {
  article: Article;
}

export default function LeadStory({ article }: LeadStoryProps) {
  const catColor = getCategoryColor(article.category);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DUR.reveal, ease: EASE }}
    >
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
        {/* Image — 16:10 */}
        {article.imageUrl && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/10",
              overflow: "hidden",
              marginBottom: "20px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl}
              alt=""
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Kicker row: category overline + source + time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: catColor,
            }}
          >
            {article.category}
          </span>
          <span style={{ color: "#E8E3DB", fontSize: "11px" }}>·</span>
          <SourceBadge source={article.source} flag={article.sourceFlag} bias={article.sourceBias} size="sm" />
          <span style={{ color: "#E8E3DB", fontSize: "11px" }}>·</span>
          <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
            {timeAgo(article.publishedAt)}
          </span>
        </div>

        {/* Serif headline */}
        <h2
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(26px, 2.8vw, 40px)",
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            color: "#111111",
            margin: "0 0 14px",
          }}
        >
          {article.title}
        </h2>

        {/* 2-line excerpt */}
        <p
          style={{
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: 1.6,
            color: "#6B6B6B",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {article.excerpt}
        </p>
      </Link>
    </motion.div>
  );
}
