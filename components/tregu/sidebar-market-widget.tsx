"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { previewBet, type BinarySide } from "@/lib/tregu-client";
import { getCategoryColor } from "@/lib/category-colors";
import { relationScore, MIN_RELATED_SCORE } from "@/lib/related-articles.mjs";

/**
 * The market beside a story — the one place on the article page allowed to
 * ask the reader to do something with their hands.
 *
 * It used to be the category's first market whatever the story said, rendered
 * nothing until its fetch landed (so it popped in and shoved the rail), and sat
 * inside `.tregu-scope`, whose page-level `min-height: 100vh` turned a 200px
 * card into a 760px box with a hole under it.
 *
 * Now it picks the open yes/no market whose question is closest to the story,
 * holds its space with a skeleton while prices load, and is something to play
 * with: the ring reads the price, dragging (or arrowing) along the line shows
 * what the market thought on any day, and choosing PO or JO shows what a stake
 * would win before the reader ever leaves the article.
 *
 * Light, lit by the story's category colour — DESIGN.md records that a dark
 * card on the cream page reads as a hole punched in it. Every number is real:
 * prices from the market's own book, history from its trades and snapshots,
 * payouts from the same LMSR maths the market page uses.
 */

interface MarketRow {
  slug: string;
  question: string;
  description?: string | null;
  status?: string;
  market_type?: string | null;
  q_yes: number;
  q_no: number;
  b: number;
  market_prob: number;
  spark?: number[];
  history?: { created_at: string; probability: number }[];
  closes_at?: string | null;
}

const ARTICLE_CATEGORY_TO_MARKET: Record<string, string> = {
  "Kosovë": "kosove",
  "Shqipëri": "shqiperi",
  "Politikë": "kosove",
  "Siguri": "kosove",
  "Shoqëri": "kosove",
  "Ekonomi": "ekonomi",
  "Sport": "sport",
  "Botë": "bote",
  "Diaspora": "bote",
};

const MONTHS = ["jan", "shk", "mar", "pri", "maj", "qer", "korr", "gush", "sht", "tet", "nën", "dhj"];
const STAKES = [50, 100, 250];
const W = 260;
const H = 56;
const PAD = 5;
const MAX_POINTS = 60;
const YES = "#00A651";
const NO = "#E41E20";
const YES_INK = "#007A3C";
const NO_INK = "#B4181A";

type Point = { t: number | null; p: number };

function isBinary(m: MarketRow): boolean {
  return (
    (m.market_type ?? "binary") === "binary" &&
    (m.status ?? "open") === "open" &&
    [m.q_yes, m.q_no, m.b].every((n) => Number.isFinite(Number(n))) &&
    Number(m.b) > 0
  );
}

/** The market's journey, at most MAX_POINTS long, with dates when known. */
function journey(m: MarketRow): Point[] {
  const history = (m.history ?? [])
    .map((h) => ({ t: Date.parse(h.created_at), p: Number(h.probability) }))
    .filter((h) => Number.isFinite(h.t) && Number.isFinite(h.p));
  const raw: Point[] = history.length >= 3 ? history : (m.spark ?? []).filter(Number.isFinite).map((p) => ({ t: null, p }));
  if (raw.length <= MAX_POINTS) return raw;
  return Array.from({ length: MAX_POINTS }, (_, i) => raw[Math.round((i * (raw.length - 1)) / (MAX_POINTS - 1))]);
}

function shortDate(t: number | null): string | null {
  if (t === null) return null;
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function daysLeft(closesAt?: string | null): number | null {
  if (!closesAt) return null;
  const ms = Date.parse(closesAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

/** Counts up to `target` once, the first time the card is on screen. */
function useCountUp(target: number, ref: React.RefObject<HTMLElement | null>) {
  const [value, setValue] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) {
      setValue(target);
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      done.current = true;
      setValue(target);
      return;
    }
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / 900);
          setValue(target * (1 - Math.pow(1 - k, 4)));
          if (k < 1) frame = requestAnimationFrame(tick);
          else done.current = true;
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, ref]);
  return value;
}

function Skeleton() {
  return (
    <div className="pulse pulse-skeleton" aria-hidden="true">
      <span className="pulse-sk pulse-sk-line" style={{ width: "40%" }} />
      <span className="pulse-sk pulse-sk-line" style={{ width: "92%", height: 14, marginTop: 14 }} />
      <span className="pulse-sk pulse-sk-line" style={{ width: "70%", height: 14 }} />
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16 }}>
        <span className="pulse-sk" style={{ width: 76, height: 76, borderRadius: "50%" }} />
        <span className="pulse-sk" style={{ flex: 1, height: 56, borderRadius: 8 }} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <span className="pulse-sk" style={{ flex: 1, height: 44, borderRadius: 10 }} />
        <span className="pulse-sk" style={{ flex: 1, height: 44, borderRadius: 10 }} />
      </div>
    </div>
  );
}

