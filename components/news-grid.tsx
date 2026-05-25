"use client";

import { motion } from "framer-motion";
import { type Article } from "@/lib/mock-data";
import ArticleCard from "./article-card";

interface NewsGridProps {
  articles: Article[];
  title: string;
  accentColor?: string;
}

export default function NewsGrid({ articles, title, accentColor = "#FF4422" }: NewsGridProps) {
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
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "28px",
            background: accentColor,
            borderRadius: "2px",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#111111",
          }}
        >
          {title}
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "#E8E3DB",
          }}
        />
      </motion.div>

      {/* Grid */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article, i) => (
          <div key={article.id}>
            <ArticleCard article={article} variant="grid" index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
