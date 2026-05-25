"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { type Article } from "@/lib/mock-data";
import ArticleCard from "./article-card";

interface DispatchRowProps {
  articles: Article[];
}

export default function DispatchRow({ articles }: DispatchRowProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={constraintsRef}
        style={{ overflow: "hidden" }}
      >
        <motion.div
          drag="x"
          dragConstraints={constraintsRef}
          dragElastic={0.1}
          style={{
            display: "flex",
            gap: "16px",
            paddingBottom: "8px",
            cursor: "grab",
            userSelect: "none",
          }}
          whileDrag={{ cursor: "grabbing" }}
        >
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
        </motion.div>
      </div>

    </div>
  );
}
