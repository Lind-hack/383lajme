"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Article } from "@/lib/mock-data";
import ArticleCard from "./article-card";

const LIQUID_GLASS: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  zIndex: 10,
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  border: "0.5px solid rgba(255,255,255,0.55)",
  background: "rgba(255,255,255,0.15)",
  backdropFilter: "blur(40px) saturate(200%) brightness(1.08)",
  WebkitBackdropFilter: "blur(40px) saturate(200%) brightness(1.08)",
  boxShadow:
    "0 8px 28px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)",
  color: "#111111",
  cursor: "pointer",
  fontSize: "17px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  translateY: "-50%",
};

const SPRING = { type: "spring" as const, stiffness: 450, damping: 28 };

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
      <AnimatePresence>
        {hasScrolled && (
          <motion.button
            key="scroll-left"
            onClick={() => scrollBy(-1)}
            style={{ ...LIQUID_GLASS, left: "-20px" }}
            initial={{ opacity: 0, scale: 0.75, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.75, x: -6 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
          >
            &#8592;
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => scrollBy(1)}
        style={{ ...LIQUID_GLASS, right: "-20px" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
        transition={SPRING}
      >
        &#8594;
      </motion.button>

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
