"use client";

// Homepage module for the media-tone index.
//
// The drill-down used to be a hover-opened panel floating over the card. It
// was unusable: leaving the row started a 180ms close timer, and there was
// dead space between the row and the panel, so the thing you were reaching
// for vanished on the way. No hover-intent corridor fixes that properly on
// touch, so the interaction is now a click that opens an inline section in
// the flow. Nothing to cross, nothing to time out, identical on a phone.
//
// The panel is also the point of the feature, not a footnote. A reader should
// come away knowing what a German paper actually said about Kosovo this week
// — so each article carries its Albanian rendering, the original headline,
// the outlet, and the sentence explaining why it was scored the way it was.

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowLeft, ArrowUpRight, ExternalLink, Quote, MousePointerClick } from "lucide-react";
import { EASE, DUR, STAGGER } from "@/lib/tokens";
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
import type { ToneOutletsData, ToneSummary, ToneArticle } from "@/lib/tone-data";

const META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: TONE_COLOR.positive },
  neutral: { label: "Neutral", color: TONE_COLOR.neutral },
  negative: { label: "Kritik", color: TONE_COLOR.critical },
};

/** Diverging geometry: the axis runs -100..+100, the bar occupies 100 of it,
 *  and neutral straddles the centre so every row shares one zero. */
function divergingOffsets(negative: number, neutral: number) {
  return { left: (100 - negative - neutral / 2) / 2, scale: (v: number) => v / 2 };
}

type FlatArticle = ToneArticle & { outlet: string };

