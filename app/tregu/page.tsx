"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar";
import TimeAgo from "@/components/time-ago";
import MarketMiniCard from "@/components/tregu/market-mini-card";
import MarketEventCard from "@/components/tregu/market-event-card";
import { groupMarkets } from "@/lib/tregu-groups";
import { track } from "@/lib/analytics";
import SportSections from "@/components/tregu/sport-sections";
import { isF1Market, marketsForFootballLeague, sportLabel } from "@/lib/tregu-sport-sections.mjs";
import FeaturedCarousel from "@/components/tregu/featured-carousel";
import F1ArchiveFeature from "@/components/tregu/f1-archive-feature";
import FloorRail from "@/components/tregu/floor-rail";
import type { MiniMarket } from "@/components/tregu/market-mini-card";
import VideoHero from "@/components/tregu/video-hero";
import CoinFace from "@/components/tregu/coin-face";
import MobileAccountBar from "@/components/tregu/mobile-account-bar";
import StructuredSportMarketCard from "@/components/tregu/structured-sport-market-card";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { fmtNum } from "@/lib/format";
import {
  featuredMarketScore,
  isStructuredSportMarket,
  marketVolume,
} from "@/lib/tregu-hub-market.mjs";
import type { MarketMedia } from "@/lib/tregu-market-media.mjs";
import SpotlightTour, { openTour, type TourStep } from "@/components/spotlight-tour";
import { formatKosovoTime } from "@/lib/tregu-local-time.mjs";

const TOUR_ID = "tregu-floor";

/**
 * Three steps: where to start, what to do, what it costs. Steps whose target is
 * absent (logged out, no featured market) are skipped by the tour itself.
 */
const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='floor-filters']",
    title: "Fillo te tema jote",
    body: "Politikë, sport, ekonomi — zgjidh çfarë njeh.",
    // A strip of pills, not a pill. At the full stadium radius this row asks
    // for, the arc at each end reaches inward to within ~2px of the first and
    // last chip — clearance that any change to the chip height would spend.
    padding: 12,
    radius: 28,
    zoom: 1.04,
    cursor: {
      loop: true,
      beats: [
        { click: "[data-tour='floor-filters'] > *:nth-child(2)", hold: 700 },
        { click: "[data-tour='floor-filters'] > *:nth-child(3)", hold: 700 },
      ],
    },
  },
  {
    target: "[data-tour='floor-grid'] > *:first-child",
    title: "Hap një pyetje",
    body: "Zgjidh PO ose JO, vendos sa Coin, konfirmo. Kaq.",
    padding: 10,
    radius: 18,
    zoom: 1.06,
    cursor: {
      loop: true,
      beats: [{ click: "[data-tour='floor-grid'] > *:first-child", hold: 1100 }],
    },
  },
  {
    target: "[data-tour='floor-balance']",
    title: "383 Coin janë falas",
    body: "Ky është bilanci yt. Merr bonusin çdo ditë.",
    padding: 8,
    radius: 100,
    zoom: 1.06,
    cursor: {
      loop: true,
      beats: [{ at: "[data-tour='floor-balance']", hold: 1200 }],
    },
  },
];

interface MarketRow {
  id: string;
  slug: string;
  question: string;
  category: string;
  market_prob: number;
  status: string;
  market_classification?: string;
  market_type?: string;
  live_event?: { league?: string; sport?: string; event_kind?: string } | null;
  closes_at: string;
  q_yes: number;
  q_no: number;
  spark?: number[];
  delta7d?: number | null;
  trade_count?: number;
  trade_volume?: number;
  history?: { created_at: string; probability: number }[];
  last_data_at?: string;
  updated_at?: string;
  sport_outcomes?: {
    key: string;
    label: string;
    team?: string;
    color?: string;
    team_color?: string;
    team_colour?: string;
    logo?: string;
    championship_position?: number;
    championship_points?: number;
    latest_race_position?: number | null;
    weekend_points?: number;
    gap_to_leader?: number;
    gap_change?: number;
  }[] | null;
  outcome_probabilities?: Record<string, number> | null;
  outcome_history?: Record<string, { created_at: string; probability: number }[]> | null;
  market_media?: MarketMedia | null;
}

