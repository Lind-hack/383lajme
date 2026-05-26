"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { type Article } from "@/lib/mock-data";
import ArticleCard from "./article-card";

function scrollBtnStyle(
  side: "left" | "right",
  hovered: boolean
): React.CSSProperties {
  return {
    position: "absolute",
    [side]: "-20px",
    top: "50%",
    transform: hovered ? "translateY(-50%) scale(1.08)" : "translateY(-50%)",
    zIndex: 10,
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.6)",
    background: "rgba(255,255,255,0.55)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    boxShadow: hovered
      ? "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.06)"
      : "0 4px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.04)",
    color: "#111111",
    cursor: "pointer",
    fontSize: "17px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };
}

interface DispatchRowProps {
  articles: Article[];
}

export default function DispatchRow({ articles }: DispatchRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverRight, setHoverRight] = useState(false);

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 252, behavior: "smooth" });
    if (dir === 1) setHasScrolled(true);
  }

  return (
    <div style={{ position: "relative" }}>
      {hasScrolled && (
        <button
          onClick={() => scrollBy(-1)}
          style={scrollBtnStyle("left", hoverLeft)}
          onMouseEnter={() => setHoverLeft(true)}
          onMouseLeave={() => setHoverLeft(false)}
        >
          &#8592;
        </button>
      )}
      <button
        onClick={() => scrollBy(1)}
        style={scrollBtnStyle("right", hoverRight)}
        onMouseEnter={() => setHoverRight(true)}
        onMouseLeave={() => setHoverRight(false)}
      >
        &#8594;
      </button>

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
