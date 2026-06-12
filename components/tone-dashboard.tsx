"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, X, ArrowLeft } from "lucide-react";
import { getDailyToneStats } from "@/lib/mock-data";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import SectionLabel from "./section-label";

interface ToneArticle {
  title: string;
  url: string;
  date: string;
}

interface ToneOutlet {
  name: string;
  sentiment: "positive" | "neutral" | "negative";
  articleCount: number;
  articles: ToneArticle[];
}

interface ToneOutletData {
  lastUpdated: string;
  countries: Record<string, { outlets: ToneOutlet[] }>;
}

const TONE_STATS = getDailyToneStats();

const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: "#16A34A" },
  neutral:  { label: "Neutral", color: "#9CA3AF" },
  negative: { label: "Kritik",  color: "#E41E20" },
};

function flagToCode(flag: string): string {
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return "";
  const a = cps[0] - 0x1f1e6 + 65;
  const b = cps[1] - 0x1f1e6 + 65;
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return String.fromCharCode(a, b);
}

export default function ToneDashboard() {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [activeOutlet, setActiveOutlet] = useState<{ country: string; name: string } | null>(null);
  const [outletData, setOutletData] = useState<ToneOutletData | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/tone-outlets.json")
      .then((r) => r.json())
      .then(setOutletData)
      .catch(() => {});
  }, []);

  const overallPositive = Math.round(
    TONE_STATS.reduce((sum, s) => sum + s.positive, 0) / TONE_STATS.length
  );

  function onRowEnter(country: string) {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHoveredCountry(country);
  }

  function scheduleClose() {
    leaveTimer.current = setTimeout(() => {
      setHoveredCountry(null);
      setActiveOutlet(null);
    }, 180);
  }

  function cancelClose() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }

  const popupOutlets =
    hoveredCountry && outletData
      ? outletData.countries[hoveredCountry]?.outlets ?? []
      : [];

  const activeOutletData =
    activeOutlet && outletData
      ? outletData.countries[activeOutlet.country]?.outlets.find(
          (o) => o.name === activeOutlet.name
        ) ?? null
      : null;

  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="Toni i Mediave Botërore ndaj Kosovës"
        marginBottom={20}
        right={
          <div
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
            <TrendingUp size={14} color="#16A34A" strokeWidth={2} />
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
          </div>
        }
      />

      {/* Dashboard card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: DUR.reveal, ease: EASE }}
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E8E3DB",
          padding: "clamp(14px, 3vw, 24px)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          position: "relative",
          overflow: "hidden",
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
            <div
              key={stat.country}
              onMouseEnter={() => onRowEnter(stat.country)}
              onMouseLeave={scheduleClose}
              style={{ cursor: outletData ? "pointer" : "default" }}
            >
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER, ease: EASE }}
                style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 16px)" }}
              >
                {/* Country — fixed 90px */}
                <div
                  style={{
                    width: "90px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF" }}>{flagToCode(stat.flag)}</span>
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
                    transition={{ duration: 0.7, delay: Math.min(i, 6) * STAGGER + 0.2, ease: EASE }}
                    style={{ background: "#16A34A", height: "100%" }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${stat.neutral}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: Math.min(i, 6) * STAGGER + 0.3, ease: EASE }}
                    style={{ background: "#9CA3AF", height: "100%" }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${stat.negative}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: Math.min(i, 6) * STAGGER + 0.4, ease: EASE }}
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
            </div>
          ))}
        </div>

        {/* Hover popup panel */}
        <AnimatePresence>
          {hoveredCountry && outletData && popupOutlets.length > 0 && (
            <motion.div
              key="popup"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: DUR.base, ease: EASE }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: "clamp(220px, 40%, 280px)",
                background: "#FAFAF8",
                borderLeft: "1px solid #E8E3DB",
                borderRadius: "0 16px 16px 0",
                padding: "16px",
                overflowY: "auto",
                zIndex: 20,
                boxShadow: "-6px 0 20px rgba(0,0,0,0.07)",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => { setHoveredCountry(null); setActiveOutlet(null); }}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "#6B6B6B",
                  padding: 0,
                }}
              >
                <X size={12} strokeWidth={2} />
              </button>

              {activeOutletData ? (
                /* Level 2 — articles from outlet */
                <>
                  <button
                    onClick={() => setActiveOutlet(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6B6B6B",
                      marginBottom: "10px",
                      padding: 0,
                    }}
                  >
                    <ArrowLeft size={12} strokeWidth={2} /> Kthehu
                  </button>
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#111111",
                      margin: "0 0 10px",
                    }}
                  >
                    {activeOutletData.name}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeOutletData.articles.map((article, idx) => (
                      <a
                        key={idx}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          padding: "8px 10px",
                          background: "#FFFFFF",
                          borderRadius: "8px",
                          border: "1px solid #E8E3DB",
                          textDecoration: "none",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#111111",
                            margin: "0 0 3px",
                            lineHeight: 1.35,
                          }}
                        >
                          {article.title}
                        </p>
                        <p style={{ fontSize: "10px", color: "#9CA3AF", margin: 0 }}>
                          {article.date}
                        </p>
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                /* Level 1 — outlets by sentiment */
                <>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                      color: "#6B6B6B",
                      margin: "0 0 12px",
                    }}
                  >
                    Media — {hoveredCountry}
                  </p>
                  {(["positive", "neutral", "negative"] as const).map((sentiment) => {
                    const group = popupOutlets.filter((o) => o.sentiment === sentiment);
                    if (group.length === 0) return null;
                    const meta = SENTIMENT_META[sentiment];
                    return (
                      <div key={sentiment} style={{ marginBottom: "14px" }}>
                        <p
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: meta.color,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase" as const,
                            margin: "0 0 6px",
                          }}
                        >
                          {meta.label}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {group.map((outlet) => (
                            <button
                              key={outlet.name}
                              onClick={() =>
                                setActiveOutlet({
                                  country: hoveredCountry!,
                                  name: outlet.name,
                                })
                              }
                              style={{
                                padding: "4px 10px",
                                borderRadius: "100px",
                                border: `1px solid ${meta.color}`,
                                background: "transparent",
                                fontSize: "11px",
                                fontWeight: 600,
                                color: meta.color,
                                cursor: "pointer",
                              }}
                            >
                              {outlet.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