interface ActivityItem {
  name: string;
  action: string;
  side: string;
  coins: number;
  createdAt: string;
  question: string;
  slug: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "tani";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "Të gjitha" },
  { value: "politike", label: "Politikë" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "sport", label: "Sport" },
  { value: "bote", label: "Botë" },
  { value: "te-tjera", label: "Të tjera" },
];

type SortKey = "vellim" | "afat" | "nxehta";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "vellim", label: "Vëllimi" },
  { value: "afat", label: "Mbyllet së shpejti" },
  { value: "nxehta", label: "Më të nxehta" },
];

function vol(m: MarketRow): number {
  return marketVolume(m);
}

function isF1Archive(market: MarketRow): boolean {
  return (
    (market.status === "closed" || market.status === "resolved") &&
    market.market_classification === "live_f1" &&
    market.market_type === "f1_race_winner"
  );
}

export default function TreguHub() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState("all");
  const [league, setLeague] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("vellim");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [coinSpin, setCoinSpin] = useState(false);
  const [flyCoins, setFlyCoins] = useState<Array<{ id: number; amount: number }>>([]);
  const [rewardAmount, setRewardAmount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let loadedOnce = false;
    let controller: AbortController | null = null;
    setLoading(true);
    setLoadError(false);
    const qs = category === "all" ? "?status=all" : `?category=${category}&status=all`;

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/tregu/markets${qs}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`markets ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setMarkets(
          (data.markets ?? []).filter(
            (market: MarketRow) => market.status === "open" || isF1Archive(market)
          )
        );
        setActivity(data.activity ?? []);
        const generatedAt = new Date(data.generated_at ?? Date.now());
        setUpdatedAt(formatKosovoTime(generatedAt));
        loadedOnce = true;
        setLoadError(false);
        setLoading(false);
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        // A transient background refresh must not erase a trustworthy floor
        // already on screen. Only the first failure becomes the blocking state.
        if (!loadedOnce) {
          setLoadError(true);
          setLoading(false);
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [category, reloadKey]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = createClient();
    let cancelled = false;

    const isMobile = () =>
      typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

    // Fresh signup/login sets this flag in /hyr. On desktop NavBalance owns the
    // celebration, but NavBalance is never mounted on mobile (collapsed navbar),
    // so the mobile account bar plays the coins-flowing animation here instead.
    const takeCelebrate = () => {
      try {
        const raw = sessionStorage.getItem("383-coin-celebrate");
        if (!raw) return false;
        sessionStorage.removeItem("383-coin-celebrate");
        return Date.now() - Number(raw) < 90_000;
      } catch {
        return false;
      }
    };

    const celebrateMobile = (coins: number) => {
      // Stream coins into the mobile chip, flip its coin, and raise the toast.
      const n = Math.min(12, Math.max(6, Math.ceil(coins / 20)));
      setRewardAmount(coins);
      setFlyCoins(Array.from({ length: n }, (_, i) => ({ id: performance.now() + i, amount: coins })));
      setCoinSpin(true);
      window.setTimeout(() => {
        setFlyCoins([]);
        setRewardAmount(null);
      }, n * 55 + 600);
      window.setTimeout(() => setCoinSpin(false), 950);
      window.dispatchEvent(new CustomEvent("383:coins-earned", { detail: coins }));
    };

    let tries = 0;
    const load = () => {
      fetch("/api/tregu/portfolio")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return;
          const coins = d.profile?.coins;
          if (typeof coins !== "number") {
            // Brand-new signup: the profile row/coins may not exist the instant
            // we land on the floor. Retry briefly so the balance still shows.
            if (tries++ < 4) window.setTimeout(load, 1200);
            return;
          }
          setBalance(coins);
          if (isMobile() && takeCelebrate()) celebrateMobile(coins);
        })
        .catch(() => {});
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !cancelled) load();
    });

    // Signup redirects can mount the floor before the session settles — the
    // SIGNED_IN event then delivers the balance (and its celebration).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) load();
      if (event === "SIGNED_OUT" && !cancelled) setBalance(null);
    });

    // Bonus/bet updates from elsewhere report the new balance via this event.
    const onBalance = (e: Event) => {
      const next = (e as CustomEvent<number>).detail;
      if (typeof next === "number") setBalance(next);
    };
    window.addEventListener("tregu:balance", onBalance);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("tregu:balance", onBalance);
    };
  }, []);

  // Live floor totals — real numbers computed from the loaded book.
  const totals = useMemo(
    () => ({
      count: markets.filter((market) => market.status === "open").length,
      volume: markets
        .filter((market) => market.status === "open")
        .reduce((sum, market) => sum + vol(market), 0),
    }),
    [markets]
  );
  const f1Archives = useMemo(() => markets.filter(isF1Archive), [markets]);

  // Multi-outcome events: markets titled "<Ngjarja>: <Rezultati>?" fold into
  // one Polymarket-style card with a combined chart and one buy row per
  // outcome. Their sibling books leave the plain grid and the carousel.
  const eventGroups = useMemo(
    () =>
      groupMarkets(
        markets.filter((market) => !isStructuredSportMarket(market)).map((m) => ({
          slug: m.slug,
          question: m.question,
          category: m.category,
          prob: m.market_prob,
          volume: vol(m),
          closesAt: m.closes_at,
          spark: m.spark,
          delta7d: m.delta7d,
          history: m.history,
          tradeCount: m.trade_count,
          lastDataAt: m.last_data_at,
          marketMedia: m.market_media,
        }))
      ).groups,
    [markets]
  );
  const groupedSlugs = useMemo(
    () => new Set(eventGroups.flatMap((g) => g.outcomes.map((o) => o.slug))),
    [eventGroups]
  );

  // The big events: highest-volume open markets rotate through the flagship
  // carousel. Always volume-ranked regardless of the grid sort — size of the
  // book is what makes an event "big". Capped at 4 and never more than half
  // the floor, so the grid below always keeps something to browse.
  const featured = useMemo(() => {
    const pool = markets.filter((m) => !groupedSlugs.has(m.slug));
    const nonF1 = pool.filter((market) => !isF1Archive(market));
    if (nonF1.length < 3) return [] as MarketRow[];
    const byScore = [...nonF1].sort((a, b) => featuredMarketScore(b) - featuredMarketScore(a));

    // The next race leads the floor.
    //
    // featuredMarketScore is movement times five, and a race that has not been
    // repriced yet has no movement to show — so the one market with a fixed,
    // advertised start time was the one that could never earn the front of the
    // carousel, and lost it to whichever football fixture happened to have
    // ticked most recently. Ranking cannot express "this is on Sunday"; a
    // deliberate slot can. Everything behind it is still ranked on merit.
    const nextRace = nonF1
      .filter(
        (market) =>
          market.status === "open" &&
          market.market_classification === "live_f1" &&
          market.market_type === "f1_race_winner" &&
          market.live_event?.event_kind !== "championship" &&
          new Date(market.closes_at).getTime() > Date.now()
      )
      .sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime())[0];

    if (!nextRace) return byScore.slice(0, 4);
    return [nextRace, ...byScore.filter((market) => market.slug !== nextRace.slug)].slice(0, 4);
  }, [markets, groupedSlugs]);

  // Sorting is the affordance that makes the trader think: chase volume,
  // beat the clock, or hunt the most contested (closest-to-50) markets.
  // A sports-league selection (from the discovery cards) narrows the floor
  // before sorting — the cards are the intent, the grid is the answer.
  const sorted = useMemo(() => {
    const featuredSlugs = new Set(featured.map((m) => m.slug));
    let arr = markets.filter(
      (market) =>
        !isF1Archive(market) &&
        !featuredSlugs.has(market.slug) &&
        !groupedSlugs.has(market.slug)
    );
    if (league === "f1") {
      arr = arr.filter((m) => isF1Market(m));
    } else if (league) {
      arr = marketsForFootballLeague(arr, league);
    }
    if (sort === "vellim") arr.sort((a, b) => vol(b) - vol(a));
    else if (sort === "afat")
      arr.sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime());
    else if (sort === "nxehta")
      arr.sort((a, b) => Math.abs(0.5 - a.market_prob) - Math.abs(0.5 - b.market_prob));
    return arr;
  }, [markets, featured, groupedSlugs, sort, league]);

  const selectSport = (key: string) => {
    // Landing inside the Sport category is part of the promise on the cards:
    // the pill row reflects it, the server fetch narrows to sport, and the
    // league filter refines from there.
    setCategory("sport");
    setLeague((current) => (current === key ? null : key));
    track("tregu_sport_select", { league: key });
    document.getElementById("tregjet")?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const toMini = (m: MarketRow): MiniMarket => ({
    slug: m.slug,
    question: m.question,
    category: m.category,
    prob: m.market_prob,
    volume: vol(m),
    closesAt: m.closes_at,
    spark: m.spark,
    delta7d: m.delta7d,
    history: m.history,
    tradeCount: m.trade_count,
    lastDataAt: m.last_data_at,
    marketType: m.market_type,
    league: m.live_event?.league ?? null,
    eventKind: m.live_event?.event_kind ?? null,
    sportOutcomes: m.sport_outcomes,
    outcomeProbabilities: m.outcome_probabilities,
    outcomeHistory: m.outcome_history,
    marketMedia: m.market_media,
  });

  const claimBonus = async () => {
    setClaiming(true);
    setBonusMsg(null);
    const res = await fetch("/api/tregu/daily-bonus", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      const earned = Number(data.bonus);
      track("tregu_bonus_claim", { bonus: Number(data.bonus) });
      setBonusMsg(`+${data.bonus} 383C`);
      setBalance((b) => (b === null ? null : b + earned));
      // Earn flip on the chip coin — same state as the approved coin mock.
      setCoinSpin(true);
      setRewardAmount(earned);
      window.setTimeout(() => {
        setCoinSpin(false);
        setRewardAmount(null);
      }, 950);
      // Stream coins into the mobile bar chip (the navbar chip that plays this
      // on desktop is hidden on mobile). Count scales with the bonus size.
      const n = Math.min(10, Math.max(4, Math.ceil(earned / 25)));
      setFlyCoins(Array.from({ length: n }, (_, i) => ({ id: performance.now() + i, amount: earned })));
      window.setTimeout(() => setFlyCoins([]), n * 55 + 500);
      if (balance !== null) {
        // The navbar balance chip listens for this and plays the coin fly-in.
        window.dispatchEvent(
          new CustomEvent("tregu:balance", { detail: balance + Number(data.bonus) })
        );
      }
    } else {
      setBonusMsg(data.error ?? "Gabim");
    }
    setClaiming(false);
  };

  return (
    <div className="tregu-scope">
      <Navbar />
      <VideoHero loggedIn={balance !== null} />

      {/* Status ribbon — live market header bridging the dark hero into the floor. */}
      <div className="tregu-ribbon">
        <div className="tregu-ribbon-inner">
          <span className="tregu-stat-live">Tregu hapur</span>
          <span className="tregu-stat">
            <span className="tregu-stat-label">Tregje</span>
            <span className="tregu-stat-value">{loading || loadError ? "—" : fmtNum(totals.count)}</span>
          </span>
          <span className="tregu-stat">
            <span className="tregu-stat-label">Aktiviteti i fundit</span>
            <span className="tregu-stat-value">
              {loading || loadError ? "—" : `${fmtNum(totals.volume)} 383C`}
            </span>
          </span>
          <span className="tregu-stat">
            <span className="tregu-stat-label">Kontrolluar</span>
            <span className="tregu-stat-value">{updatedAt ?? "—"}</span>
          </span>
        </div>
      </div>

      {/* Mobile account bar — pins the balance, flowing coins and daily bonus
          under the navbar, where the collapsed mobile nav has no room. */}
      {balance !== null && (
        <MobileAccountBar
          balance={balance}
          claiming={claiming}
          bonusMsg={bonusMsg}
          coinSpin={coinSpin}
          flyCoins={flyCoins}
          rewardAmount={rewardAmount}
          onClaim={claimBonus}
        />
      )}

      <main id="tregjet" style={{ maxWidth: 1160, margin: "0 auto", padding: "44px 24px 80px", scrollMarginTop: 88 }}>
        {/* Floor head — accent bar + focused, active-voice line. */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 4, height: 40, background: "#FF4422", borderRadius: 2, flexShrink: 0 }} />
            <div>
              <h1 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                Tregu
              </h1>
              <p style={{ color: "#6B6B6B", fontSize: 13, margin: "3px 0 0" }}>
                Analizo gjasat. Zgjidh anën. Vër 383 Coin.
              </p>
              <button
                type="button"
                className="tregu-home-help"
                style={{ marginTop: 10 }}
                onClick={() => openTour(TOUR_ID)}
              >
                <span aria-hidden>?</span>
                Si funksionon
              </button>
            </div>
          </div>

          {balance !== null && (
            <div className="tregu-glass tregu-glass-hi tregu-headchip" data-tour="floor-balance" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px 9px 14px" }}>
              <CoinFace size={26} spinning={coinSpin} hoverTilt />
              <span style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                {fmtNum(balance)}
              </span>
              {bonusMsg && <span style={{ fontSize: 12, fontWeight: 700, color: "#00A651", fontVariantNumeric: "tabular-nums" }}>{bonusMsg}</span>}
              <button
                onClick={claimBonus}
                disabled={claiming}
                className="tregu-btn-primary"
                style={{ padding: "8px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer" }}
              >
                {claiming ? "..." : "Bonusi ditor"}
              </button>
              <Link href="/tregu/portofoli" style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Portofoli →
              </Link>
            </div>
          )}
        </div>

        {/* Category filters — ink active state, matches the rest of the site */}
        <div data-tour="floor-filters" style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 100,
                  border: "1px solid " + (active ? "#111111" : "rgba(17,17,17,0.12)"),
                  background: active ? "#111111" : "rgba(255,255,255,0.6)",
                  color: active ? "#FFFFFF" : "#111111",
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "transform 160ms var(--ease-out), background-color 200ms var(--ease-out), border-color 200ms var(--ease-out), color 200ms var(--ease-out)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Live tape — latest real trades across the floor, the hub's pulse. */}
        {activity.length > 0 && (
          <div className="tregu-ticker" data-tour="floor-tape" aria-label="Tregtimet e fundit">
            <span className="tregu-ticker-label">
              <span className="tregu-live-dot" aria-hidden />
              Live
            </span>
            <div className="tregu-ticker-track">
              {activity.map((a, i) => (
                <Link key={i} href={`/tregu/${a.slug}`} className="tregu-ticker-item">
                  <strong>{a.name}</strong>
                  <span>{a.action === "sell" ? "shiti" : "bleu"}</span>
                  <span
                    className="tregu-ticker-side"
                    data-side={a.side === "PO" ? "po" : "jo"}
                  >
                    {a.side}
                  </span>
                  <span className="tregu-ticker-coins">
                    {fmtNum(a.coins)} 383C
                  </span>
                  <span className="tregu-ticker-q">{a.question}</span>
                  <TimeAgo iso={a.createdAt} format={timeAgo} className="tregu-ticker-time" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Hero row — flagship carousel left, floor rail right. The big
            books rotate through one big card; the rail ranks the whole
            floor: hot topics, nearest deadlines, and the promo tile. */}
        {!loading &&
          !loadError &&
          f1Archives.map((market) => (
            <F1ArchiveFeature key={market.id} market={market} />
          ))}
        {!loading && !loadError && featured.length > 0 && (
          <div className="tregu-hero-row" data-tour="floor-featured">
            <FeaturedCarousel key={category} markets={featured.map(toMini)} />
            <FloorRail
              markets={markets.filter((market) => !isStructuredSportMarket(market)).map(toMini)}
              loggedIn={balance !== null}
              claiming={claiming}
              bonusMsg={bonusMsg}
              coinSpin={coinSpin}
              rewardAmount={rewardAmount}
              onClaim={claimBonus}
            />
          </div>
        )}

        {/* Sports discovery — the four big football leagues with live books,
            the F1 calendar, and basketball locked until its pricing
            algorithm exists. A selection filters the floor grid below. */}
        {!loading && !loadError && (
          <SportSections
            markets={markets}
            isOpen={(m) => m.status === "open" || isF1Archive(m as MarketRow)}
            activeLeague={league}
            onSelect={selectSport}
          />
        )}

        {/* Active league filter chip — visible state for the grid below. */}
        {league && !loading && !loadError && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 14px", borderRadius: 100, background: "#fff3ef", border: "1px solid rgba(255,68,34,0.4)", fontSize: 12.5, fontWeight: 800, color: "#111" }}>
              {sportLabel(league)}
              <button
                onClick={() => setLeague(null)}
                aria-label={`Hiq filtrin ${sportLabel(league)}`}
                style={{ width: 20, height: 20, borderRadius: 100, border: "none", background: "rgba(17,17,17,0.08)", color: "#111", fontWeight: 800, fontSize: 12, lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform 150ms var(--ease-out)" }}
              >
                ×
              </button>
            </span>
          </div>
        )}

        {/* Controls — count + segmented sort (traders sort). */}
        <div className="tregu-controls">
          <span className="tregu-count">
            {loading ? (
              "Duke ngarkuar tregjet…"
            ) : loadError ? (
              "Tregjet nuk u ngarkuan"
            ) : (
              <>
                <strong>{markets.length}</strong> {markets.length === 1 ? "treg aktiv" : "tregje aktive"}
              </>
            )}
          </span>
          <div className="tregu-sort" role="group" aria-label="Rendit tregjet">
            {SORTS.map((s) => (
              <button key={s.value} onClick={() => setSort(s.value)} aria-pressed={sort === s.value}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <>
            {/* Hero-row-shaped skeleton so the flagship slot doesn't pop in late. */}
            <div className="tregu-hero-row">
              <div className="tregu-glass" style={{ height: 300, opacity: 0.5, borderRadius: 18 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="tregu-glass" style={{ flex: 1, opacity: 0.5 }} />
                <div className="tregu-glass" style={{ height: 96, opacity: 0.5 }} />
              </div>
            </div>
            <div className="tregu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="tregu-glass" style={{ height: 208, opacity: 0.5 }} />
              ))}
            </div>
          </>
        ) : loadError ? (
          <div className="tregu-glass" style={{ padding: "40px 28px", textAlign: "center" }}>
            <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Tregjet nuk u ngarkuan</p>
            <p style={{ color: "#6B6B6B", fontSize: 14, margin: "6px 0 16px" }}>
              Kontrollo lidhjen me internetin dhe provo përsëri.
            </p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="tregu-btn-primary"
              style={{ padding: "10px 22px", borderRadius: 100, fontSize: 13, cursor: "pointer" }}
            >
              Provo përsëri
            </button>
          </div>
        ) : sorted.length === 0 && eventGroups.length === 0 && f1Archives.length === 0 ? (
          <div className="tregu-glass" style={{ padding: "40px 28px", textAlign: "center" }}>
            <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>
              {league ? `Nuk ka tregje të hapura në ${sportLabel(league)} për momentin` : "Asnjë treg aktiv këtu ende"}
            </p>
            <p style={{ color: "#6B6B6B", fontSize: 14, margin: "6px 0 0" }}>
              {league ? (
                <>
                  Tregjet e kësaj lige shfaqen sapo hap një javë lojësh.{" "}
                  <button onClick={() => setLeague(null)} style={{ background: "none", border: "none", padding: 0, color: "#FF4422", fontWeight: 800, fontSize: 14, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                    Hiq filtrin
                  </button>
                </>
              ) : (
                "Provo një kategori tjetër. Tregjet e reja lindin nga lajmet e ditës."
              )}
            </p>
          </div>
        ) : (
          <div className="tregu-grid" data-tour="floor-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {eventGroups.map((g) => (
              <MarketEventCard key={g.key} group={g} />
            ))}
            {sorted.map((m) =>
              isStructuredSportMarket(m) ? (
                <StructuredSportMarketCard key={m.id} market={m} />
              ) : (
                <MarketMiniCard key={m.id} market={toMini(m)} />
              )
            )}
          </div>
        )}

        {/* Same spotlight walkthrough as the homepage, tuned to the floor. */}
        <SpotlightTour
          tourId={TOUR_ID}
          anchor="[data-tour='floor-filters']"
          steps={TOUR_STEPS}
          eyebrow="Si funksionon Tregu"
        />
      </main>
    </div>
  );
}
