import Link from "next/link";
import { motion } from "framer-motion";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER, FONT } from "@/lib/tokens";
import SourceBadge from "./source-badge";

interface CompactStoryProps {
  article: Article;
  index: number;
  /** "wide" = bottom-row: left thumb 120×84, serif 20px; default = right stack: 84×84 right thumb, serif 19px */
  variant?: "default" | "wide";
  showThumb?: boolean;
}

export default function CompactStory({
  article,
  index,
  variant = "default",
  showThumb = true,
}: CompactStoryProps) {
  const catColor = getCategoryColor(article.category);
  const isWide = variant === "wide";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: Math.min(index, 6) * STAGGER, duration: DUR.reveal, ease: EASE }}
      style={{
        borderBottom: "1px solid #E8E3DB",
        paddingBottom: "20px",
        paddingTop: index === 0 ? 0 : "20px",
      }}
    >
      <Link
        href={`/article/${article.slug}`}
        style={{
          textDecoration: "none",
          display: "flex",
          gap: "16px",
          alignItems: "flex-start",
          flexDirection: isWide ? "row" : "row-reverse",
        }}
      >
        {/* Thumb */}
        {showThumb && article.imageUrl && (
          <div
            style={{
              flexShrink: 0,
              width: isWide ? "120px" : "84px",
              height: "84px",
              overflow: "hidden",
              order: isWide ? -1 : 1,
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

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Category overline */}
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: catColor,
              marginBottom: "6px",
            }}
          >
            {article.category}
          </div>

          {/* Serif headline */}
          <p
            style={{
              fontFamily: FONT.serif,
              fontSize: isWide ? "20px" : "19px",
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "#111111",
              margin: "0 0 8px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.title}
          </p>

          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <SourceBadge source={article.source} flag={article.sourceFlag} bias={article.sourceBias} size="sm" />
            <span style={{ fontSize: "11px", color: "#6B6B6B" }}>{timeAgo(article.publishedAt)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
