"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, X, ArrowLeft, ArrowUpRight } from "lucide-react";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import { useCanHover } from "@/hooks/use-can-hover";
import SectionLabel from "./section-label";
import Sparkline from "./tone/sparkline";
import type { ToneOutletsData, ToneSummary } from "@/lib/tone-data";

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

export default function ToneDashboard({ summary }: { summary: ToneSummary }) {
  const canHover = useCanHover();
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [activeOutlet, setActiveOutlet] = useState<{ country: string; name: string } | null>(null);
  const [outletData, setOutletData] = useState<ToneOutletsData | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/tone-outlets.json")
      .then((r) => r.json())
      .then(setOutletData)
      .catch(() => {});
  }, []);

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

  // No scraper history yet (fresh checkout, or the daily job hasn't run) —
  // say so plainly instead of rendering a fabricated chart.
  if (!summary.hasData) {
    return (
      <section style={{ marginBottom: "var(--space-section)" }}>
        <SectionLabel label="Toni i Mediave Botërore ndaj Kosovës" marginBottom={20} />
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E8E3DB",
            padding: "32px",
            fontSize: "13.5px",
            color: "#6B6B6B",
          }}
        >
          Analiza po ndërtohet — te dhënat e para do të shfaqen pas mbledhjes ditore të parë.
        </div>
      </section>
    );
  }

  const idx = summary.overallIndex ?? 0;
  const delta = summary.weekDelta;
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor = delta == null || delta === 0 ? "#9CA3AF" : delta > 0 ? "#16A34A" : "#E41E20";

  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="Toni i Mediave Botërore ndaj Kosovës"
        marginBottom={20}
        right={
          <a
            href="/toni"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#6B6B6B",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
            }}
          >
            Analiza e plotë <ArrowUpRight size={13} strokeWidth={2} />
          </a>
        }
      />

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
        {/* Index hero — the one number that anchors the whole feature */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px",
            paddingBottom: "20px",
            marginBottom: "20px",
            borderBottom: "1px solid #F0EDE6",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "14px" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>
                Indeksi i Tonit
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ fontSize: "clamp(36px, 6vw, 48px)", fontWeight: 800, color: "#111111", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {idx}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: deltaColor,
                  }}
                >
                  <DeltaIcon size={14} strokeWidth={2.5} />
                  {delta == null ? "e re" : `${delta > 0 ? "+" : ""}${delta} këtë javë`}
                </span>
              </div>
            </div>
            {summary.sparkline.length >= 2 && (
              <Sparkline points={summary.sparkline.map((p) => p.index)} color={idx >= 50 ? "#16A34A" : "#E41E20"} />
            )}
          </div>

          <div style={{ textAlign: "right", fontSize: "12px", color: "#9CA3AF", lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              Bazuar në <strong style={{ color: "#6B6B6B" }}>{summary.totalArticles}</strong> artikuj nga{" "}
              <strong style={{ color: "#6B6B6B" }}>{summary.sourceCount}</strong> burime, {summary.daysTracked} ditë histori
            </p>
            {summary.topMover && Math.abs(summary.topMover.delta) >= 3 && (
              <p style={{ margin: "2px 0 0" }}>
                Lëvizja më e madhe: {summary.topMover.flag} {summary.topMover.country}{" "}
                <span style={{ color: summary.topMover.delta > 0 ? "#16A34A" : "#E41E20", fontWeight: 700 }}>
                  {summary.topMover.delta > 0 ? "+" : ""}
                  {summary.topMover.delta}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
          {[
            { color: "#16A34A", label: "Pozitiv" },
            { color: "#9CA3AF", label: "Neutral" },
            { color: "#E41E20", label: "Kritik" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: item.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B6B6B" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Country rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {summary.countries.map((stat, i) => (
            <div
              key={stat.country}
              onMouseEnter={() => canHover && onRowEnter(stat.country)}
              onMouseLeave={() => canHover && scheduleClose()}
              style={{ cursor: outletData ? "pointer" : "default" }}
            >
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER, ease: EASE }}
                style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 16px)" }}
              >
                <div style={{ width: "90px", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF" }}>{flagToCode(stat.flag)}</span>
                  <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)", fontWeight: 700, color: "#111111", whiteSpace: "nowrap" as const }}>
                    {stat.country}
                  </span>
                </div>

                <div style={{ flex: 1, height: "10px", borderRadius: "100px", overflow: "hidden", display: "flex", background: "#F3F4F6" }}>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER + 0.2, ease: EASE }}
                    style={{ width: `${stat.positive}%`, transformOrigin: "left", background: "#16A34A", height: "100%" }}
                  />
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER + 0.3, ease: EASE }}
                    style={{ width: `${stat.neutral}%`, transformOrigin: "left", background: "#9CA3AF", height: "100%" }}
                  />
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER + 0.4, ease: EASE }}
                    style={{ width: `${stat.negative}%`, transformOrigin: "left", background: "#E41E20", height: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "8px", flexShrink: 0, width: "clamp(72px, 22vw, 120px)", justifyContent: "flex-end", alignItems: "baseline" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#16A34A" }}>{stat.positive}%</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF" }}>{stat.neutral}%</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#E41E20" }}>{stat.negative}%</span>
                </div>
              </motion.div>
              {!stat.confident && (
                <p style={{ margin: "4px 0 0 90px", fontSize: "10px", color: "#B8860B" }}>
                  të dhëna të pakta sot (n={stat.n}) — merren me rezervë
                </p>
              )}
            </div>
          ))}
        </div>

        <p style={{ margin: "18px 0 0", fontSize: "11px", color: "#B4B0A6" }}>
          {summary.lastUpdated && `Përditësuar më ${summary.lastUpdated}. `}
          <a href="/toni#metodologjia" style={{ color: "#9CA3AF", textDecoration: "underline" }}>
            Si e llogarisim →
          </a>
        </p>

        {/* Hover popup panel */}
        <AnimatePresence>
          {hoveredCountry && outletData && popupOutlets.length > 0 && (
            <motion.div
              key="popup"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE } }}
              exit={{ opacity: 0, x: 24, transition: { duration: DUR.fast, ease: "easeIn" } }}
              onMouseEnter={() => canHover && cancelClose()}
              onMouseLeave={() => canHover && scheduleClose()}
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
                  <p style={{ fontSize: "12px", fontWeight: 800, color: "#111111", margin: "0 0 10px" }}>
                    {activeOutletData.name}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeOutletData.articles.map((article, idx2) => (
                      <a
                        key={idx2}
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
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#111111", margin: "0 0 3px", lineHeight: 1.35 }}>
                          {article.title}
                        </p>
                        <p style={{ fontSize: "10px", color: "#9CA3AF", margin: 0 }}>{article.date}</p>
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#6B6B6B", margin: "0 0 12px" }}>
                    Media — {hoveredCountry}
                  </p>
                  {(["positive", "neutral", "negative"] as const).map((sentiment) => {
                    const group = popupOutlets.filter((o) => o.sentiment === sentiment);
                    if (group.length === 0) return null;
                    const meta = SENTIMENT_META[sentiment];
                    return (
                      <div key={sentiment} style={{ marginBottom: "14px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "0 0 6px" }}>
                          {meta.label}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {group.map((outlet) => (
                            <button
                              key={outlet.name}
                              onClick={() => setActiveOutlet({ country: hoveredCountry!, name: outlet.name })}
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
