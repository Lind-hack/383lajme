"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { EASE, DUR, STAGGER, FONT } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";

interface DispatchListProps {
  articles: Article[];
}

interface BriefProps {
  article: Article;
  index: number;
}

function Brief({ article, index }: BriefProps) {
  const catColor = getCategoryColor(article.category);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      // opacity-only — y-transforms jitter at CSS column breaks
      transition={{ delay: Math.min(index, 6) * STAGGER, duration: DUR.reveal, ease: EASE }}
      style={{
        breakInside: "avoid",
        paddingBottom: "20px",
        marginBottom: "20px",
        borderBottom: "1px solid #E8E3DB",
      }}
    >
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none" }}>
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
            fontSize: "17px",
            fontWeight: 600,
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
            color: "#111111",
            margin: "0 0 8px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
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
      </Link>
    </motion.div>
  );
}

export default function DispatchList({ articles }: DispatchListProps) {
  return (
    <section>
      <SectionLabel
        label="LAJMET E FUNDIT"
        marginBottom={28}
        rule="double"
        right={
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#6B6B6B" }}>
            {articles.length} lajme
          </span>
        }
      />

      <div className="briefs-cols">
        {articles.map((article, i) => (
          <Brief key={article.id} article={article} index={i} />
        ))}
      </div>
    </section>
  );
}
