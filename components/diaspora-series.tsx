"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DIASPORA_ARTICLES } from "@/lib/mock-data";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import SectionLabel from "./section-label";
import SourceBadge from "./source-badge";

const TABS = [
  { key: "gjermania", label: "Gjermania", flag: "🇩🇪", color: "#FF4422" },
  { key: "zvicra",    label: "Zvicra",    flag: "🇨🇭", color: "#E53E3E" },
  { key: "italia",    label: "Italia",    flag: "🇮🇹", color: "#22863A" },
  { key: "shba",      label: "SHBA",      flag: "🇺🇸", color: "#1A56DB" },
  { key: "britania",  label: "Britania",  flag: "🇬🇧", color: "#7B341E" },
  { key: "austria",   label: "Austria",   flag: "🇦🇹", color: "#C05621" },
  { key: "suedia",    label: "Suedia",    flag: "🇸🇪", color: "#276749" },
];

function flagToCode(flag: string): string {
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return "";
  const a = cps[0] - 0x1f1e6 + 65;
  const b = cps[1] - 0x1f1e6 + 65;
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return String.fromCharCode(a, b);
}

export default function DiasporaSeries() {
  const [active, setActive] = useState("gjermania");
  const activeTab = TABS.find((t) => t.key === active)!;
  const articles = DIASPORA_ARTICLES[active] ?? [];

  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel label="SERIA E DIASPORËS" marginBottom={20} />

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
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
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF" }}>
                  {flagToCode(tab.flag)}
                </span>
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
            transition={{ duration: DUR.base, ease: EASE }}
            style={{ padding: "8px 0" }}
          >
            {articles.map((article, i) => (
              <motion.a
                key={article.id}
                href={article.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -8 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  transition: { duration: DUR.slow, delay: Math.min(i, 6) * STAGGER, ease: EASE },
                }}
                whileHover={{ backgroundColor: "#FAFAF8" }}
                transition={{ duration: DUR.fast, ease: EASE }}
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "16px 24px",
                  minHeight: "88px",
                  alignItems: "center",
                  borderBottom: i < articles.length - 1 ? "1px solid #F0ECE6" : "none",
                  textDecoration: "none",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                }}
              >
                {/* Source badge */}
                <div style={{ flexShrink: 0, width: "120px", overflow: "hidden" }}>
                  <SourceBadge source={article.source} flag={article.flag} size="sm" />
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
                  <ArrowRight size={16} strokeWidth={2} style={{ color: activeTab.color, opacity: 0.5 }} />
                </div>
              </motion.a>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
