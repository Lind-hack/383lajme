"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

import F1TopThree, { topThreeDrivers, type F1TopThreeDriver } from "@/components/tregu/f1-top-three";
import { f1TeamColor } from "@/lib/f1-driver-presentation";
import type { MiniMarket } from "./market-mini-card";
import { fmtNum } from "@/lib/format";
import { getCategoryColor } from "@/lib/category-colors";
import { normalizeCategory } from "@/lib/category-map";
import ExactMarketChart, { type ExactMarketSeries } from "./exact-market-chart";
import MarketContextMedia from "./market-context-media";
import SportBrandMark from "./sport-brand-mark";
import CompetitionArtwork from "./competition-artwork";
import { sportBrandFor } from "@/lib/tregu-sport-branding";
import { outcomeColor, toExactSeries } from "@/lib/tregu-hub-market.mjs";

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

const INTERVAL_MS = 7000;

function closeLabel(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Mbyllet për ${days} ditë`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Mbyllet për ${hours} orë`;
  return `Mbyllet për ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function shortLeft(iso?: string): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

function Slide({ market, active }: { market: MiniMarket; active: boolean }) {
  const router = useRouter();
  const pct = Math.round(Math.max(0, Math.min(1, market.prob)) * 100);
  const noPct = 100 - pct;
  const yesMult = pct >= 1 ? (100 / pct).toFixed(2) : null;
  const noMult = noPct >= 1 ? (100 / noPct).toFixed(2) : null;
  const remaining = closeLabel(market.closesAt);
  const deltaPp = market.delta7d != null ? Math.round(market.delta7d * 100) : null;
  const dir: "up" | "down" | "flat" =
    deltaPp != null && deltaPp > 0 ? "up" : deltaPp != null && deltaPp < 0 ? "down" : "flat";
  const structured =
    (market.marketType === "two_outcome" || market.marketType === "three_outcome") &&
    (market.sportOutcomes?.length ?? 0) >= 2 &&
    Boolean(market.outcomeProbabilities);
  const isChampionship = market.marketType === "f1_race_winner" && market.eventKind === "championship";
  const isF1 = market.marketType === "f1_race_winner" || market.league === "f1" || /\bF1\b|Çmimin e Madh/i.test(market.question);
  const championshipDrivers = isChampionship
    ? (market.sportOutcomes ?? [])
        .map((driver) => ({ ...driver, probability: Number(market.outcomeProbabilities?.[driver.key] ?? 0) }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)
    : [];
  // Both F1 card kinds show the same three-row rack. The championship rows earn
  // their second line with points and the gap to the leader; a race has neither
  // yet, so the row names the constructor instead.
  const f1Top3: F1TopThreeDriver[] = isChampionship
    ? championshipDrivers.map((driver) => ({
        key: driver.key,
        label: driver.label,
        team: driver.team ?? null,
        team_colour: driver.team_colour ?? null,
        headshot_url: driver.headshot_url ?? null,
        probability: driver.probability,
        meta: `${driver.championship_points ?? 0} pikë · ${driver.gap_to_leader ? `−${driver.gap_to_leader} nga kreu` : "kryeson"}`,
      }))
    : isF1
      ? topThreeDrivers(market.sportOutcomes as unknown as Array<Record<string, unknown>>, market.outcomeProbabilities ?? null)
          // During a race the second line says why the price moved — the gap,
          // the stops, an undercut in progress — and falls back to the team.
          .map((driver) => ({ ...driver, meta: market.f1Insights?.[driver.key] ?? driver.team ?? null }))
      : [];
  const lapsLeft = isF1 && !isChampionship && Number.isFinite(market.lapsLeft) ? Number(market.lapsLeft) : null;

  // A race is not a yes/no question, and charting it as one drew a single flat
  // "Gjasa PO 50%" line that answered nothing: the market has twenty-two
  // outcomes and the reader wants to know whose. Championship cards already
  // charted their drivers; races fell through to the binary branch purely
  // because market_type is f1_race_winner rather than two/three_outcome.
  const f1Chart = isF1 && f1Top3.length >= 2;
  const chartSeries: ExactMarketSeries[] = f1Chart
    ? f1Top3.map((driver, index) => ({
        key: driver.key,
        label: driver.label,
        // The constructor's colour, the same source the rack below uses. The
        // generic outcome palette gave Leclerc and Antonelli the identical red,
        // so two of the three lines were indistinguishable and neither matched
        // the driver's own row a few pixels away.
        color: f1TeamColor(driver.team ?? "", driver.team_colour ?? undefined),
        current: driver.probability,
        points: toExactSeries(market.outcomeHistory?.[driver.key]),
      }))
    : structured
    ? (market.sportOutcomes ?? []).map((outcome, index) => ({
        key: outcome.key,
        label: outcome.label,
        color: outcomeColor(outcome, index),
        current: Number(market.outcomeProbabilities?.[outcome.key] ?? 1 / (market.sportOutcomes?.length ?? 2)),
        points: toExactSeries(market.outcomeHistory?.[outcome.key]),
      }))
    : [{
        key: "po",
        label: "PO",
        color: "#00854A",
        current: market.prob,
        points: toExactSeries(market.history),
      }];
  const leader = [...chartSeries].sort((a, b) => b.current - a.current)[0];
  const hasHistory = chartSeries.some((series) => series.points.length >= 2);
  // Binary books show both sides; the chart's single PO line would hide JO.
  const boardRows = structured || f1Chart
    ? chartSeries.slice(0, 3)
    : [
        { key: "po", label: "PO", color: "#00A651", current: market.prob },
        { key: "jo", label: "JO", color: "#E41E20", current: 1 - market.prob },
      ];

  const goToSide = (e: React.MouseEvent, side: "PO" | "JO") => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${market.slug}?ana=${side.toLowerCase()}`);
  };

  // The whole card opens the market. The hit link underneath only answers where
  // nothing sits over it, and on the F1 and competition slides the content is
  // lifted above their artwork, so the rack, the chart and the stats swallowed
  // the click and only the driver names worked. Links and buttons inside keep
  // their own targets; a drag that selected text is not a click.
  const openMarket = (e: React.MouseEvent) => {
    if (e.defaultPrevented || (e.target as Element).closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    const href = `/tregu/${market.slug}`;
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <article
      className={`tregu-car-slide-link${isChampionship ? " tregu-championship-card" : ""}`}
      data-championship={isChampionship ? "" : undefined}
      data-f1={isF1 ? "" : undefined}
      data-category={market.category}
      /* The competition treatments (Champions, Europa, Conference, Nations,
         basketball) were only ever wired to the floor cards. A market big
         enough to lead the floor is exactly the one that should carry its
         competition's identity, so the slide publishes the same attribute and
         renders the same artwork. */
      data-competition={market.league ?? undefined}
      onClick={openMarket}
      /* The slide publishes its own category colour so the flagship slot can be
         lit by whatever it happens to be showing, without the palette being
         written down a second time in CSS. */
      style={{ textDecoration: "none", color: "#111111", /* A competition outranks the category for the light on the card: a
           Champions night is blue because it is Champions, not because it is
           filed under Sport. */
        "--feature-accent": sportBrandFor(market.league)?.accent ?? getCategoryColor(normalizeCategory(market.category)) } as CSSProperties}
    >
      <Link
        href={`/tregu/${market.slug}`}
        className="tregu-car-slide-hit"
        tabIndex={active ? 0 : -1}
        aria-label={`Hap tregun: ${market.question}`}
        draggable={false}
      />
      <CompetitionArtwork league={market.league} />
      <div className="tregu-feature-grid" data-structured={structured || isChampionship || undefined}>
        {/* ── The proposition ── */}
        <div className="tregu-feature-main">
          <div className="tregu-feature-head">
            {isChampionship ? (
              <span className="tregu-championship-card-head">
                <span className="tregu-championship-mark" aria-hidden><Trophy size={20} strokeWidth={2.2} /></span>
                <span>Formula 1 · Kampionati</span>
              </span>
            ) : (market.league === "f1" || /\bF1\b|Çmimin e Madh/i.test(market.question)) && (
              <SportBrandMark brandKey="f1" size="sm" />
            )}
            {market.league && market.league !== "f1" && <SportBrandMark brandKey={market.league} size="sm" />}
            <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
            {lapsLeft != null ? (
              <span className="tregu-f1-laps-left">
                <i aria-hidden />
                {lapsLeft === 0 ? "Gara përfundoi" : lapsLeft === 1 ? "Xhiroja e fundit" : `${lapsLeft} xhiro të mbetura`}
              </span>
            ) : remaining && <span className="tregu-market-close">{remaining}</span>}
            {/* Inside the header row, but absolutely positioned on desktop, so
                it anchors to the card's top-right corner there and simply
                becomes the row's last item on one column. One element, one
                source of truth, and no width where there is none to spare. */}
            {isF1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="tregu-f1-car-art" src="/images/tregu/f1-rear-smoke-v1.png" alt="" aria-hidden />
            ) : null}
          </div>

          <p className="tregu-feature-q">{market.question}</p>

          {!structured && !isChampionship && market.category !== "sport" && (
            <MarketContextMedia media={market.marketMedia} variant="featured" />
          )}

          {f1Top3.length ? (
            <F1TopThree
              drivers={f1Top3}
              label={isChampionship ? "Favoritët për titull" : "Tre favoritët për fitore"}
              hrefFor={(driver) => `/tregu/${market.slug}?piloti=${encodeURIComponent(driver.key)}`}
              tabIndex={active ? 0 : -1}
            />
          ) : structured ? (
            <div className="tregu-feature-outcome-rack">
              {chartSeries.map((outcome, index) => {
                const sourceOutcome = market.sportOutcomes?.[index];
                return (
                  <Link
                    key={outcome.key}
                    href={`/tregu/${market.slug}?rezultati=${encodeURIComponent(outcome.key)}`}
                    tabIndex={active ? 0 : -1}
                    style={{ ["--outcome-color" as string]: outcome.color }}
                    aria-label={`${outcome.label}, ${(outcome.current * 100).toFixed(1)} për qind`}
                  >
                    <span className="tregu-native-outcome-name">
                      {sourceOutcome?.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sourceOutcome.logo}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <i aria-hidden style={{ background: outcome.color }} />
                      )}
                      <em>{outcome.label}</em>
                    </span>
                    <strong>{(outcome.current * 100).toFixed(1)}%</strong>
                    <small>×{outcome.current > 0 ? (1 / outcome.current).toFixed(2) : "-"}</small>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="tregu-sides" style={{ marginTop: "auto" }}>
                <button
                  onClick={(e) => goToSide(e, "PO")}
                  className="tregu-side tregu-btn-yes tregu-feature-side"
                  type="button"
                  tabIndex={active ? 0 : -1}
                >
                  <div className="tregu-side-row">
                    <span className="tregu-side-name">PO</span>
                    <span className="tregu-side-pct">{pct}%</span>
                  </div>
                  <span className="tregu-side-mult">{yesMult ? `×${yesMult}` : "-"}</span>
                </button>
                <button
                  onClick={(e) => goToSide(e, "JO")}
                  className="tregu-side tregu-btn-no tregu-feature-side"
                  type="button"
                  tabIndex={active ? 0 : -1}
                >
                  <div className="tregu-side-row">
                    <span className="tregu-side-name">JO</span>
                    <span className="tregu-side-pct">{noPct}%</span>
                  </div>
                  <span className="tregu-side-mult">{noMult ? `×${noMult}` : "-"}</span>
                </button>
              </div>
          )}

          {/* The card's own numbers. Every figure here was already on the
              market model and none of it was being shown — the slot spent its
              height on air and its footer on a single sentence. */}
          <dl className="tregu-feature-stats">
            <div>
              <dt>Vëllimi</dt>
              <dd>{market.volume ? fmtNum(market.volume) : "—"}<i>383C</i></dd>
            </div>
            <div>
              <dt>Tregtime</dt>
              <dd>{market.tradeCount != null ? fmtNum(market.tradeCount) : "—"}</dd>
            </div>
            <div>
              <dt>Lëvizja 7d</dt>
              <dd data-dir={deltaPp ? dir : undefined}>
                {deltaPp != null && deltaPp !== 0 ? `${deltaPp > 0 ? "+" : "−"}${Math.abs(deltaPp)} pp` : "—"}
              </dd>
            </div>
            <div>
              <dt>Mbyllet</dt>
              <dd>{shortLeft(market.closesAt)}</dd>
            </div>
          </dl>

          <div className="tregu-market-foot" style={{ border: "none", paddingTop: 0 }}>
            <span>{isChampionship ? "Të dhëna zyrtare F1 · 22 pilotë" : "Të dhëna live"}</span>
            <span className="tregu-market-open">{isChampionship ? "Hap tregun e titullit →" : "Hap tregun →"}</span>
          </div>
        </div>

        {/* ── The instrument ── */}
        <div className="tregu-feature-chart">
          <div className="tregu-feature-price">
            <div>
              <span className="tregu-feature-price-label">{structured || f1Chart ? `Në krye · ${leader?.label ?? "Pa të dhëna"}` : "Gjasa PO"}</span>
              <span className="tregu-feature-price-value">{structured || f1Chart ? `${((leader?.current ?? 0) * 100).toFixed(1)}%` : `${pct}%`}</span>
            </div>
            {deltaPp != null && deltaPp !== 0 && (
              <span className="tregu-delta-chip" data-dir={dir}>
                7 ditë: {Math.max(0, Math.min(100, pct - deltaPp))}% → {pct}%
              </span>
            )}
          </div>
          {hasHistory ? (
            <div className="tregu-feature-tape">
              <ExactMarketChart
                compact
                curve="smooth"
                /* Sized to sit level with the rail, not to fill a tall card.
                   The pulse strip is off here: its "Në krye" repeated the
                   leader printed in large type just above the chart, and the
                   market page still carries the full strip. */
                height={structured || isChampionship ? 196 : 180}
                series={chartSeries}
                tone={structured || isChampionship || market.category === "sport" ? "sport" : "serious"}
                fill
                ariaLabel={`Historia reale për ${market.question}`}
              />
            </div>
          ) : (
            /* A new book has no history yet. A chart with nothing to draw is a
               pale half-card; the current prices are the whole story, so the
               instrument shows them until the first trades give it a line. */
            <div className="tregu-feature-board">
              <ul aria-label="Gjasat aktuale">
                {boardRows.map((row) => (
                  <li key={row.key} style={{ ["--board-color" as string]: row.color }}>
                    <span className="tregu-feature-board-name">{row.label}</span>
                    <span className="tregu-feature-board-track" aria-hidden>
                      <i style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, row.current))})` }} />
                    </span>
                    <strong>{(row.current * 100).toFixed(structured ? 1 : 0)}%</strong>
                  </li>
                ))}
              </ul>
              <p>Grafiku shfaqet pas tregtimeve të para.</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// Flagship slot at the top of the floor: the biggest open markets rotate
// through one full-width glass card. Auto-advances every 7s, pauses on
// hover/focus and hidden tabs, and honours prefers-reduced-motion by
// switching instantly with no autoplay. One market only? Renders the same
// card with no controls — the carousel chrome earns its place at 2+.
export default function FeaturedCarousel({ markets }: { markets: MiniMarket[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = markets.length;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const activeSlideRef = useRef<HTMLDivElement | null>(null);
  const [slideHeight, setSlideHeight] = useState<number | null>(null);
  const [stacked, setStacked] = useState(false);

  // Beside the rail the card takes the row's height, so every slide shares one
  // frame and nothing needs measuring. Stacked above the rail there is no row
  // to agree with, and the card follows the slide on screen instead.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const apply = () => setStacked(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Re-measured when the slide changes and whenever its own content resizes —
     a chart that finishes drawing, an image that lands, a probability that
     rewraps the question onto a third line. */
  useEffect(() => {
    const el = activeSlideRef.current;
    if (!el || !stacked) {
      setSlideHeight(null);
      return;
    }
    const measure = () => setSlideHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, markets, stacked]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Market list changed under us (category filter) — never point past the end.
  useEffect(() => {
    setIndex((i) => (i >= count ? 0 : i));
  }, [count]);

  const go = useCallback(
    (next: number) => {
      const normalized = ((next % count) + count) % count;
      setDirection(next < index || (index === 0 && normalized === count - 1) ? "previous" : "next");
      setIndex(normalized);
    },
    [count, index]
  );

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const t = window.setTimeout(() => {
      if (!document.hidden) go(index + 1);
    }, INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, reduced, count, go]);

  if (count === 0) return null;

  return (
    <section
      className="tregu-glass tregu-carousel tregu-edge"
      data-cat={markets[Math.min(index, count - 1)]?.category}
      /* The competition rides on the carousel, not only on the slide, so its
         ground can run edge to edge — behind the header and out to the card's
         own border — instead of sitting in a white frame. */
      data-competition={markets[Math.min(index, count - 1)]?.league ?? undefined}
      role="region"
      aria-roledescription="karusel"
      aria-label="Ngjarjet e mëdha"
      data-paused={paused || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      {/* One ground per slide, stacked under everything, so moving between
          two different colours is a crossfade between two layers rather than
          one layer changing its gradient on a single frame. */}
      <div className="tregu-car-grounds" aria-hidden>
        {markets.map((m, i) => (
          <i key={m.slug} data-competition={m.league ?? undefined} data-active={i === index || undefined} />
        ))}
      </div>

      <div className="tregu-car-head">
        <span className="tregu-car-title">
          <span className="tregu-live-dot" aria-hidden />
          Ngjarjet e mëdha
        </span>
        {count > 1 && (
          <div className="tregu-car-nav">
            <span className="tregu-car-count" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              className="tregu-car-arrow"
              aria-label="Ngjarja e mëparshme"
              onClick={() => go(index - 1)}
            >
              ←
            </button>
            <button
              type="button"
              className="tregu-car-arrow"
              aria-label="Ngjarja tjetër"
              onClick={() => go(index + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div
        className="tregu-car-viewport"
        data-direction={direction}
        /* Stacked layout only: height follows the slide on screen.
           The slides share one cell, so left alone the card would be as tall
           as the TALLEST slide and every shorter one would carry its empty
           space. Measuring the active slide and animating to it means the
           card is only ever as tall as what it is showing. Beside the rail
           no height is set and the row decides. */
        style={slideHeight ? { height: slideHeight } : undefined}
        ref={viewportRef}
      >
        {/* The slides share one cell and crossfade in place; see the
            "one clock" block in globals.css. */}
        <div className="tregu-car-track">
          {markets.map((m, i) => (
            <div
              key={m.slug}
              ref={i === index ? activeSlideRef : undefined}
              className="tregu-car-slide"
              data-active={i === index || undefined}
              aria-hidden={i !== index}
              inert={i !== index ? true : undefined}
            >
              <Slide market={m} active={i === index} />
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="tregu-car-dots" role="tablist" aria-label="Zgjidh ngjarjen">
          {markets.map((m, i) => (
            <button
              key={m.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ngjarja ${i + 1}: ${m.question}`}
              className="tregu-car-dot"
              data-active={i === index || undefined}
              onClick={() => go(i)}
            >
              {/* key restarts the fill animation each time this dot goes live */}
              {i === index && !reduced && <span key={index} className="tregu-car-dot-fill" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
