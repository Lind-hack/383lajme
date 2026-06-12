"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Article } from "@/lib/mock-data";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import ArticleCard from "./article-card";

const CHEVRON_BTN: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  zIndex: 10,
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  border: "1px solid #E8E3DB",
  background: "#F9F6F1",
  color: "#111111",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  transform: "translateY(-50%)",
};

const SPRING = { type: "spring" as const, stiffness: 300, damping: 18, mass: 0.7 };

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
            style={{ ...CHEVRON_BTN, left: "-20px" }}
            initial={{ opacity: 0, scale: 0.72, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.72, x: -10 }}
            transition={{ duration: DUR.slow, ease: EASE }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Lëviz majtas"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => scrollBy(1)}
        style={{ ...CHEVRON_BTN, right: "-20px" }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING}
        aria-label="Lëviz djathtas"
      >
        <ChevronRight size={20} strokeWidth={2} />
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
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: Math.min(i, 6) * STAGGER, duration: DUR.reveal, ease: EASE }}
            >
              <ArticleCard article={article} variant="mini" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
