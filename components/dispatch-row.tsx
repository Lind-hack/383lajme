"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { type Article } from "@/lib/mock-data";
import ArticleCard from "./article-card";

function scrollBtnStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    [side]: "-16px",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(26,26,26,0.9)",
    color: "#FFFFFF",
    cursor: "pointer",
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
    padding: 0,
  };
}

interface DispatchRowProps {
  articles: Article[];
}

export default function DispatchRow({ articles }: DispatchRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 252, behavior: "smooth" });
    if (dir === 1) setHasScrolled(true);
  }

  return (
    <div style={{ position: "relative" }}>
      {hasScrolled && (
        <button onClick={() => scrollBy(-1)} style={scrollBtnStyle("left")}>&#8592;</button>
      )}
      <button onClick={() => scrollBy(1)} style={scrollBtnStyle("right")}>&#8594;</button>

      <div
        ref={scrollRef}
        style={{
          overflowX: "auto",
          scrollbarWidth: "none",
          paddingBottom: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "16px", width: "max-content" }}>
          {articles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: "easeOut" }}
            >
              <ArticleCard article={article} variant="mini" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
