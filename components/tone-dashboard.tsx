"use client";

// Homepage module for the media-tone index.
//
// It used to lead with "40" over five left-aligned stacked bars — fifteen
// percentages competing for one glance, above a number with nothing to anchor
// it. Three changes, in order of how much they matter:
//
//   1. A sentence leads. The number is support. "40" answers nothing alone.
//   2. The bars are diverging, centred on neutral, which is the correct form
//      for ordered sentiment data: critical grows left of a shared centre
//      line, positive grows right, so "who is more critical" is one look
//      instead of five subtractions.
//   3. An inset map, because a country's shape is recognised instantly and
//      "DE" is not.

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, X, ArrowLeft, ArrowUpRight } from "lucide-react";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
import { useCanHover } from "@/hooks/use-can-hover";
import SectionLabel from "./section-label";
import ToneMap from "./tone/tone-map";
import {
  TONE_COLOR,
  TONE_INK,
  flagToCode,
  toneLabel,
  verdictSentence,
  NEUTRAL_IS_NORMAL,
} from "@/lib/tone-scale";
import type { ToneOutletsData, ToneSummary } from "@/lib/tone-data";

const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: TONE_COLOR.positive },
  neutral: { label: "Neutral", color: TONE_COLOR.neutral },
  negative: { label: "Kritik", color: TONE_COLOR.critical },
};

/** Diverging geometry: the axis runs -100..+100, the bar occupies 100 of it,
 *  and neutral straddles the centre so every row shares one zero. */
function divergingOffsets(negative: number, neutral: number) {
  return {
    left: (100 - negative - neutral / 2) / 2,
    scale: (v: number) => v / 2,
  };
}

