"use client";

import { motion } from "framer-motion";
import { TONE_STATS } from "@/lib/mock-data";

export default function ToneDashboard() {
  const overallPositive = Math.round(
    TONE_STATS.reduce((sum, s) => sum + s.positive, 0) / TONE_STATS.length
  );

  return (
    <section style={{ marginBottom: "48px" }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "3px",
              height: "20px",
              background: "#FF4422",
              borderRadius: "2px",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#111111",
            }}
          >
            Toni i Mediave Botërore ndaj Kosovës
          </span>
        </div>

        {/* Summary stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(22,163,74,0.25)",
            borderRadius: "100px",
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "14px" }}>📈</span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#16A34A",
              letterSpacing: "0.04em",
            }}
          >
            Ky muaj: {overallPositive}% pozitive ndaj Kosovës
          </span>
        </motion.div>
      </div>

      {/* Dashboard card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          border: "1px solid #E8E3DB",
          padding: "clamp(14px, 3vw, 24px)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}
      >
        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          {[
            { color: "#16A34A", label: "Pozitiv" },
            { color: "#9CA3AF", label: "Neutral" },
            { color: "#E41E20", label: "Kritik" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "3px",
                  background: item.color,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B6B6B" }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Country rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {TONE_STATS.map((stat, i) => (
            <motion.div
              key={stat.country}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07, ease: "easeOut" }}
              style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 16px)" }}
            >
              {/* Country */}
              <div
                style={{
                  width: "clamp(60px, 20vw, 100px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "16px" }}>{stat.flag}</span>
                <span
                  style={{
                    fontSize: "clamp(11px, 2.5vw, 13px)",
                    fontWeight: 700,
                    color: "#111111",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {stat.country}
                </span>
              </div>

              {/* Segmented bar */}
              <div
                style={{
                  flex: 1,
                  height: "10px",
                  borderRadius: "100px",
                  overflow: "hidden",
                  display: "flex",
                  background: "#F3F4F6",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${stat.positive}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.07 + 0.2, ease: "easeOut" }}
                  style={{ background: "#16A34A", height: "100%" }}
                />
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${stat.neutral}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.07 + 0.3, ease: "easeOut" }}
                  style={{ background: "#9CA3AF", height: "100%" }}
                />
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${stat.negative}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.07 + 0.4, ease: "easeOut" }}
                  style={{ background: "#E41E20", height: "100%" }}
                />
              </div>

              {/* Percentages */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexShrink: 0,
                  width: "clamp(72px, 22vw, 120px)",
                  justifyContent: "flex-end",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#16A34A" }}>
                  {stat.positive}%
                </span>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF" }}>
                  {stat.neutral}%
                </span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#E41E20" }}>
                  {stat.negative}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