export default function SidebarMarketWidget({
  articleCategory,
  articleTitle = "",
  articleExcerpt = "",
}: {
  articleCategory: string;
  articleTitle?: string;
  articleExcerpt?: string;
}) {
  const [market, setMarket] = useState<MarketRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrub, setScrub] = useState<number | null>(null);
  const [side, setSide] = useState<BinarySide | null>(null);
  const [stake, setStake] = useState(100);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const accent = getCategoryColor(articleCategory);

  useEffect(() => {
    let live = true;
    const marketCategory = ARTICLE_CATEGORY_TO_MARKET[articleCategory];
    const qs = marketCategory ? `?category=${marketCategory}` : "";
    fetch(`/api/tregu/markets${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        const binary = ((d?.markets ?? []) as MarketRow[]).filter(isBinary);
        // The market closest to the story. In a section Tregu covers, the
        // section's soonest-closing market stands in when none is about this
        // story; elsewhere (Showbiz, Teknologji) the list is every market on
        // the site, so an unrelated one is shown nowhere rather than anywhere.
        const story = { id: "story", slug: "story", title: articleTitle, excerpt: articleExcerpt, category: articleCategory };
        let best: MarketRow | null = marketCategory ? binary[0] ?? null : null;
        let bestScore = marketCategory ? 0 : MIN_RELATED_SCORE - 0.001;
        for (const m of binary) {
          const score = relationScore(story, { id: m.slug, slug: m.slug, title: m.question, excerpt: m.description ?? "", category: articleCategory });
          if (score > bestScore) {
            best = m;
            bestScore = score;
          }
        }
        setMarket(best);
      })
      .catch(() => live && setMarket(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [articleCategory, articleTitle, articleExcerpt]);

  const points = useMemo(() => (market ? journey(market) : []), [market]);
  const prob = market ? Math.max(0, Math.min(1, Number(market.market_prob) || 0)) : 0;
  const shown = scrub !== null && points[scrub] ? points[scrub].p : prob;
  const counted = useCountUp(Math.round(prob * 100), cardRef);
  const pct = scrub !== null ? Math.round(shown * 100) : Math.round(counted);

  const path = useMemo(() => {
    if (points.length < 3) return null;
    const ps = points.map((p) => p.p);
    const min = Math.min(...ps);
    const max = Math.max(...ps);
    const span = max - min || 1;
    const xy = ps.map((p, i) => [(i / (ps.length - 1)) * W, H - PAD - ((p - min) / span) * (H - PAD * 2)] as const);
    return {
      xy,
      line: xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
      area: `M0,${H} ` + xy.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${W},${H} Z`,
    };
  }, [points]);

  if (loading) return <PulseShell><Skeleton /></PulseShell>;
  if (!market) return null;

  const opened = points.length ? points[0].p : null;
  const move = opened === null ? 0 : Math.round((prob - opened) * 100);
  const days = daysLeft(market.closes_at);
  const yesPct = Math.round(prob * 100);
  const noPct = 100 - yesPct;
  const scrubLabel = scrub !== null ? shortDate(points[scrub]?.t ?? null) : null;

  const preview = side ? previewBet({ q_yes: Number(market.q_yes), q_no: Number(market.q_no), b: Number(market.b) }, side, stake) : null;
  const profit = preview && Number.isFinite(preview.shares) ? Math.max(0, preview.shares - stake) : null;

  const R = 32;
  const C = 2 * Math.PI * R;

  const scrubFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setScrub(Math.round(k * (points.length - 1)));
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    const step: ((at: number) => number) | null =
      e.key === "ArrowLeft" ? (at) => Math.max(0, at - 1)
      : e.key === "ArrowRight" ? (at) => Math.min(last, at + 1)
      : e.key === "Home" ? () => 0
      : e.key === "End" ? () => last
      : null;
    if (!step) return;
    e.preventDefault();
    // Functional, so a held arrow key steps once per repeat rather than
    // re-reading a value from before the last render.
    setScrub((prev) => step(prev ?? last));
  };

  return (
    <PulseShell accent={accent}>
      <div ref={cardRef} className="pulse">
        <div className="pulse-top">
          <span className="pulse-brand">
            <span className="pulse-live" aria-hidden="true" />
            383 Tregu
          </span>
          {days !== null && <span className="pulse-days">mbyllet për {days} ditë</span>}
        </div>

        <Link href={`/tregu/${market.slug}`} className="pulse-question">
          {market.question}
        </Link>

        <div className="pulse-reading">
          <div className="pulse-ring" aria-hidden="true">
            <svg viewBox="0 0 80 80" width="76" height="76">
              <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(17,17,17,.08)" strokeWidth="7" />
              <circle
                cx="40" cy="40" r={R} fill="none" stroke={YES} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 40 40)"
                style={{ transition: scrub !== null ? "stroke-dasharray .18s cubic-bezier(.22,1,.36,1)" : undefined }}
              />
            </svg>
            <span className="pulse-ring-value">
              {pct}
              <small>%</small>
            </span>
          </div>
          <div className="pulse-readout">
            <span className="pulse-readout-main">
              {scrubLabel ? <>Më {scrubLabel}</> : <>Gjasat për PO</>}
            </span>
            {scrub === null && move !== 0 && (
              <span className="pulse-move" style={{ color: move > 0 ? YES_INK : NO_INK }}>
                <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" fill="currentColor">
                  {move > 0 ? <path d="M5 1l4 6H1z" /> : <path d="M5 9L1 3h8z" />}
                </svg>
                {Math.abs(move)} pikë që nga hapja
              </span>
            )}
            {scrub !== null && <span className="pulse-move pulse-hint">tërhiq për të parë ditë të tjera</span>}
          </div>
        </div>

        {path && (
          <div
            className="pulse-chart"
            role="slider"
            tabIndex={0}
            aria-label="Historia e gjasave për PO"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
            aria-valuetext={`${scrubLabel ? `${scrubLabel}: ` : ""}${Math.round(shown * 100)}% PO`}
            onPointerMove={scrubFromPointer}
            onPointerDown={scrubFromPointer}
            onPointerLeave={() => setScrub(null)}
            onBlur={() => setScrub(null)}
            onKeyDown={onKey}
          >
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="pulse-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={YES} stopOpacity=".18" />
                  <stop offset="100%" stopColor={YES} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={path.area} fill="url(#pulse-fill)" />
              <path d={path.line} fill="none" stroke={YES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {scrub !== null && path.xy[scrub] && (
                <line x1={path.xy[scrub][0]} x2={path.xy[scrub][0]} y1="0" y2={H} stroke="rgba(17,17,17,.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {scrub !== null && path.xy[scrub] && (
              <span className="pulse-cursor" style={{ left: `${(path.xy[scrub][0] / W) * 100}%`, top: `${(path.xy[scrub][1] / H) * 100}%` }} />
            )}
          </div>
        )}

        <div className="pulse-sides" role="group" aria-label="Zgjidh anën">
          <button type="button" className="pulse-side pulse-yes" aria-pressed={side === "PO"} onClick={() => setSide(side === "PO" ? null : "PO")}>
            <span>PO</span>
            <strong>{yesPct}%</strong>
          </button>
          <button type="button" className="pulse-side pulse-no" aria-pressed={side === "JO"} onClick={() => setSide(side === "JO" ? null : "JO")}>
            <span>JO</span>
            <strong>{noPct}%</strong>
          </button>
        </div>

        {side && (
          <div className="pulse-preview" aria-live="polite">
            <div className="pulse-stakes" role="group" aria-label="Sa monedha">
              {STAKES.map((n) => (
                <button key={n} type="button" aria-pressed={stake === n} onClick={() => setStake(n)}>
                  {n}
                </button>
              ))}
            </div>
            <p>
              Me <strong>{stake} monedha</strong> në {side}, fiton{" "}
              <strong style={{ color: side === "PO" ? YES_INK : NO_INK }}>+{profit === null ? "—" : Math.round(profit)}</strong> nëse del {side}.
            </p>
          </div>
        )}

        <Link href={`/tregu/${market.slug}${side ? `?ana=${side.toLowerCase()}` : ""}`} className="pulse-cta">
          {side ? `Vendos parashikimin për ${side}` : "Hap tregun"}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </Link>
      </div>
    </PulseShell>
  );
}

