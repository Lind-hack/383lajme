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
import { EASE, DUR } from "@/lib/tokens";
import SectionLabel from "./section-label";
import ToneMap from "./tone/tone-map";
import {
  TONE_COLOR,
  TONE_INK,
  flagToCode,
  toneFill,
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

  // Only countries the scraper has actually resolved. The rest sit behind the
  // per-run classification cap with nothing to say yet, and a row reading "pa
  // të dhëna" is a row spent on absence — ten of sixteen were doing that.
  //
  // Most critical first: a ranked list answers "who is hardest on us" at a
  // glance, which an alphabetical one never does.
  const withData = useMemo(
    () =>
      summary.countries
        .filter((c) => c.index != null)
        .sort((a, b) => (a.index ?? 50) - (b.index ?? 50)),
    [summary.countries]
  );
  const pending = summary.countries.length - withData.length;
  /** The homepage shows a shortlist; the full instrument lives on /toni. */
  const shown = withData.slice(0, 6);

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
  // Averaged over countries that HAVE data. Dividing by all sixteen while ten
  // contribute a structural zero reported "35% neutral" above a chart that was
  // plainly ~93% grey — the lead sentence contradicting the picture under it.
  const neutralShare = withData.length
    ? Math.round(withData.reduce((s, c) => s + c.neutral, 0) / withData.length)
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
          <strong style={{ color: TONE_INK.strong }}>{withData.length}</strong> vende,{" "}
          <strong style={{ color: TONE_INK.strong }}>{neutralShare}%</strong> ishin raportim neutral.
        </p>
        <p style={{ margin: "0 0 20px", fontSize: "13.5px", color: TONE_INK.faint, lineHeight: 1.55 }}>
          {NEUTRAL_IS_NORMAL}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", paddingBottom: "18px", marginBottom: "20px", borderBottom: "1px solid #F0EDE6" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.faint }}>Indeksi</span>
          <span style={{ fontSize: "34px", fontWeight: 800, color: TONE_INK.strong, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{idx ?? "—"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13.5px", fontWeight: 700, color: deltaColor, marginLeft: "auto" }}>
            <DeltaIcon size={15} strokeWidth={2.5} />
            {delta == null ? "e re" : `${delta > 0 ? "+" : ""}${delta} këtë javë`}
          </span>
        </div>

        <ToneMap
          countries={summary.countries.map((c) => ({ code: flagToCode(c.flag), country: c.country, index: c.index }))}
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

        {/* The three-swatch legend is gone: the map's own gradient already runs
            Kritik → Pozitiv one line above and says the same thing. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "18px" }}>
          {shown.map((stat) => {
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

                {/* No bar. At ~93% neutral every country's stack was the same
                    grey stub with a hairline of red — Italy and Serbia were
                    visually identical at 49 and 49. Swatch and number carry it;
                    the full breakdown is on /toni. */}
                <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: TONE_INK.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stat.n} artikuj
                </span>

                <span style={{ display: "flex", alignItems: "center", gap: "9px", flexShrink: 0 }}>
                  <span style={{ fontSize: "17px", fontWeight: 800, color: TONE_INK.strong, fontVariantNumeric: "tabular-nums" }}>{stat.index ?? "—"}</span>
                  <span style={{ fontSize: "12.5px", color: TONE_INK.muted, whiteSpace: "nowrap", width: "clamp(64px, 18vw, 92px)" }}>{toneLabel(stat.index)}</span>
                  <span aria-hidden style={{ width: "14px", height: "14px", borderRadius: "4px", background: toneFill(stat.index), flexShrink: 0 }} />
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

        {/* One line where ten empty rows used to be, and the door to the full
            sixteen-country view instead of cramming it onto a news homepage. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #F0EDE6" }}>
          <span style={{ fontSize: "12.5px", color: TONE_INK.muted }}>
            {withData.length} vende me të dhëna sot
            {pending > 0 && `, ${pending} ende në pritje`}
            {withData.length > shown.length && ` · po shfaqen ${shown.length}`}
          </span>
          <a href="/toni" style={{ marginLeft: "auto", fontSize: "12.5px", fontWeight: 700, color: "#FF4422", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            Të gjitha vendet <ArrowUpRight size={13} strokeWidth={2.2} />
          </a>
        </div>

        <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#B4B0A6" }}>
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
