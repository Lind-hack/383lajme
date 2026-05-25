"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";

const CAT_GRADIENT: Record<string, string> = {
  "Politikë":   "linear-gradient(135deg, #C41E3A 0%, #1A1A1A 100%)",
  "Siguri":     "linear-gradient(135deg, #1A56DB 0%, #0F0F0F 100%)",
  "Teknologji": "linear-gradient(135deg, #059669 0%, #1A1A1A 100%)",
  "Ekonomi":    "linear-gradient(135deg, #D97706 0%, #1A1A1A 100%)",
  "Sport":      "linear-gradient(135deg, #065F46 0%, #1A1A1A 100%)",
  "Showbiz":    "linear-gradient(135deg, #7C3AED 0%, #1A1A1A 100%)",
};

export default function ReagimiDites({ article }: { article: Article }) {
  const gradient = CAT_GRADIENT[article.category] ?? "linear-gradient(135deg, #FF4422 0%, #1A1A1A 100%)";

  return (
    <section style={{ marginBottom: "48px" }}>
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4, boxShadow: "0 24px 64px rgba(255,68,34,0.2)" }}
          style={{
            background: "linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)",
            borderRadius: "24px",
            border: "1px solid rgba(255,68,34,0.2)",
            overflow: "hidden",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            display: "flex",
            flexWrap: "wrap" as const,
            alignItems: "stretch",
            minHeight: "160px",
          }}
        >
          {/* Left: play area */}
          <div
            style={{
              flex: "0 0 200px",
              minWidth: "160px",
              minHeight: "140px",
              background: gradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "#FF4422",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(255,68,34,0.5)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>

            {/* Reading time pill */}
            <span
              style={{
                position: "absolute",
                bottom: "12px",
                right: "12px",
                background: "rgba(0,0,0,0.7)",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "100px",
                letterSpacing: "0.04em",
              }}
            >
              {article.readingTime} min
            </span>
          </div>

          {/* Right: content */}
          <div
            style={{
              flex: "1 1 280px",
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {/* Label */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#FF4422",
                  display: "inline-block",
                  flexShrink: 0,
                  boxShadow: "0 0 8px rgba(255,68,34,0.8)",
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  color: "#FF4422",
                }}
              >
                Reagimi i Ditës
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.08em",
                }}
              >
                · {timeAgo(article.publishedAt)}
              </span>
            </div>

            {/* Category */}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
              }}
            >
              {article.category}
            </span>

            {/* Title */}
            <h2
              style={{
                fontSize: "clamp(16px, 3.5vw, 20px)",
                fontWeight: 800,
                lineHeight: 1.3,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
                margin: 0,
              }}
            >
              {article.title}
            </h2>

            {/* Watch CTA */}
            <motion.span
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#FF4422",
                marginTop: "4px",
              }}
            >
              Lexo reagimin
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.span>
          </div>
        </motion.div>
      </Link>
    </section>
  );
}
