"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DIASPORA_ARTICLES } from "@/lib/mock-data";

const TABS = [
  { key: "gjermania", label: "Gjermania", flag: "🇩🇪", color: "#FF4422" },
  { key: "zvicra",    label: "Zvicra",    flag: "🇨🇭", color: "#E53E3E" },
  { key: "italia",    label: "Italia",    flag: "🇮🇹", color: "#22863A" },
  { key: "shba",      label: "SHBA",      flag: "🇺🇸", color: "#1A56DB" },
  { key: "britania",  label: "Britania",  flag: "🇬🇧", color: "#7B341E" },
  { key: "austria",   label: "Austria",   flag: "🇦🇹", color: "#C05621" },
  { key: "suedia",    label: "Suedia",    flag: "🇸🇪", color: "#276749" },
];

export default function DiasporaSeries() {
  const [active, setActive] = useState("gjermania");
  const activeTab = TABS.find((t) => t.key === active)!;
  const articles = DIASPORA_ARTICLES[active] ?? [];

  return (
    <section style={{ marginBottom: "48px" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <div style={{ width: "3px", height: "20px", background: "#FF4422", borderRadius: "2px" }} />
        <span
          style={{
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: "#111111",
          }}
        >
          Seria e Diasporës
        </span>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          border: "1px solid #E8E3DB",
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #E8E3DB",
            padding: "0 4px",
            overflowX: "auto" as const,
            WebkitOverflowScrolling: "touch" as const,
            scrollbarWidth: "none" as const,
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "14px 16px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  position: "relative",
                  outline: "none",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "16px" }}>{tab.flag}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? tab.color : "#6B6B6B",
                    letterSpacing: "0.04em",
                    transition: "color 0.2s ease",
                  }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "3px",
                      background: tab.color,
                      borderRadius: "3px 3px 0 0",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Articles */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ padding: "8px 0" }}
          >
            {articles.map((article, i) => (
              <motion.a
                key={article.id}
                href={article.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "16px 24px",
                  minHeight: "88px",
                  alignItems: "center",
                  borderBottom: i < articles.length - 1 ? "1px solid #F0ECE6" : "none",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#FAFAF8";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Source badge */}
                <div style={{ flexShrink: 0, width: "120px", overflow: "hidden" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(0,0,0,0.05)",
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: "100px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6B6B6B",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    <span>{article.flag}</span>
                    <span>{article.source}</span>
                  </span>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: "clamp(13px, 2.5vw, 14px)",
                      fontWeight: 700,
                      lineHeight: 1.35,
                      color: "#111111",
                      margin: "0 0 6px",
                    }}
                  >
                    {article.title}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.55,
                      color: "#6B6B6B",
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                      overflow: "hidden",
                    }}
                  >
                    {article.excerpt}
                  </p>
                </div>

                {/* Arrow */}
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={activeTab.color}
                    strokeWidth="2"
                    opacity={0.5}
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.a>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