export default function ToneDashboard({ summary }: { summary: ToneSummary }) {
  /** Clicked, and it stays clicked. */
  const [selected, setSelected] = useState<string | null>(null);
  /** Hover is a highlight only — it never opens or closes anything. */
  const [hovered, setHovered] = useState<string | null>(null);
  const [outletData, setOutletData] = useState<ToneOutletsData | null>(null);
  const [everClicked, setEverClicked] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/tone-outlets.json").then((r) => r.json()).then(setOutletData).catch(() => {});
  }, []);

  // Most critical first. A ranked list answers "who is hardest on us" at a
  // glance, which an alphabetical one never does.
  const ranked = useMemo(
    () => [...summary.countries].sort((a, b) => (a.index ?? 50) - (b.index ?? 50)),
    [summary.countries]
  );

  const detail = useMemo(() => {
    if (!selected || !outletData) return null;
    const country = outletData.countries[selected];
    if (!country) return null;
    const articles: FlatArticle[] = country.outlets.flatMap((o) =>
      o.articles.map((a) => ({ ...a, outlet: o.name }))
    );
    // Critical first, then positive, then the neutral bulk: the two ends are
    // what a reader came to see.
    const rank = { negative: 0, positive: 1, neutral: 2, unknown: 3 } as Record<string, number>;
    articles.sort((a, b) => (rank[a.sentiment] ?? 3) - (rank[b.sentiment] ?? 3));
    const stat = summary.countries.find((c) => c.country === selected) ?? null;
    return { articles, stat };
  }, [selected, outletData, summary.countries]);

  function choose(country: string | null) {
    setEverClicked(true);
    setSelected((prev) => (prev === country ? null : country));
  }

  if (!summary.hasData) {
    return (
      <section style={{ marginBottom: "var(--space-section)" }}>
        <SectionLabel label="Toni i Mediave Botërore ndaj Kosovës" marginBottom={20} />
        <div style={{ background: "#FFFFFF", borderRadius: "16px", border: "1px solid #E8E3DB", padding: "32px", fontSize: "14px", color: TONE_INK.muted }}>
          Analiza po ndërtohet — të dhënat e para do të shfaqen pas mbledhjes së parë.
        </div>
      </section>
    );
  }

  const idx = summary.overallIndex;
  const delta = summary.weekDelta;
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor = delta == null || delta === 0 ? TONE_INK.faint : delta > 0 ? TONE_COLOR.positive : TONE_COLOR.critical;
  const neutralShare = ranked.length
    ? Math.round(ranked.reduce((s, c) => s + c.neutral, 0) / ranked.length)
    : 0;
  const active = selected ?? hovered;

  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="Toni i Mediave Botërore ndaj Kosovës"
        marginBottom={20}
        right={
          <a href="/toni" style={{ fontSize: "13px", fontWeight: 700, color: TONE_INK.muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            Analiza e plotë <ArrowUpRight size={14} strokeWidth={2} />
          </a>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: DUR.reveal, ease: EASE }}
        style={{ background: "#FFFFFF", borderRadius: "18px", border: "1px solid #E8E3DB", padding: "clamp(18px, 3vw, 32px)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        <h3 style={{ margin: "0 0 10px", fontSize: "clamp(20px, 2.9vw, 30px)", fontWeight: 800, lineHeight: 1.24, letterSpacing: "-0.02em", color: TONE_INK.strong, textWrap: "balance" }}>
          {verdictSentence(idx)}
        </h3>
        <p style={{ margin: "0 0 6px", fontSize: "15.5px", color: TONE_INK.muted, lineHeight: 1.6 }}>
          Nga <strong style={{ color: TONE_INK.strong }}>{summary.totalArticles}</strong> artikuj në{" "}
          <strong style={{ color: TONE_INK.strong }}>{ranked.length}</strong> vende,{" "}
          <strong style={{ color: TONE_INK.strong }}>{neutralShare}%</strong> ishin raportim neutral.
        </p>
        <p style={{ margin: "0 0 20px", fontSize: "13.5px", color: TONE_INK.faint, lineHeight: 1.55 }}>
          {NEUTRAL_IS_NORMAL}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", paddingBottom: "18px", marginBottom: "20px", borderBottom: "1px solid #F0EDE6" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.faint }}>Indeksi</span>
          <span style={{ fontSize: "34px", fontWeight: 800, color: TONE_INK.strong, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{idx ?? "—"}</span>
          <span style={{ fontSize: "13.5px", color: TONE_INK.faint }}>/ 100 · 50 = i balancuar</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13.5px", fontWeight: 700, color: deltaColor, marginLeft: "auto" }}>
            <DeltaIcon size={15} strokeWidth={2.5} />
            {delta == null ? "e re" : `${delta > 0 ? "+" : ""}${delta} këtë javë`}
          </span>
        </div>

        <ToneMap
          countries={ranked.map((c) => ({ code: flagToCode(c.flag), country: c.country, index: c.index }))}
          active={active}
          selected={selected}
          onHover={setHovered}
          onSelect={choose}
        />

        {/* The affordance. It says what to do, once, and gets out of the way
            the moment the reader does it. */}
        <AnimatePresence>
          {!everClicked && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: DUR.fast } }}
              transition={{ duration: DUR.base, ease: EASE, delay: 0.5 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", margin: "14px 0 0", fontSize: "13.5px", fontWeight: 700, color: "#FF4422" }}
            >
              <motion.span
                aria-hidden
                animate={{ transform: ["translate(0px,0px)", "translate(3px,3px)", "translate(0px,0px)"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ display: "inline-flex" }}
              >
                <MousePointerClick size={16} strokeWidth={2.4} />
              </motion.span>
              Kliko një vend për të parë çfarë shkruan media e tij
            </motion.p>
          )}
        </AnimatePresence>

        <div style={{ display: "flex", gap: "20px", margin: "22px 0 14px", flexWrap: "wrap" }}>
          {(["negative", "neutral", "positive"] as const).map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ width: "11px", height: "11px", borderRadius: "3px", background: META[k].color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: TONE_INK.muted }}>{META[k].label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {ranked.map((stat, i) => {
            const { left, scale } = divergingOffsets(stat.negative, stat.neutral);
            const on = active === stat.country;
            const isOpen = selected === stat.country;
            return (
              <button
                key={stat.country}
                type="button"
                onMouseEnter={() => setHovered(stat.country)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(stat.country)}
                onBlur={() => setHovered(null)}
                onClick={() => choose(stat.country)}
                aria-expanded={isOpen}
                style={{
                  display: "flex", alignItems: "center", gap: "clamp(10px, 2vw, 18px)",
                  width: "100%", textAlign: "left", padding: "9px 10px",
                  border: "1px solid " + (isOpen ? "rgba(17,17,17,0.16)" : "transparent"),
                  borderRadius: "12px", cursor: "pointer",
                  background: isOpen ? "#FAFAF8" : on ? "rgba(17,17,17,0.03)" : "transparent",
                  opacity: active && !on ? 0.55 : 1,
                  transition: "background-color 160ms var(--ease-out), opacity 160ms var(--ease-out), border-color 160ms var(--ease-out)",
                  font: "inherit",
                }}
              >
                <span style={{ width: "clamp(92px, 22vw, 124px)", display: "flex", alignItems: "center", gap: "9px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", color: TONE_INK.faint }}>{flagToCode(stat.flag)}</span>
                  <span style={{ fontSize: "clamp(13px, 2.4vw, 15.5px)", fontWeight: 700, color: TONE_INK.strong, whiteSpace: "nowrap" }}>{stat.country}</span>
                </span>

                <span style={{ flex: 1, position: "relative", height: "20px", minWidth: 0 }}>
                  <span aria-hidden style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: "1px", background: "rgba(17,17,17,0.14)" }} />
                  <span style={{ position: "absolute", inset: 0, display: "flex", borderRadius: "4px", overflow: "hidden" }}>
                    <span style={{ width: `${left}%`, flexShrink: 0 }} />
                    {([["negative", stat.negative], ["neutral", stat.neutral], ["positive", stat.positive]] as const).map(([k, v], si) => (
                      <motion.span
                        key={k}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: DUR.reveal, delay: Math.min(i, 8) * STAGGER + 0.12 + si * 0.05, ease: EASE }}
                        style={{ width: `${scale(v)}%`, background: META[k].color, height: "100%", transformOrigin: k === "negative" ? "right" : "left" }}
                      />
                    ))}
                  </span>
                </span>

                <span style={{ display: "flex", alignItems: "baseline", gap: "8px", flexShrink: 0, width: "clamp(96px, 26vw, 148px)", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: TONE_INK.strong, fontVariantNumeric: "tabular-nums" }}>{stat.index ?? "—"}</span>
                  <span style={{ fontSize: "12px", color: TONE_INK.muted, whiteSpace: "nowrap" }}>{toneLabel(stat.index)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Inline drill-down. Height animates so the page below settles once,
            and the cards stagger in behind it rather than all at once. */}
        <AnimatePresence initial={false}>
          {selected && detail && (
            <motion.div
              key={selected}
              ref={detailRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: DUR.base, ease: EASE } }}
              transition={{ height: { duration: DUR.slow, ease: EASE }, opacity: { duration: DUR.base, ease: EASE, delay: 0.05 } }}
              style={{ overflow: "hidden" }}
            >
              <CountryDetail
                country={selected}
                stat={detail.stat}
                articles={detail.articles}
                onClose={() => setSelected(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <p style={{ margin: "20px 0 0", fontSize: "12px", color: "#B4B0A6" }}>
          {summary.lastUpdated && `Përditësuar më ${summary.lastUpdated}. `}
          <a href="/toni#metodologjia" style={{ color: TONE_INK.faint, textDecoration: "underline" }}>Si e llogarisim →</a>
        </p>
      </motion.div>
    </section>
  );
}

/* ── the drill-down ─────────────────────────────────────────────────────── */

function CountryDetail({
  country,
  stat,
  articles,
  onClose,
}: {
  country: string;
  stat: ToneSummary["countries"][number] | null;
  articles: FlatArticle[];
  onClose: () => void;
}) {
  const counts = articles.reduce<Record<string, number>>((acc, a) => {
    acc[a.sentiment] = (acc[a.sentiment] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ marginTop: "18px", padding: "20px", background: "#FAFAF8", border: "1px solid #E8E3DB", borderRadius: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={onClose}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", border: "1px solid rgba(17,17,17,0.12)", borderRadius: "100px", background: "#FFFFFF", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, color: TONE_INK.muted, font: "inherit" }}
        >
          <ArrowLeft size={13} strokeWidth={2.2} /> Mbyll
        </button>
        <h4 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: TONE_INK.strong, letterSpacing: "-0.01em" }}>
          Çfarë shkruan media në {country}
        </h4>
        {stat && (
          <span style={{ fontSize: "13px", color: TONE_INK.muted }}>
            indeksi <strong style={{ color: TONE_INK.strong, fontVariantNumeric: "tabular-nums" }}>{stat.index ?? "—"}</strong> · {stat.n} artikuj
          </span>
        )}
        <span style={{ display: "flex", gap: "6px", marginLeft: "auto", flexWrap: "wrap" }}>
          {(["negative", "neutral", "positive"] as const).map((k) =>
            counts[k] ? (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "100px", background: "#FFFFFF", border: `1px solid ${META[k].color}`, fontSize: "11.5px", fontWeight: 700, color: TONE_INK.strong }}>
                <span aria-hidden style={{ width: "7px", height: "7px", borderRadius: "50%", background: META[k].color }} />
                {META[k].label} {counts[k]}
              </span>
            ) : null
          )}
        </span>
      </div>

      {articles.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13.5px", color: TONE_INK.muted }}>Ende nuk ka artikuj të ruajtur për këtë vend.</p>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {articles.slice(0, 12).map((a, i) => (
            <motion.a
              key={`${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, transform: "translateY(10px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: DUR.base, ease: EASE, delay: 0.06 + Math.min(i, 10) * 0.035 }}
              style={{
                display: "block", padding: "14px 16px", background: "#FFFFFF",
                border: "1px solid #E8E3DB", borderLeft: `3px solid ${META[a.sentiment]?.color ?? TONE_COLOR.neutral}`,
                borderRadius: "10px", textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 800, color: TONE_INK.strong }}>{a.outlet}</span>
                {a.date && <span style={{ fontSize: "11px", color: TONE_INK.faint }}>· {a.date}</span>}
                <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: META[a.sentiment]?.color ?? TONE_INK.muted, marginLeft: "auto" }}>
                  {META[a.sentiment]?.label ?? "—"}
                </span>
              </div>

              {/* Albanian first — the original is right underneath for anyone
                  who wants to check the rendering. */}
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, lineHeight: 1.4, color: TONE_INK.strong }}>
                {a.albanianTitle || a.title}
              </p>
              {a.albanianTitle && a.albanianTitle !== a.title && (
                <p style={{ margin: "0 0 8px", fontSize: "12px", lineHeight: 1.45, color: TONE_INK.faint, fontStyle: "italic" }}>
                  {a.title}
                </p>
              )}

              {a.reason && (
                <p style={{ margin: "8px 0 0", fontSize: "12.5px", lineHeight: 1.5, color: TONE_INK.muted, display: "flex", gap: "7px", alignItems: "flex-start" }}>
                  {a.isQuote && <Quote size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: "2px", color: TONE_INK.faint }} aria-label="Citim" />}
                  <span>{a.reason}</span>
                </p>
              )}

              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "10px", fontSize: "12px", fontWeight: 700, color: "#FF4422" }}>
                Lexo te {a.outlet} <ExternalLink size={12} strokeWidth={2.2} />
              </span>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
}
