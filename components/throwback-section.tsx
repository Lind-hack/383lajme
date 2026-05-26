"use client";

import { motion } from "framer-motion";
import { getDailyThrowback } from "@/lib/mock-data";

export default function ThrowbackSection() {
  const THROWBACK_ARTICLE = getDailyThrowback();
  return (
    <section style={{ marginBottom: "48px" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: "24px",
          padding: "clamp(16px, 4vw, 32px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap" as const,
            gap: "8px",
            marginBottom: "24px",
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>🕐</span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
              color: "#B45309",
            }}
          >
            Çfarë Tha Bota Para 5 Vjetësh
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#B45309",
              background: "rgba(180,83,9,0.12)",
              border: "1px solid rgba(180,83,9,0.25)",
              borderRadius: "100px",
              padding: "4px 10px",
            }}
          >
            Arkiv
          </span>
        </div>

        {/* Two-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* Left — old article */}
          <div
            style={{
              background: "rgba(180,83,9,0.06)",
              border: "1px solid rgba(180,83,9,0.15)",
              borderRadius: "16px",
              padding: "20px",
              opacity: 0.75,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "14px" }}>{THROWBACK_ARTICLE.oldSourceFlag}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#92400E",
                  letterSpacing: "0.06em",
                }}
              >
                {THROWBACK_ARTICLE.oldSource}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#92400E",
                  opacity: 0.6,
                }}
              >
                · {THROWBACK_ARTICLE.year}
              </span>
            </div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1.35,
                color: "#78350F",
                margin: "0 0 10px",
              }}
            >
              {THROWBACK_ARTICLE.oldTitle}
            </p>
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#92400E",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              "{THROWBACK_ARTICLE.oldExcerpt}"
            </p>
          </div>

          {/* Right — today's context */}
          <div
            style={{
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#16A34A",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "#16A34A",
                }}
              >
                Sot
              </span>
            </div>
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.65,
                color: "#2D2D2D",
                margin: 0,
                fontWeight: 500,
              }}
            >
              {THROWBACK_ARTICLE.todayNote}
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