function PulseShell({ children, accent = "#FF4422" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="pulse-shell" style={{ ["--pulse-accent" as string]: accent }}>
      {children}
      <style>{`
        .pulse-shell { font-family: var(--font-manrope), "Manrope", sans-serif; }
        .pulse {
          position: relative; overflow: hidden; padding: 18px 18px 16px; border-radius: 16px; color: #111;
          background:
            radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--pulse-accent) 16%, transparent), transparent 62%),
            linear-gradient(180deg, #FFFFFF, #FBF8F3);
          border: 1px solid color-mix(in srgb, var(--pulse-accent) 34%, #E8E3DB);
          box-shadow: 0 1px 2px rgba(17,17,17,.05), 0 18px 36px -22px color-mix(in srgb, var(--pulse-accent) 55%, rgba(17,17,17,.4));
        }
        .pulse-top { display: flex; align-items: center; gap: 8px; }
        .pulse-brand { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .pulse-live { width: 7px; height: 7px; border-radius: 50%; background: #3ED484; box-shadow: 0 0 0 3px rgba(62,212,132,.18); }
        .pulse-days { margin-left: auto; font-size: 11.5px; font-weight: 650; color: #6B6B6B; font-variant-numeric: tabular-nums; }
        .pulse-question { display: block; margin-top: 10px; font-size: 15.5px; font-weight: 750; line-height: 1.35; color: #111; text-decoration: none; text-wrap: pretty; }
        @media (hover: hover) and (pointer: fine) { .pulse-question:hover { text-decoration: underline; text-underline-offset: 3px; } }

        .pulse-reading { display: flex; align-items: center; gap: 14px; margin-top: 14px; }
        .pulse-ring { position: relative; width: 76px; height: 76px; flex-shrink: 0; }
        .pulse-ring-value { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
        .pulse-ring-value small { font-size: 11px; font-weight: 800; margin-left: 1px; }
        .pulse-readout { display: grid; gap: 4px; min-width: 0; }
        .pulse-readout-main { font-size: 13px; font-weight: 750; }
        .pulse-move { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .pulse-hint { color: #6B6B6B; font-weight: 600; }

        .pulse-chart { position: relative; margin-top: 12px; cursor: ew-resize; touch-action: pan-y; border-radius: 8px; }
        .pulse-chart:focus-visible { outline: 2px solid #FF4422; outline-offset: 4px; }
        .pulse-chart svg { display: block; overflow: visible; }
        .pulse-cursor {
          position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%;
          background: #fff; border: 2px solid ${YES}; box-shadow: 0 2px 6px rgba(17,17,17,.2); pointer-events: none;
        }

        .pulse-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .pulse-side {
          display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
          min-height: 46px; padding: 0 14px; border-radius: 10px; cursor: pointer; font-family: inherit;
          border: 1.5px solid transparent; transition: background .15s, border-color .15s, transform .15s;
        }
        .pulse-side span { font-size: 13px; font-weight: 800; letter-spacing: .04em; }
        .pulse-side strong { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .pulse-yes { background: rgba(0,166,81,.1); color: ${YES_INK}; }
        .pulse-no { background: rgba(228,30,32,.09); color: ${NO_INK}; }
        .pulse-yes[aria-pressed="true"] { border-color: ${YES}; background: rgba(0,166,81,.16); }
        .pulse-no[aria-pressed="true"] { border-color: ${NO}; background: rgba(228,30,32,.14); }
        .pulse-side, .pulse-stakes button, .pulse-cta { touch-action: manipulation; }
        @media (hover: hover) and (pointer: fine) {
          .pulse-yes:hover { background: rgba(0,166,81,.16); }
          .pulse-no:hover { background: rgba(228,30,32,.14); }
          .pulse-stakes button:hover { border-color: #111; }
        }
        .pulse-side:active { transform: scale(.98); }
        .pulse-side:focus-visible, .pulse-stakes button:focus-visible, .pulse-cta:focus-visible, .pulse-question:focus-visible { outline: 2px solid #FF4422; outline-offset: 2px; }

        .pulse-preview { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(17,17,17,.035); animation: pulse-open .28s cubic-bezier(.22,1,.36,1) both; }
        .pulse-preview p { margin: 10px 0 0; font-size: 13.5px; line-height: 1.45; }
        .pulse-preview strong { font-variant-numeric: tabular-nums; }
        .pulse-stakes { display: flex; gap: 6px; }
        .pulse-stakes button {
          flex: 1; min-height: 34px; border-radius: 8px; border: 1px solid rgba(17,17,17,.12); background: #fff;
          font-weight: 750; font-size: 13px; line-height: 1; font-family: inherit; color: #111; cursor: pointer; font-variant-numeric: tabular-nums;
        }
        .pulse-stakes button[aria-pressed="true"] { background: #111; color: #fff; border-color: #111; }
        @keyframes pulse-open { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

        .pulse-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; min-height: 42px;
          border-radius: 10px; background: #111; color: #fff; text-decoration: none; font-size: 13.5px; font-weight: 750;
          transition: background .15s;
        }
        @media (hover: hover) and (pointer: fine) { .pulse-cta:hover { background: #FF4422; } }

        .pulse-skeleton { min-height: 300px; }
        .pulse-sk { display: block; background: rgba(17,17,17,.07); border-radius: 6px; animation: pulse-sk 1.4s ease-in-out infinite; }
        .pulse-sk-line { height: 11px; margin-top: 8px; }
        @keyframes pulse-sk { 50% { opacity: .55; } }
        @media (prefers-reduced-motion: reduce) {
          .pulse-sk, .pulse-preview { animation: none; }
          .pulse-side, .pulse-cta { transition: none; }
        }
      `}</style>
    </div>
  );
}
