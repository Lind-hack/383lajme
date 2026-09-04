"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

import F1TopThree, { topThreeDrivers, type F1TopThreeDriver } from "@/components/tregu/f1-top-three";
import type { MiniMarket } from "./market-mini-card";
import { fmtNum } from "@/lib/format";
import ExactMarketChart, { type ExactMarketSeries } from "./exact-market-chart";
import MarketContextMedia from "./market-context-media";
import SportBrandMark from "./sport-brand-mark";
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
      : [];

  const chartSeries: ExactMarketSeries[] = isChampionship
    ? championshipDrivers.map((driver, index) => ({
        key: driver.key,
        label: driver.label,
        color: outcomeColor(driver, index),
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

  const goToSide = (e: React.MouseEvent, side: "PO" | "JO") => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${market.slug}?ana=${side.toLowerCase()}`);
  };

  return (
    <article
      className={`tregu-car-slide-link${isChampionship ? " tregu-championship-card" : ""}`}
      data-championship={isChampionship ? "" : undefined}
      data-f1={isF1 ? "" : undefined}
      style={{ textDecoration: "none", color: "#111111" }}
    >
      <Link
        href={`/tregu/${market.slug}`}
        className="tregu-car-slide-hit"
        tabIndex={active ? 0 : -1}
        aria-label={`Hap tregun: ${market.question}`}
        draggable={false}
      />
      {isF1 ? <img className="tregu-f1-car-art" src="/images/tregu/f1-rear-smoke-v1.png" alt="" aria-hidden /> : null}
      <div className="tregu-feature-grid" data-structured={structured || isChampionship || undefined}>
        {/* ── The proposition ── */}
        <div className="tregu-feature-main">
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
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
            {remaining && <span className="tregu-market-close">{remaining}</span>}
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

          <div className="tregu-market-foot" style={{ border: "none", paddingTop: 0 }}>
            <span>
              {isChampionship
                ? "Të dhëna zyrtare F1 · 22 pilotë"
                : market.volume !== undefined && market.volume > 0
                ? `Aktiviteti i fundit ${fmtNum(market.volume)} 383C`
                : "Treg i ri"}
            </span>
            <span className="tregu-market-open">{isChampionship ? "Hap tregun e titullit →" : "Hap tregun →"}</span>
          </div>
        </div>

        {/* ── The instrument ── */}
        <div className="tregu-feature-chart">
          <div className="tregu-feature-price">
            <div>
              <span className="tregu-feature-price-label">{structured || isChampionship ? `Në krye · ${leader?.label ?? "Pa të dhëna"}` : "Gjasa PO"}</span>
              <span className="tregu-feature-price-value">{structured || isChampionship ? `${((leader?.current ?? 0) * 100).toFixed(1)}%` : `${pct}%`}</span>
            </div>
            {deltaPp != null && deltaPp !== 0 && (
              <span className="tregu-delta-chip" data-dir={dir}>
                7 ditë: {Math.max(0, Math.min(100, pct - deltaPp))}% → {pct}%
              </span>
            )}
          </div>
          <div className="tregu-feature-tape">
            <ExactMarketChart
              compact
              curve="smooth"
              height={structured || isChampionship ? 260 : 218}
              series={chartSeries}
              tone={structured || isChampionship || market.category === "sport" ? "sport" : "serious"}
              showPulse={structured || isChampionship}
              ariaLabel={`Historia reale për ${market.question}`}
            />
          </div>
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

      <div className="tregu-car-viewport" data-direction={direction}>
        <div
          className="tregu-car-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {markets.map((m, i) => (
            <div
              key={m.slug}
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
