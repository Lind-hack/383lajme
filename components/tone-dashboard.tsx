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
import { TrendingUp, TrendingDown, Minus, ArrowLeft, ArrowUpRight, MousePointerClick, ChevronDown, AlertTriangle } from "lucide-react";
import { EASE, DUR } from "@/lib/tokens";
import SectionLabel from "./section-label";
import ToneMap from "./tone/tone-map";
import ToneArticleCard, { TONE_META as META } from "./tone/tone-article-card";
import Sparkline from "./tone/sparkline";
import {
  TONE_COLOR,
  TONE_INK,
  flagToCode,
  toneFill,
  toneLabel,
  verdictSentence,
  NEUTRAL_IS_SHORT,
  coverageOf,
  formatAge,
} from "@/lib/tone-scale";
import type { ToneOutletsData, ToneSummary, ToneArticle, ToneTopic } from "@/lib/tone-data";

type FlatArticle = ToneArticle & { outlet: string; country?: string; flag?: string };

/** Below this, an index rests on so little of a country's own coverage that
 *  the row has to say so. Matches MIN_CONFIDENT_COVERAGE in tone_scraper.py. */
const THIN_COVERAGE = 0.4;

export default function ToneDashboard({
  summary,
  topics = [],
  variant = "home",
}: {
  summary: ToneSummary;
  /** "home" links out to the full analysis; "page" IS the full analysis, so it
   *  drops the link rather than pointing a reader at where they already are. */
  variant?: "home" | "page";
  /** What the world was writing about, clustered from the headlines. Empty
   *  is a normal state — the row simply doesn't render. */
  topics?: ToneTopic[];
}) {
  /** Clicked, and it stays clicked. */
  const [selected, setSelected] = useState<string | null>(null);
  /** A topic panel and a country panel are mutually exclusive: two open
   *  drill-downs on a phone is a scroll, not a comparison. */
  const [topic, setTopic] = useState<string | null>(null);
  /** Hover is a highlight only — it never opens or closes anything. */
  const [hovered, setHovered] = useState<string | null>(null);
  const [outletData, setOutletData] = useState<ToneOutletsData | null>(null);
  const [everClicked, setEverClicked] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  /**
   * Arriving from search with a destination already chosen.
   *
   * Read from window.location rather than useSearchParams so this page does not
   * need a Suspense boundary it otherwise has no use for. Runs once: after that
   * the reader owns the selection, and re-applying the parameter would fight
   * every click they make.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const country = params.get("vendi");
    const wantedTopic = params.get("tema");
    if (!country && !wantedTopic) return;

    setEverClicked(true);
    if (wantedTopic) {
      setSelected(null);
      setTopic(wantedTopic);
    } else if (country) {
      setTopic(null);
      setSelected(country);
    }
    // Two frames: the panel has to exist before it can be scrolled to.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

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
  /**
   * A shortlist by default, the rest one tap away — in place. Sending the
   * reader to /toni to see country seven was throwing away the position they
   * had just built up on the map.
   */
  const [expanded, setExpanded] = useState(false);
  const SHORTLIST = 6;
  const shown = expanded ? withData : withData.slice(0, SHORTLIST);
  const hiddenCount = withData.length - Math.min(SHORTLIST, withData.length);

  /**
   * The day's two sharpest pieces, across every country: the most critical and
   * the most positive. An index tells a reader the temperature; this tells
   * them what was actually written, which is the thing they came for. Both are
   * one tap from the article itself.
   */
  const notable = useMemo(() => {
    if (!outletData) return null;
    const all: Array<FlatArticle & { country: string }> = [];
    for (const [country, data] of Object.entries(outletData.countries)) {
      for (const o of data.outlets) {
        for (const a of o.articles) all.push({ ...a, outlet: o.name, country });
      }
    }
    // How often each outlet appears at all. A masthead that shows up once in
    // a thousand articles is usually not a newspaper — a Ukrainian shelter
    // site turned up here as the most critical piece of "American" coverage.
    // The blocklist catches the ones we know by name; this catches the long
    // tail, and only for the two most prominent slots, so nothing is discarded
    // from the index itself on a guess.
    const outletFreq = new Map<string, number>();
    for (const a of all) outletFreq.set(a.outlet, (outletFreq.get(a.outlet) ?? 0) + 1);
    const recurring = (a: FlatArticle) => (outletFreq.get(a.outlet) ?? 0) > 1;

    // Preference order, strongest first. An evidence span is what makes one of
    // these worth leading with, and an Albanian rendering is what makes it
    // readable — these two cards are the most prominent thing in the module,
    // and leading a Kosovo homepage with an untranslated German headline is
    // not a lead, it is homework.
    const pick = (s: "negative" | "positive") => {
      const of = (f: (a: FlatArticle) => boolean) => all.filter((a) => a.sentiment === s && f(a))[0];
      return (
        of((a) => Boolean(a.evidence && a.albanianTitle) && recurring(a)) ??
        of((a) => Boolean(a.evidence && a.albanianTitle)) ??
        of((a) => Boolean(a.albanianTitle) && recurring(a)) ??
        of((a) => Boolean(a.albanianTitle)) ??
        of((a) => Boolean(a.evidence)) ??
        of(() => true) ??
        null
      );
    };
    const critical = pick("negative");
    const positive = pick("positive");
    return critical || positive ? { critical, positive } : null;
  }, [outletData]);

  const detail = useMemo(() => {
    if (!selected || !outletData) return null;
    const country = outletData.countries[selected];
    if (!country) return null;
    const flag = summary.countries.find((c) => c.country === selected)?.flag ?? "";
    const all: FlatArticle[] = country.outlets.flatMap((o) =>
      o.articles.map((a) => ({ ...a, outlet: o.name, flag }))
    );
    // Articles the classifier could not read are excluded from the index, so
    // they are excluded from the panel too. Leaving them in filled Suedi's
    // drill-down with 100 rows badged "—" — the system presenting the things
    // it refused to score as though they were results. The count is stated
    // instead, which is the honest version of the same information.
    const articles = all.filter((a) => a.sentiment !== "unknown");
    const unresolved = all.length - articles.length;
    // Critical first, then positive, then the neutral bulk: the two ends are
    // what a reader came to see.
    const rank = { negative: 0, positive: 1, neutral: 2 } as Record<string, number>;
    articles.sort((a, b) => (rank[a.sentiment] ?? 3) - (rank[b.sentiment] ?? 3));
    const stat = summary.countries.find((c) => c.country === selected) ?? null;
    return { articles, stat, unresolved };
  }, [selected, outletData, summary.countries]);

  const openTopic = useMemo(
    () => topics.find((t) => t.label === topic) ?? null,
    [topics, topic]
  );

  /**
   * The two stories the map sheet shows for a country. Non-neutral first —
   * a reader tapping a country wants the sharpest thing said about them, not
   * the third routine dispatch.
   */
  const mapArticlesFor = (country: string): FlatArticle[] => {
    const data = outletData?.countries?.[country];
    if (!data) return [];
    const flag = summary.countries.find((c) => c.country === country)?.flag ?? "";
    const rank: Record<string, number> = { negative: 0, positive: 1, neutral: 2 };
    return data.outlets
      .flatMap((o) => o.articles.map((a) => ({ ...a, outlet: o.name, flag })))
      .filter((a) => a.sentiment !== "unknown")
      .sort((a, b) => (rank[a.sentiment] ?? 3) - (rank[b.sentiment] ?? 3));
  };

  const mapStatsFor = (country: string) => {
    const stat = summary.countries.find((c) => c.country === country);
    return stat ? { flag: stat.flag, n: stat.n, confident: stat.confident } : null;
  };

  /** The sheet's "everything from here" hands off to the inline drill-down. */
  const scrollToDetail = (country: string) => {
    setEverClicked(true);
    setTopic(null);
    setSelected(country);
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  function choose(country: string | null) {
    setEverClicked(true);
    setTopic(null);
    setSelected((prev) => (prev === country ? null : country));
  }

  function chooseTopic(label: string) {
    setEverClicked(true);
    setSelected(null);
    setTopic((prev) => (prev === label ? null : label));
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
          variant === "home" ? (
            <a href="/toni" style={{ fontSize: "13px", fontWeight: 700, color: TONE_INK.muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
              Analiza e plotë <ArrowUpRight size={14} strokeWidth={2} />
            </a>
          ) : null
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: DUR.reveal, ease: EASE }}
        style={{ background: "#FFFFFF", borderRadius: "18px", border: "1px solid #E8E3DB", padding: "clamp(18px, 3vw, 32px)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
      >
        {/* If the scraper stops, everything below is last week's reading. It
            runs nine times a day, so a gap past a day and a half is a failed
            pipeline, not a quiet news period — and silence here would have
            the page presenting stale numbers as today's. */}
        {summary.isStale && (
          <p
            role="status"
            style={{
              display: "flex", alignItems: "flex-start", gap: "9px",
              margin: "0 0 16px", padding: "10px 13px", borderRadius: "10px",
              background: "#FFF6E8", border: "1px solid #F0D9AE",
              fontSize: "13px", lineHeight: 1.5, color: "#7A5310",
            }}
          >
            <AlertTriangle size={15} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden />
            <span>
              Nuk përditësohet prej {formatAge(summary.ageHours)} — numrat janë të mbledhjes së
              fundit{summary.lastUpdated ? `, ${summary.lastUpdated}` : ""}.
            </span>
          </p>
        )}

        {/* On /toni the page masthead already carries this sentence, the
            index and the delta; rendering them here printed the same headline
            twice on one screen. The sparkline goes with them — the full
            analysis leads with the reading, not with a small chart of it. The
            map and the drill-down below are what this component contributes
            to that page. */}
        {variant === "home" && (
          <>
          <h3 style={{ margin: "0 0 10px", fontSize: "clamp(20px, 2.9vw, 30px)", fontWeight: 800, lineHeight: 1.24, letterSpacing: "-0.02em", color: TONE_INK.strong, textWrap: "balance" }}>
            {verdictSentence(idx)}
          </h3>
          {/* One sentence, not two. "95% ishin raportim neutral" followed by a
              separate "a neutral majority is normal" was the same thought split
              across two paragraphs and two type sizes. */}
          <p style={{ margin: "0 0 18px", fontSize: "15.5px", color: TONE_INK.muted, lineHeight: 1.6 }}>
            Nga <strong style={{ color: TONE_INK.strong }}>{summary.totalArticles}</strong> artikuj në{" "}
            <strong style={{ color: TONE_INK.strong }}>{withData.length}</strong> vende,{" "}
            <strong style={{ color: TONE_INK.strong }}>{neutralShare}%</strong> ishin raportim neutral —
            {" "}<span style={{ color: TONE_INK.faint }}>{NEUTRAL_IS_SHORT}</span>
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", paddingBottom: "18px", marginBottom: "20px", borderBottom: "1px solid #F0EDE6" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.faint }}>Indeksi</span>
            <span style={{ fontSize: "34px", fontWeight: 800, color: TONE_INK.strong, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{idx ?? "—"}</span>
            {/* The shape behind the number. The homepage carries no chart, so
                without this the index is a value with no sense of whether it
                has been sitting there or just arrived. */}
            {summary.sparkline.length > 1 && (
              <Sparkline
                points={summary.sparkline.map((p) => p.index)}
                width={92}
                height={26}
                ariaLabel={`Ecuria e indeksit gjatë ${summary.sparkline.length} ditëve të fundit`}
              />
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13.5px", fontWeight: 700, color: deltaColor, marginLeft: "auto" }}>
              <DeltaIcon size={15} strokeWidth={2.5} />
              {delta == null ? "e re" : `${delta > 0 ? "+" : ""}${delta} këtë javë`}
            </span>
          </div>
          </>
        )}

        <ToneMap
          countries={summary.countries.map((c) => ({ code: flagToCode(c.flag), country: c.country, index: c.index, confident: c.confident, n: c.n }))}
          active={active}
          selected={selected}
          onHover={setHovered}
          onSelect={choose}
          articlesFor={mapArticlesFor}
          statsFor={mapStatsFor}
          onExpand={scrollToDetail}
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

        {/* What was actually written today, not just how much of it there was. */}
        {notable && (
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", marginTop: "20px" }}>
            {([["negative", notable.critical], ["positive", notable.positive]] as const).map(
              ([kind, a]) =>
                a && (
                  <a
                    key={kind}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block", padding: "11px 13px", textDecoration: "none",
                      background: "#FFFFFF", border: "1px solid #E8E3DB",
                      borderTop: `3px solid ${META[kind].color}`, borderRadius: "10px",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: META[kind].color }}>
                        {kind === "negative" ? "Më kritiku" : "Më pozitivi"}
                        {!summary.isStale && " sot"}
                      </span>
                      <span style={{ fontSize: "11px", color: TONE_INK.faint }}>
                        {a.outlet} · {a.country}
                      </span>
                    </span>
                    {/* Clamped: these are an entry point, not the article. Two
                        lines of headline and one of quotation is enough to
                        decide whether to open it, and keeps the pair from
                        costing a third of a phone screen. */}
                    <p style={{
                      margin: "0 0 5px", fontSize: "clamp(13px, 2.6vw, 14.5px)", fontWeight: 700,
                      lineHeight: 1.35, color: TONE_INK.strong,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {a.albanianTitle || a.title}
                    </p>
                    {a.evidence && (
                      <p style={{
                        margin: 0, fontSize: "12px", fontStyle: "italic", color: TONE_INK.muted, lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        «{a.evidence}»
                      </p>
                    )}
                  </a>
                )
            )}
          </div>
        )}

        {/* WHAT the world wrote about, next to how it sounded. The index alone
            answers half the question a reader has; until now the other half —
            the subject — was nowhere on the page. Clustered from the Albanian
            headlines we already store, so it costs no API call.

            A chip row, not a section: the module is at 1.48 viewports on a
            phone and the budget is 1.6. The articles are one tap away and
            cost nothing until then. */}
        {topics.length > 0 && (
          <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #F0EDE6" }}>
            <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.faint }}>
              Për çfarë po shkruajnë
            </p>
            <div className="toni-chips">
              {topics.map((t) => {
                const on = topic === t.label;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => chooseTopic(t.label)}
                    aria-expanded={on}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "7px",
                      padding: "7px 12px", borderRadius: "100px", cursor: "pointer",
                      font: "inherit", fontSize: "12.5px", fontWeight: 700,
                      color: TONE_INK.strong,
                      background: on ? "#FAFAF8" : "#FFFFFF",
                      border: "1px solid " + (on ? "rgba(17,17,17,0.22)" : "#E8E3DB"),
                      transition: "background-color 160ms var(--ease-out), border-color 160ms var(--ease-out)",
                    }}
                  >
                    {/* The topic's own tone, on the same scale as a country's.
                        Grey here is the honest answer for most subjects. */}
                    <span aria-hidden style={{ width: "8px", height: "8px", borderRadius: "50%", background: toneFill(t.index), flexShrink: 0 }} />
                    {t.label}
                    <span style={{ fontSize: "11.5px", fontWeight: 600, color: TONE_INK.faint, fontVariantNumeric: "tabular-nums" }}>{t.count}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {openTopic && (
                <motion.div
                  key={openTopic.label}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, transition: { duration: DUR.base, ease: EASE } }}
                  transition={{ height: { duration: DUR.slow, ease: EASE }, opacity: { duration: DUR.base, ease: EASE, delay: 0.05 } }}
                  style={{ overflow: "hidden" }}
                >
                  <TopicDetail topic={openTopic} onClose={() => setTopic(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* The three-swatch legend is gone: the map's own gradient already runs
            Kritik → Pozitiv one line above and says the same thing. */}
        <div
          className={`toni-rows${expanded ? "" : " toni-rows--short"}`}
          style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "18px" }}
        >
          {shown.map((stat, i) => {
            const on = active === stat.country;
            const isOpen = selected === stat.country;
            // Rows past the shortlist fade in when the list opens; the first
            // six are already on screen and must not re-animate.
            const revealed = i >= SHORTLIST;
            return (
              <motion.button
                key={stat.country}
                type="button"
                initial={revealed ? { opacity: 0, transform: "translateY(-6px)" } : false}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: DUR.base, ease: EASE, delay: revealed ? (i - SHORTLIST) * 0.035 : 0 }}
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
                {/* 82px, not 92: at 390px the row is 304px wide and the two
                    fixed columns left the article count 47px against the 50 it
                    needs, so "17 artikuj" ellipsised to "17 arti...". */}
                <span style={{ width: "clamp(82px, 22vw, 124px)", display: "flex", alignItems: "center", gap: "9px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", color: TONE_INK.faint }}>{flagToCode(stat.flag)}</span>
                  <span style={{ fontSize: "clamp(13px, 2.4vw, 15.5px)", fontWeight: 700, color: TONE_INK.strong, whiteSpace: "nowrap" }}>{stat.country}</span>
                </span>

                {/* No bar. At ~93% neutral every country's stack was the same
                    grey stub with a hairline of red — Italy and Serbia were
                    visually identical at 49 and 49. Swatch and number carry it;
                    the full breakdown is on /toni. */}
                {/* What the number rests on, stated where the number is. A
                    country whose index was built from 5 of its 79 articles
                    was rendering identically to one built from 175 of 175. */}
                <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: TONE_INK.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {coverageOf(stat) < THIN_COVERAGE && stat.excluded
                    ? `${stat.n} nga ${stat.n + stat.excluded} artikuj`
                    : `${stat.n} artikuj`}
                </span>

                <span style={{ display: "flex", alignItems: "center", gap: "9px", flexShrink: 0 }}>
                  <span style={{ fontSize: "17px", fontWeight: 800, color: TONE_INK.strong, fontVariantNumeric: "tabular-nums" }}>{stat.index ?? "—"}</span>
                  <span style={{ fontSize: "12.5px", color: TONE_INK.muted, whiteSpace: "nowrap", width: "clamp(56px, 18vw, 92px)" }}>{toneLabel(stat.index)}</span>
                  <span aria-hidden style={{ width: "14px", height: "14px", borderRadius: "4px", background: toneFill(stat.index), flexShrink: 0 }} />
                </span>
              </motion.button>
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
                unresolved={detail.unresolved}
                onClose={() => setSelected(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* One line where ten empty rows used to be. The rest of the countries
            open here rather than on another page — a reader who has just
            oriented themselves on the map should not lose that to a navigation. */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #F0EDE6" }}>
          <span style={{ fontSize: "12.5px", color: TONE_INK.muted }}>
            {withData.length} vende me të dhëna{!summary.isStale && " sot"}
            {pending > 0 && `, ${pending} ende në pritje`}
          </span>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={{
                marginLeft: "auto", padding: "7px 14px", borderRadius: "100px",
                border: "1px solid rgba(255,68,34,0.35)", background: "#FFFFFF",
                cursor: "pointer", font: "inherit", fontSize: "12.5px",
                fontWeight: 700, color: "#FF4422",
                display: "inline-flex", alignItems: "center", gap: "6px",
                transition: "background-color 160ms var(--ease-out)",
              }}
            >
              {expanded ? "Trego më pak" : `Të gjitha vendet (${withData.length})`}
              <motion.span
                aria-hidden
                animate={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                transition={{ duration: DUR.base, ease: EASE }}
                style={{ display: "inline-flex" }}
              >
                <ChevronDown size={14} strokeWidth={2.4} />
              </motion.span>
            </button>
          )}
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
  unresolved,
  onClose,
}: {
  country: string;
  stat: ToneSummary["countries"][number] | null;
  articles: FlatArticle[];
  /** Articles the classifier could not read. Named, not shown. */
  unresolved: number;
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
            <ArticleCard key={`${a.url}-${i}`} a={a} i={i} />
          ))}
        </div>
      )}

      {unresolved > 0 && (
        <p style={{ margin: "12px 0 0", fontSize: "12px", color: TONE_INK.faint, lineHeight: 1.5 }}>
          Edhe {unresolved} artikuj u mblodhën për këtë vend, por modeli nuk arriti t&apos;i
          lexojë me siguri — nuk llogariten dhe nuk shfaqen.
        </p>
      )}
    </div>
  );
}

/* ── one topic, and what was written under it ───────────────────────────── */

/**
 * Deliberately the same panel as a country's, down to the card. A reader who
 * has learned what a drill-down looks like once should not have to learn it
 * again because the axis changed from place to subject.
 */
function TopicDetail({ topic, onClose }: { topic: ToneTopic; onClose: () => void }) {
  const countries = topic.countries ?? [...new Set(topic.articles.map((a) => a.country))];

  return (
    <div style={{ marginTop: "14px", padding: "18px", background: "#FAFAF8", border: "1px solid #E8E3DB", borderRadius: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <button
          type="button"
          onClick={onClose}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", border: "1px solid rgba(17,17,17,0.12)", borderRadius: "100px", background: "#FFFFFF", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, color: TONE_INK.muted, font: "inherit" }}
        >
          <ArrowLeft size={13} strokeWidth={2.2} /> Mbyll
        </button>
        <h4 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: TONE_INK.strong, letterSpacing: "-0.01em" }}>
          {topic.label}
        </h4>
        <span style={{ fontSize: "13px", color: TONE_INK.muted }}>
          {topic.count} artikuj në {countries.length} {countries.length === 1 ? "vend" : "vende"} · toni{" "}
          <strong style={{ color: TONE_INK.strong }}>{toneLabel(topic.index).toLowerCase()}</strong>
        </span>
        <span aria-hidden style={{ width: "14px", height: "14px", borderRadius: "4px", background: toneFill(topic.index), marginLeft: "auto", flexShrink: 0 }} />
      </div>

      {/* What is actually going on, in one sentence. Written from the
          cluster's own headlines, so it says something the label cannot. */}
      {topic.summary && (
        <p style={{ margin: "0 0 14px", fontSize: "14px", lineHeight: 1.55, color: TONE_INK.muted, maxWidth: "70ch" }}>
          {topic.summary}
        </p>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {topic.articles.map((a, i) => (
          <ArticleCard key={`${a.url}-${i}`} a={a} i={i} />
        ))}
      </div>
    </div>
  );
}

/* ── the card both panels are built from ────────────────────────────────── */

/**
 * The card itself lives in components/tone/tone-article-card.tsx, motion-free,
 * so /toni can server-render the identical thing. All that is added here is
 * the stagger.
 */
function ArticleCard({ a, i }: { a: FlatArticle; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(10px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: DUR.base, ease: EASE, delay: 0.06 + Math.min(i, 10) * 0.035 }}
    >
      <ToneArticleCard a={a} />
    </motion.div>
  );
}