export default function ToneDashboard({ summary }: { summary: ToneSummary }) {
  const canHover = useCanHover();
  const [active, setActive] = useState<string | null>(null);
  const [activeOutlet, setActiveOutlet] = useState<{ country: string; name: string } | null>(null);
  const [outletData, setOutletData] = useState<ToneOutletsData | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/tone-outlets.json")
      .then((r) => r.json())
      .then(setOutletData)
      .catch(() => {});
  }, []);

  function open(country: string | null) {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setActive(country);
    if (country === null) setActiveOutlet(null);
  }

  function scheduleClose() {
    leaveTimer.current = setTimeout(() => {
      setActive(null);
      setActiveOutlet(null);
    }, 180);
  }

  function cancelClose() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }

  const popupOutlets = active && outletData ? outletData.countries[active]?.outlets ?? [] : [];
  const activeOutletData =
    activeOutlet && outletData
      ? outletData.countries[activeOutlet.country]?.outlets.find((o) => o.name === activeOutlet.name) ?? null
      : null;

  if (!summary.hasData) {
    return (
      <section style={{ marginBottom: "var(--space-section)" }}>
        <SectionLabel label="Toni i Mediave Botërore ndaj Kosovës" marginBottom={20} />
        <div style={{ background: "#FFFFFF", borderRadius: "16px", border: "1px solid #E8E3DB", padding: "32px", fontSize: "13.5px", color: TONE_INK.muted }}>
          Analiza po ndërtohet — te dhënat e para do të shfaqen pas mbledhjes ditore të parë.
        </div>
      </section>
    );
  }

  const idx = summary.overallIndex;
  const delta = summary.weekDelta;
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delta == null || delta === 0 ? TONE_INK.faint : delta > 0 ? TONE_COLOR.positive : TONE_COLOR.critical;

  const mapCountries = summary.countries.map((c) => ({
    code: flagToCode(c.flag),
    country: c.country,
    index: c.index,
  }));
  const neutralShare = summary.countries.length
    ? Math.round(summary.countries.reduce((s, c) => s + c.neutral, 0) / summary.countries.length)
    : 0;

  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="Toni i Mediave Botërore ndaj Kosovës"
        marginBottom={20}
        right={
          <a href="/toni" style={{ fontSize: "12px", fontWeight: 700, color: TONE_INK.muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            Analiza e plotë <ArrowUpRight size={13} strokeWidth={2} />
          </a>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: DUR.reveal, ease: EASE }}
        style={{ background: "#FFFFFF", borderRadius: "16px", border: "1px solid #E8E3DB", padding: "clamp(16px, 3vw, 26px)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}
      >
        {/* The lead. A sentence a reader finishes understanding. */}
        <h3 style={{ margin: "0 0 8px", fontSize: "clamp(17px, 2.4vw, 21px)", fontWeight: 800, lineHeight: 1.3, letterSpacing: "-0.02em", color: TONE_INK.strong, textWrap: "balance" }}>
          {verdictSentence(idx)}
        </h3>
        <p style={{ margin: "0 0 4px", fontSize: "13.5px", color: TONE_INK.muted, lineHeight: 1.55 }}>
          Nga <strong style={{ color: TONE_INK.strong }}>{summary.totalArticles}</strong> artikuj në{" "}
          <strong style={{ color: TONE_INK.strong }}>{summary.countries.length}</strong> vende,{" "}
          <strong style={{ color: TONE_INK.strong }}>{neutralShare}%</strong> ishin raportim neutral.
        </p>
        <p style={{ margin: "0 0 18px", fontSize: "12px", color: TONE_INK.faint, lineHeight: 1.5 }}>
          {NEUTRAL_IS_NORMAL}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", paddingBottom: "16px", marginBottom: "18px", borderBottom: "1px solid #F0EDE6" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.faint }}>
            Indeksi
          </span>
          <span style={{ fontSize: "26px", fontWeight: 800, color: TONE_INK.strong, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {idx ?? "—"}
          </span>
          <span style={{ fontSize: "12px", color: TONE_INK.faint }}>/ 100 · 50 = i balancuar</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12.5px", fontWeight: 700, color: deltaColor, marginLeft: "auto" }}>
            <DeltaIcon size={14} strokeWidth={2.5} />
            {delta == null ? "e re" : `${delta > 0 ? "+" : ""}${delta} këtë javë`}
          </span>
        </div>

        <ToneMap countries={mapCountries} active={active} onActivate={(c) => (c ? open(c) : setActive(null))} />

        <div style={{ display: "flex", gap: "18px", margin: "20px 0 12px", flexWrap: "wrap" }}>
          {(["negative", "neutral", "positive"] as const).map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: SENTIMENT_META[k].color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: TONE_INK.muted }}>{SENTIMENT_META[k].label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {summary.countries.map((stat, i) => {
            const { left, scale } = divergingOffsets(stat.negative, stat.neutral);
            const on = active === stat.country;
            return (
              <div
                key={stat.country}
                onMouseEnter={() => canHover && open(stat.country)}
                onMouseLeave={() => canHover && scheduleClose()}
                onClick={() => open(on ? null : stat.country)}
                style={{ cursor: outletData ? "pointer" : "default", opacity: active && !on ? 0.5 : 1, transition: "opacity 160ms var(--ease-out)" }}
              >
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER, ease: EASE }}
                  style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 14px)" }}
                >
                  <div style={{ width: "clamp(74px, 20vw, 96px)", display: "flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: TONE_INK.faint }}>{flagToCode(stat.flag)}</span>
                    <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)", fontWeight: 700, color: TONE_INK.strong, whiteSpace: "nowrap" }}>{stat.country}</span>
                  </div>

                  {/* Diverging track. The centre line is the shared zero every
                      row is read against. */}
                  <div style={{ flex: 1, position: "relative", height: "14px", minWidth: 0 }}>
                    <span aria-hidden style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: "1px", background: "rgba(17,17,17,0.14)" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                      <span style={{ width: `${left}%`, flexShrink: 0 }} />
                      {([["negative", stat.negative], ["neutral", stat.neutral], ["positive", stat.positive]] as const).map(([k, v], si) => (
                        <motion.span
                          key={k}
                          initial={{ scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: DUR.reveal, delay: Math.min(i, 6) * STAGGER + 0.15 + si * 0.06, ease: EASE }}
                          style={{
                            width: `${scale(v)}%`,
                            background: SENTIMENT_META[k].color,
                            height: "100%",
                            transformOrigin: k === "negative" ? "right" : "left",
                            // 2px of surface between segments, so adjacent
                            // fills read as two marks and not one blend.
                            boxShadow: "0 0 0 0.5px #FFFFFF inset",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Values wear ink, not the series colour — the swatch in the
                      legend carries identity, the number carries the value. */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexShrink: 0, width: "clamp(84px, 24vw, 116px)", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: TONE_INK.strong, fontVariantNumeric: "tabular-nums" }}>{stat.index ?? "—"}</span>
                    <span style={{ fontSize: "10.5px", color: TONE_INK.muted, whiteSpace: "nowrap" }}>{toneLabel(stat.index)}</span>
                  </div>
                </motion.div>
                {!stat.confident && (
                  <p style={{ margin: "4px 0 0 clamp(74px, 20vw, 96px)", fontSize: "10px", color: "#B8860B" }}>
                    të dhëna të pakta sot (n={stat.n}) — merren me rezervë
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ margin: "18px 0 0", fontSize: "11px", color: "#B4B0A6" }}>
          {summary.lastUpdated && `Përditësuar më ${summary.lastUpdated}. `}
          <a href="/toni#metodologjia" style={{ color: TONE_INK.faint, textDecoration: "underline" }}>
            Si e llogarisim →
          </a>
        </p>

        <AnimatePresence>
          {active && outletData && popupOutlets.length > 0 && (
            <motion.div
              key="popup"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE } }}
              exit={{ opacity: 0, x: 24, transition: { duration: DUR.fast, ease: "easeIn" } }}
              onMouseEnter={() => canHover && cancelClose()}
              onMouseLeave={() => canHover && scheduleClose()}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "clamp(230px, 42%, 300px)", background: "#FAFAF8", borderLeft: "1px solid #E8E3DB", borderRadius: "0 16px 16px 0", padding: "16px", overflowY: "auto", zIndex: 20, boxShadow: "-6px 0 20px rgba(0,0,0,0.07)" }}
            >
              <button
                onClick={() => open(null)}
                aria-label="Mbyll"
                style={{ position: "absolute", top: "10px", right: "10px", width: "22px", height: "22px", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: TONE_INK.muted, padding: 0 }}
              >
                <X size={12} strokeWidth={2} />
              </button>

              {activeOutletData ? (
                <>
                  <button onClick={() => setActiveOutlet(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: TONE_INK.muted, marginBottom: "10px", padding: 0 }}>
                    <ArrowLeft size={12} strokeWidth={2} /> Kthehu
                  </button>
                  <p style={{ fontSize: "12px", fontWeight: 800, color: TONE_INK.strong, margin: "0 0 10px" }}>{activeOutletData.name}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeOutletData.articles.map((article, k) => {
                      // Why this article was labelled what it was. The single
                      // biggest reason to trust the number, and nearly free
                      // now the classifier has to justify itself.
                      const why = (article as { reason?: string }).reason;
                      const quoted = (article as { isQuote?: boolean }).isQuote;
                      return (
                        <a key={k} href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "8px 10px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E8E3DB", textDecoration: "none" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: TONE_INK.strong, margin: "0 0 3px", lineHeight: 1.35 }}>{article.title}</p>
                          {why && (
                            <p style={{ fontSize: "10px", color: TONE_INK.muted, margin: "0 0 2px", lineHeight: 1.4 }}>
                              {quoted ? "Citim — " : ""}{why}
                            </p>
                          )}
                          <p style={{ fontSize: "10px", color: TONE_INK.faint, margin: 0 }}>{article.date}</p>
                        </a>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.muted, margin: "0 0 12px" }}>Media — {active}</p>
                  {(["positive", "neutral", "negative"] as const).map((sentiment) => {
                    const group = popupOutlets.filter((o) => o.sentiment === sentiment);
                    if (group.length === 0) return null;
                    const meta = SENTIMENT_META[sentiment];
                    return (
                      <div key={sentiment} style={{ marginBottom: "14px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 6px" }}>{meta.label}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {group.map((outlet) => (
                            <button key={outlet.name} onClick={() => setActiveOutlet({ country: active, name: outlet.name })} style={{ padding: "4px 10px", borderRadius: "100px", border: `1px solid ${meta.color}`, background: "transparent", fontSize: "11px", fontWeight: 600, color: meta.color, cursor: "pointer" }}>
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
