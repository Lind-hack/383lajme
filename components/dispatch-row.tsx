"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Article } from "@/lib/mock-data";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import ArticleCard from "./article-card";

const LIQUID_GLASS: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  zIndex: 10,
  width: "50px",
  height: "50px",
  borderRadius: "50%",
  border: "0.5px solid rgba(255,255,255,0.55)",
  background: "linear-gradient(145deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.07) 100%)",
  backdropFilter: "blur(40px) saturate(200%) brightness(1.08)",
  WebkitBackdropFilter: "blur(40px) saturate(200%) brightness(1.08)",
  boxShadow:
    "0 8px 28px rgba(0,0,0,0.10), inset 0 2px 0 rgba(255,255,255,1.0), inset 0 -1px 0 rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)",
  color: "#111111",
  cursor: "pointer",
  fontSize: "22px",
  fontWeight: 700,
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
            style={{ ...LIQUID_GLASS, left: "-20px" }}
            initial={{ opacity: 0, scale: 0.95, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -10 }}
            transition={{ duration: DUR.slow, ease: EASE }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Lëviz majtas"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => scrollBy(1)}
        style={{ ...LIQUID_GLASS, right: "-20px" }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING}
        aria-label="Lëviz djathtas"
      >
        <ChevronRight size={22} strokeWidth={2.5} />
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
