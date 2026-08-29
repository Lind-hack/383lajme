"use client";

import { useCallback, useEffect, useRef, useState, use as usePromise, type ComponentProps, type CSSProperties } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import ExactMarketChart from "@/components/tregu/exact-market-chart";
import MarketContextMedia from "@/components/tregu/market-context-media";
import MarketShareActions from "@/components/tregu/market-share-actions";
import SportBrandMark from "@/components/tregu/sport-brand-mark";
import { type MiniMarket } from "@/components/tregu/market-mini-card";
import TeamFlag from "@/components/tregu/team-flag";
import MarketSocial, { type HolderRow, type CommentItem } from "@/components/tregu/market-social";
import CoinFace from "@/components/tregu/coin-face";
import ConfirmButton from "@/components/tregu/confirm-button";
import TradeTutorial, { openTradeTutorial } from "@/components/tregu/trade-tutorial";
import { createClient } from "@/lib/supabase/client";
import {
  previewBet,
  previewSell,
  previewSportOutcomeBet,
  previewSportOutcomeSell,
  lmsrPriceYes,
  lmsrSportOutcomePrices,
  type Side,
  type MarketTrade,
} from "@/lib/tregu-client";
import { fmtNum } from "@/lib/format";
import { track } from "@/lib/analytics";
import { DEMO_SLUG, demoDetail, demoEventMinis, demoMatchSeries, demoMatchStats, isDemoEnabled } from "@/lib/tregu-demo";
import MatchStats from "@/components/tregu/match-stats";
import { groupForSlug, parseEvent, type GroupOutcome, type MarketGroup } from "@/lib/tregu-groups";
import { outcomeMediaFor } from "@/lib/tregu-media";
import { eventStatsFor } from "@/lib/tregu-event-stats";
import RaceStandings from "@/components/tregu/race-standings";
import F1RaceControl from "@/components/tregu/f1-race-control";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import { normalizeRecordedOutcomeSeries } from "@/lib/tregu-hub-market.mjs";
import { f1DriverHeadshot, f1TeamColor } from "@/lib/f1-driver-presentation";
import { FOOTBALL_MARKET_UI_VERSION } from "@/lib/tregu-ui-contract";
import MobileTradeSheet, {
  type MobileTradeOption,
  type MobileTradeReceipt,
  type MobileTradeMode,
} from "@/components/tregu/mobile-trade-sheet";
import { normalizeCategory } from "@/lib/category-map";
import StickyMarketBack from "@/components/tregu/sticky-market-back";
import { primeTradeSuccessSound, resolveTradeSuccessSoundProfile } from "@/components/tregu/trade-success-sound";
import { buildFootballMetricRows } from "@/lib/tregu-market-detail.mjs";
import { formatKosovoDate } from "@/lib/tregu-local-time.mjs";

// Sibling outcome series from the detail API — real 5-min cron snapshots.
interface EventOutcome {
  slug: string;
  question: string;
  prob: number;
  series: { t: number; p: number }[];
}

interface MarketDetail {
  id: string;
  slug: string;
  question: string;
  description: string | null;
  category: string;
  status: string;
  market_type?: string;
  outcome: Side | null;
  market_prob: number;
  q_yes: number;
  q_no: number;
  b: number;
  closes_at: string;
  updated_at?: string | null;
  source_article_slugs: string[];
  resolution_rules: string | null;
  resolution_source: string | null;
  live_score_state?: unknown;
  sport_outcomes?: { key: string; label: string; team?: string; color?: string; logo?: string }[] | null;
  outcome_quantities?: Record<string, number> | null;
  reference_probabilities?: Record<string, number> | null;
  live_event?: { home_team?: string; away_team?: string; league?: string; sport?: string } | null;
  market_media?: ComponentProps<typeof MarketContextMedia>["media"];
}

interface Snapshot {
  ai_prob: number | null;
  market_prob: number;
  created_at: string;
  evidence: { title: string; slug: string; url?: string; imageUrl?: string }[] | null;
}

interface F1Payload { outcomes: { key: string; label: string; team: string; probability: number; headshot_url?: string; team_colour?: string; grid_position?: number }[]; timing: { race?: { status?: string; current_lap?: number; total_laps?: number }; rows?: { driver_code?: string; position?: number; gap?: string; pits?: number; status?: string }[] } | null; history?: { createdAt: string; probabilities: Record<string, number>; lap?: number; status?: string }[]; }

interface FootballPayload {
  outcomes: {
    key: string;
    label: string;
    team?: string;
    logo?: string;
    color: string;
    probability: number;
    series: { t: number; p: number }[];
  }[];
  format: {
    competitionKind: string;
    stageKind: string;
    stageLabel: string;
    leg: number | null;
    marketIntent: "match_result" | "to_qualify";
    outcomeMode: "two_way" | "three_way";
    drawAllowed: boolean;
    decisive: boolean;
    resolutionBasis: string;
  };
  liveState?: unknown;
  refreshMs: number;
}

interface Position {
  side: string;
  shares: number;
  coins_staked: number;
  market_id: string;
}

// Row shape from /api/tregu/markets — only what grouping needs.
interface HubRow {
  slug: string;
  question: string;
  category: string;
  market_prob: number;
  closes_at: string;
  q_yes: number;
  q_no: number;
  spark?: number[];
  delta7d?: number | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

const QUICK_AMOUNTS = [10, 25, 50, 100];

function tradeThemeColor(market: MarketDetail, footballColor?: string, f1Color?: string): string {
  if (footballColor) return footballColor;
  if (f1Color) return f1Color.startsWith("#") ? f1Color : `#${f1Color}`;
  return getCategoryColor(normalizeCategory(market.category));
}

function tradeSurfaceFinish(
  selection: string,
  team: string | undefined,
  sportTheme: "football" | "f1" | "basketball" | undefined
): MobileTradeReceipt["finish"] {
  const identity = `${selection} ${team ?? ""}`.toLowerCase();
  if (/real madrid/.test(identity)) return "gloss";
  if (/chelsea/.test(identity)) return "standard";
  if (/ferrari|red bull/.test(identity)) return "speed";
  if (/mercedes|mclaren|aston martin|alpine/.test(identity)) return "carbon";
  if (sportTheme === "basketball") return "parquet";
  if (sportTheme === "f1") return "metallic";
  if (sportTheme !== "football") return "standard";

  const finishes: MobileTradeReceipt["finish"][] = ["standard", "gloss", "metallic", "carbon"];
  const hash = identity.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return finishes[hash % finishes.length];
}

function closesIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Mbyllet për ${days} ${days === 1 ? "ditë" : "ditë"}`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Mbyllet për ${hours} orë`;
  return `Mbyllet për ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function FootballOutcomeMark({
  outcome,
  size,
}: {
  outcome: FootballPayload["outcomes"][number];
  size: number;
}) {
  if (outcome.logo) {
    return (
      // Team identity is decorative beside the visible team name.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="tregu-football-team-logo"
        src={outcome.logo}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  if (outcome.team || !/barazim|draw/i.test(outcome.label)) {
    return (
      <TeamFlag
        team={outcome.team ?? outcome.label}
        label={outcome.label}
        size={size}
        radius={Math.max(7, Math.round(size * .26))}
      />
    );
  }
  return <span className="tregu-football-draw-mark" style={{ background: outcome.color }} aria-hidden />;
}

function RelatedMarketMark({ market }: { market: MiniMarket }) {
  const teamOutcomes = (market.sportOutcomes ?? [])
    .filter((outcome) => outcome.logo && !/barazim|draw/i.test(`${outcome.key} ${outcome.label}`))
    .slice(0, 2);

  if (teamOutcomes.length === 2) {
    return (
      <span className="tregu-rel-matchup" aria-hidden>
        {teamOutcomes.map((outcome, index) => (
          <span className="tregu-rel-matchup-part" key={outcome.key}>
            {index === 1 && <span className="tregu-rel-versus">VS</span>}
            {/* The full matchup is already named by the adjacent question. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tregu-rel-team-logo"
              src={outcome.logo}
              alt=""
              width={26}
              height={26}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </span>
        ))}
      </span>
    );
  }

  return (
    <TeamFlag
      team={parseEvent(market.question)?.outcome ?? market.question}
      size={34}
      radius={10}
      label={market.question}
    />
  );
}

function recordedPoint(timestamp: string | null | undefined, probability: number): { t: number; p: number }[] {
  const t = timestamp ? new Date(timestamp).getTime() : NaN;
  return Number.isFinite(t) && Number.isFinite(probability) ? [{ t, p: probability }] : [];
}

export default function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [trades, setTrades] = useState<MarketTrade[]>([]);
  const [activity, setActivity] = useState<MarketTrade[]>([]);
  const [related, setRelated] = useState<MiniMarket[]>([]);
  const [weeklyDelta, setWeeklyDelta] = useState<number | null>(null);
  const [tradeCount, setTradeCount] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [group, setGroup] = useState<MarketGroup | null>(null);
  const [eventData, setEventData] = useState<{ title: string; outcomes: EventOutcome[] } | null>(null);
  const [f1, setF1] = useState<F1Payload | null>(null);
  const [football, setFootball] = useState<FootballPayload | null>(null);
  const [footballOutcomeKey, setFootballOutcomeKey] = useState("");
  const [f1OutcomeKey, setF1OutcomeKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<Side>("PO");
  const [amountInput, setAmountInput] = useState("10");
  const amount = Number(amountInput);
  const setAmount = useCallback((value: number | string) => {
    const next = String(value);
    if (next === "" || /^\d*(?:\.\d*)?$/.test(next)) setAmountInput(next);
  }, []);
  const [sellShares, setSellShares] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [tradeMsg, setTradeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const [purchaseReceipt, setPurchaseReceipt] = useState<MobileTradeReceipt | null>(null);
  const lastSuccessfulLoad = useRef(0);
  const closeMobileTrade = useCallback(() => setMobileTradeOpen(false), []);
  const dismissPurchaseReceipt = useCallback(() => setPurchaseReceipt(null), []);

  // /tregu/demo renders the full trading interface from local sample data —
  // dev-only design preview, no DB market needed.
  const demo = isDemoEnabled && slug.startsWith(DEMO_SLUG);

  const load = useCallback(() => {
    if (demo) {
      const d = demoDetail(slug);
      setMarket(d.market as MarketDetail);
      setSnapshots(d.snapshots);
      setTrades(d.trades);
      setActivity(d.activity);
      setRelated(d.related);
      setWeeklyDelta(d.weeklyDelta);
      setTradeCount(d.tradeCount);
      setPositions(d.positions);
      // Demo social fixtures — design preview for the tabs.
      setHolders([
        { name: "Arbnor K.", side: "PO", shares: 240, coinsStaked: 132 },
        { name: "Elira", side: "PO", shares: 155, coinsStaked: 96 },
        { name: "Driton88", side: "JO", shares: 210, coinsStaked: 88 },
        { name: "Vesa M.", side: "JO", shares: 74, coinsStaked: 41 },
        { name: "Gent", side: "PO", shares: 52, coinsStaked: 30 },
      ]);
      setComments([
        {
          id: "demo-c1",
          name: "Arbnor K.",
          body: "Sondazhet e fundit tregojnë rritje të qartë — PO duket i fortë këtu.",
          createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
        },
        {
          id: "demo-c2",
          name: "Driton88",
          body: "Mos harroni çfarë ndodhi herën e kaluar, tregu po e mbivlerëson.",
          createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
        },
      ]);
      setGroup(groupForSlug(demoEventMinis(), slug));
      setFootball(null);
      lastSuccessfulLoad.current = Date.now();
      setLoading(false);
      return;
    }
    fetch(`/api/tregu/markets/${slug}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setNotFound(true);
          return;
        }
        setMarket(d.market);
        setEventData(d.event ?? null);
        const nextFootball = (d.football ?? null) as FootballPayload | null;
        setFootball(nextFootball);
        setFootballOutcomeKey((current) => {
          if (!nextFootball?.outcomes?.length) return "";
          const requested = new URLSearchParams(window.location.search).get("rezultati");
          if (requested && nextFootball.outcomes.some((outcome) => outcome.key === requested)) {
            return requested;
          }
          if (nextFootball.outcomes.some((outcome) => outcome.key === current)) return current;
          return [...nextFootball.outcomes].sort((a, b) => b.probability - a.probability)[0]?.key ?? "";
        });
        const nextF1 = (d.f1 ?? null) as F1Payload | null;
        setF1(nextF1);
        setF1OutcomeKey((current) => {
          if (!nextF1?.outcomes?.length) return "";
          if (nextF1.outcomes.some((driver) => driver.key === current)) return current;
          return [...nextF1.outcomes].sort((a, b) => b.probability - a.probability)[0]?.key ?? "";
        });
        setSnapshots(d.snapshots ?? []);
        setTrades(d.trades ?? []);
        setActivity(d.activity ?? []);
        setRelated(d.related ?? []);
        setWeeklyDelta(d.weeklyDelta ?? null);
        setTradeCount(d.tradeCount ?? 0);
        setPositions(Array.isArray(d.position) ? d.position : []);
        setHolders(d.holders ?? []);
        setComments(d.comments ?? []);
        lastSuccessfulLoad.current = Date.now();
      })
      .finally(() => setLoading(false));
    // Sibling outcome books ("<Ngjarja>: <Rezultati>?") live in the hub list —
    // when this market belongs to a multi-outcome event, render the event view.
    // status=all so the event layout survives after the markets close: the hub
    // API defaults to open-only, which made closed events collapse back into
    // the plain single-market page.
    fetch("/api/tregu/markets?status=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: HubRow[] = d?.markets ?? [];
        setGroup(
          groupForSlug(
            rows.map((m) => ({
              slug: m.slug,
              question: m.question,
              category: m.category,
              prob: m.market_prob,
              volume: (m.q_yes ?? 0) + (m.q_no ?? 0),
              closesAt: m.closes_at,
              spark: m.spark,
              delta7d: m.delta7d,
            })),
            slug
          )
        );
      })
      .catch(() => {});
  }, [slug, demo]);

  const loadLive = useCallback(() => {
    if (demo) return;
    fetch(`/api/tregu/markets/${encodeURIComponent(slug)}/live?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.market) return;
        setMarket((current) => current ? { ...current, ...data.market } : current);
        setSnapshots(data.snapshots ?? []);
        const probabilities = (data.probabilities ?? {}) as Record<string, number>;
        setFootball((current) => current ? {
          ...current,
          liveState: data.liveState ?? current.liveState,
          outcomes: current.outcomes.map((outcome) => ({ ...outcome, probability: Number(probabilities[outcome.key] ?? outcome.probability) })),
        } : current);
        setF1((current) => current ? {
          ...current,
          timing: data.timing ?? current.timing,
          history: data.f1History?.length ? data.f1History : current.history,
          outcomes: current.outcomes.map((outcome) => ({ ...outcome, probability: Number(probabilities[outcome.key] ?? outcome.probability) })),
        } : current);
        lastSuccessfulLoad.current = Date.now();
      })
      .catch(() => {});
  }, [slug, demo]);

  const refreshBalance = useCallback(() => {
    fetch("/api/tregu/portfolio")
      .then((r) => r.json())
      .then((d) => setBalance(d.profile?.coins ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // Card PO/JO buttons deep-link with ?ana=po|jo to pre-select the side.
    const ana = new URLSearchParams(window.location.search).get("ana");
    if (ana === "po") setSide("PO");
    if (ana === "jo") setSide("JO");
    if (demo) {
      // Fake session so the trade panel renders instead of the login prompt.
      setUser({ id: "demo" });
      setBalance(500);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) refreshBalance();
    });
  }, [slug, load, refreshBalance, demo]);

  const autoRefreshMs = market?.category === "sport" ? 1_000 : 300_000;

  // The browser polls only the lightweight persisted-state endpoint. The
  // official worker still writes snapshots only when verified inputs change.
  // Returning to a stale background tab also refreshes immediately.
  useEffect(() => {
    if (demo) return;
    const id = window.setInterval(loadLive, autoRefreshMs);
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastSuccessfulLoad.current >= autoRefreshMs
      ) {
        loadLive();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadLive, demo, autoRefreshMs]);

  const heldOn = (s: Side) => positions.find((p) => p.side === s && p.shares > 0);
  const held = heldOn(side);
  const footballHeldOn = (outcomeKey: string) =>
    positions.find(
      (position) =>
        position.side.toLowerCase() === outcomeKey.toLowerCase() &&
        Number(position.shares) > 0
    );
  const footballHeld = footballOutcomeKey
    ? footballHeldOn(footballOutcomeKey)
    : undefined;
  const footballPositions = football
    ? positions.filter((position) =>
        football.outcomes.some(
          (outcome) =>
            outcome.key.toLowerCase() === position.side.toLowerCase() &&
            Number(position.shares) > 0
        )
      )
    : [];

  const showPurchaseReceipt = (sharesBought?: number) => {
    if (!market) return;
    const footballChoice = football?.outcomes.find((outcome) => outcome.key === footballOutcomeKey);
    const f1Choice = f1?.outcomes.find((driver) => driver.key === f1OutcomeKey);
    const binaryPreview = !football && !f1
      ? previewBet({ q_yes: market.q_yes, q_no: market.q_no, b: market.b }, side, amount)
      : null;
    const sportPreview = (footballChoice || f1Choice) && market.sport_outcomes && market.outcome_quantities
      ? previewSportOutcomeBet(
          {
            sport_outcomes: market.sport_outcomes,
            outcome_quantities: market.outcome_quantities,
            b: market.b,
          },
          footballChoice?.key ?? f1Choice?.key ?? "",
          amount
        )
      : null;
    const selection = footballChoice?.label ?? f1Choice?.label ?? side;
    const probability = footballChoice?.probability ?? f1Choice?.probability ?? (side === "PO" ? market.market_prob : 1 - market.market_prob);
    const potentialReturn = Number(sharesBought) || sportPreview?.shares || binaryPreview?.shares || amount;
    setPurchaseReceipt({
      market: market.question,
      selection,
      coins: amount,
      potentialReturn,
      probability,
      color: tradeThemeColor(market, footballChoice?.color, f1Choice?.team_colour),
      imageUrl: footballChoice?.logo ?? f1Choice?.headshot_url,
      finish: tradeSurfaceFinish(selection, footballChoice?.team ?? f1Choice?.team, sportTheme),
      soundProfile: resolveTradeSuccessSoundProfile({
        sportTheme,
        league: market.live_event?.league,
      }),
    });
    setMobileTradeOpen(false);
  };

  const submitTrade = async () => {
    if (!market) return;
    if (market.status !== "open") {
      setTradeMsg({ ok: false, text: "Ky treg është mbyllur." });
      return;
    }
    if (mode === "buy") {
      const identity = `${market.live_event?.sport ?? ""} ${market.live_event?.league ?? ""} ${market.market_type ?? ""}`.toLowerCase();
      const successSportTheme = f1 || /formula|\bf1\b|racing/.test(identity)
        ? "f1"
        : /basket|\bnba\b|\bfbk\b/.test(identity)
          ? "basketball"
          : football || market.category === "sport"
            ? "football"
            : undefined;
      primeTradeSuccessSound(resolveTradeSuccessSoundProfile({ sportTheme: successSportTheme, league: market.live_event?.league }));
    }
    if (mode === "buy" && (!Number.isFinite(amount) || amount <= 0 || (balance !== null && amount > balance))) {
      setTradeMsg({
        ok: false,
        text: balance !== null && amount > balance
          ? "Shuma është më e madhe se bilanci yt."
          : "Shkruaj një shumë më të madhe se zero.",
      });
      return;
    }
    if (demo) {
      if (mode === "buy") showPurchaseReceipt();
      setTradeMsg({ ok: true, text: "Treg demonstrimi — ky veprim nuk ndryshon bilancin tënd." });
      return;
    }
    setPlacing(true);
    setTradeMsg(null);
    if (football) {
      const selectedOutcome = football.outcomes.find((outcome) => outcome.key === footballOutcomeKey);
      if (!selectedOutcome) {
        setTradeMsg({
          ok: false,
          text: football.format.marketIntent === "to_qualify"
            ? "Zgjidh skuadrën që mendon se do të kualifikohet."
            : "Zgjidh një rezultat para se të vendosësh bastin.",
        });
        setPlacing(false);
        return;
      }
      if (mode === "buy") {
        const res = await fetch("/api/tregu/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: market.id,
            kind: "sport_outcome",
            outcomeKey: selectedOutcome.key,
            coins: amount,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          track("tregu_trade", { side: "buy", kind: "sport_outcome", marketId: market.id, coins: amount });
          setTradeMsg({
            ok: true,
            text: `Basti u vendos te ${selectedOutcome.label} për ${amount} 383C.`,
          });
          showPurchaseReceipt(Number(data.sharesBought));
          load();
          refreshBalance();
        } else {
          setTradeMsg({ ok: false, text: data.error ?? "Gabim" });
        }
      } else {
        const position = footballHeldOn(selectedOutcome.key);
        if (!position || sellShares <= 0) {
          setTradeMsg({ ok: false, text: `Nuk ke aksione të ${selectedOutcome.label} për të shitur.` });
          setPlacing(false);
          return;
        }
        const shares = Math.min(sellShares, Number(position.shares));
        const res = await fetch("/api/tregu/sell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: market.id,
            kind: "sport_outcome",
            outcomeKey: selectedOutcome.key,
            shares,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          track("tregu_trade", { side: "sell", kind: "sport_outcome", marketId: market.id, shares });
          setTradeMsg({
            ok: true,
            text: `Shite ${shares.toFixed(2)} aksione të ${selectedOutcome.label} për ${Number(data.coinsReceived ?? 0).toFixed(1)} 383C.`,
          });
          setSellShares(0);
          setMobileTradeOpen(false);
          load();
          refreshBalance();
        } else {
          setTradeMsg({ ok: false, text: data.error ?? "Gabim" });
        }
      }
      setPlacing(false);
      return;
    }
    if (f1) {
      if (!f1OutcomeKey) {
        setTradeMsg({ ok: false, text: "Zgjidh një pilot para se të vendosësh bastin." });
        setPlacing(false);
        return;
      }
      const selectedDriver = f1.outcomes.find((driver) => driver.key === f1OutcomeKey);
      if (mode === "buy") {
        const res = await fetch("/api/tregu/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: market.id,
            kind: "f1_race_winner",
            outcomeKey: f1OutcomeKey,
            coins: amount,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          track("tregu_trade", { side: "buy", kind: "f1_race_winner", marketId: market.id, coins: amount });
          setTradeMsg({
            ok: true,
            text: `Basti u vendos te ${selectedDriver?.label ?? f1OutcomeKey} për ${amount} 383C.`,
          });
          showPurchaseReceipt(Number(data.sharesBought));
          load();
          refreshBalance();
        } else {
          setTradeMsg({ ok: false, text: data.error ?? "Gabim" });
        }
      } else {
        const position = footballHeldOn(f1OutcomeKey);
        if (!position || sellShares <= 0) {
          setTradeMsg({ ok: false, text: `Nuk ke aksione të ${selectedDriver?.label ?? f1OutcomeKey} për të shitur.` });
          setPlacing(false);
          return;
        }
        const shares = Math.min(sellShares, Number(position.shares));
        const res = await fetch("/api/tregu/sell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: market.id,
            kind: "f1_race_winner",
            outcomeKey: f1OutcomeKey,
            shares,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          track("tregu_trade", { side: "sell", kind: "f1_race_winner", marketId: market.id, shares });
          setTradeMsg({ ok: true, text: `Shite ${shares.toFixed(2)} aksione të ${selectedDriver?.label ?? f1OutcomeKey} për ${Number(data.coinsReceived ?? 0).toFixed(1)} 383C.` });
          setSellShares(0);
          setMobileTradeOpen(false);
          load();
          refreshBalance();
        } else {
          setTradeMsg({ ok: false, text: data.error ?? "Gabim" });
        }
      }
      setPlacing(false);
      return;
    }
    if (mode === "buy") {
      const res = await fetch("/api/tregu/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, side, coins: amount }),
      });
      const data = await res.json();
      if (res.ok) {
        track("tregu_trade", { side: "buy", kind: "binary", marketId: market.id, coins: amount });
        setTradeMsg({ ok: true, text: `✓ Bleve ${data.sharesBought?.toFixed(2)} aksione ${side} për ${amount} 383C` });
        showPurchaseReceipt(Number(data.sharesBought));
        load();
        refreshBalance();
      } else {
        setTradeMsg({ ok: false, text: data.error ?? "Gabim" });
      }
    } else {
      const res = await fetch("/api/tregu/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, side, shares: sellShares }),
      });
      const data = await res.json();
      if (res.ok) {
        track("tregu_trade", { side: "sell", kind: "binary", marketId: market.id, shares: sellShares });
        setTradeMsg({ ok: true, text: `✓ Shite ${sellShares.toFixed(2)} aksione ${side} për ${Number(data.coinsReceived ?? 0).toFixed(1)} 383C` });
        setSellShares(0);
        setMobileTradeOpen(false);
        load();
        refreshBalance();
      } else {
        setTradeMsg({ ok: false, text: data.error ?? "Gabim" });
      }
    }
    setPlacing(false);
  };

  if (loading) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <div style={{ padding: "140px 24px", textAlign: "center", color: "#6B6B6B" }}>Duke ngarkuar...</div>
      </div>
    );
  }

  if (notFound || !market) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <div style={{ padding: "140px 24px", textAlign: "center" }}>
          <p>Ky treg nuk ekziston ose nuk është ende aktiv.</p>
          <Link href="/tregu" style={{ color: "#00A651" }}>
            ← Kthehu te Tregu
          </Link>
        </div>
      </div>
    );
  }

  const latestEvidence = [...snapshots].reverse().find((s) => s.evidence && s.evidence.length > 0)?.evidence ?? [];
  const currentOutcome = group?.outcomes.find((o) => o.slug === slug) ?? null;
  const footballSelectedOutcome =
    football?.outcomes.find((outcome) => outcome.key === footballOutcomeKey) ??
    (football ? [...football.outcomes].sort((a, b) => b.probability - a.probability)[0] : undefined);
  const f1SelectedDriver =
    f1?.outcomes.find((driver) => driver.key === f1OutcomeKey) ??
    (f1 ? [...f1.outcomes].sort((a, b) => b.probability - a.probability)[0] : undefined);
  // Grouped events trade in outcome language, not raw PO/JO:
  // PO → "Barazim", JO → "Jo Barazim".
  const sideLabel = (s: Side) =>
    currentOutcome ? (s === "PO" ? currentOutcome.label : `Jo ${currentOutcome.label}`) : s;
  const eventOutcomeBySlug = new Map((eventData?.outcomes ?? []).map((outcome) => [outcome.slug, outcome]));
  // Public event charts use persisted timestamps only. The local demo keeps its
  // existing, explicitly scripted fixture so the design preview remains useful.
  const eventSeriesFor = (o: GroupOutcome): { t: number; p: number }[] => {
    if (demo) {
      const sim = demoMatchSeries(o.slug);
      if (sim) return sim;
    }
    return eventOutcomeBySlug.get(o.slug)?.series ?? [];
  };
  const currentPrice = lmsrPriceYes(market.q_yes, market.q_no, market.b);
  const sidePrice = side === "PO" ? currentPrice : 1 - currentPrice;
  const pct = Math.round(
    (footballSelectedOutcome?.probability ?? f1SelectedDriver?.probability ?? market.market_prob) * 100
  );
  const isClosed = market.status !== "open";
  const volume = Math.round(market.q_yes + market.q_no);
  const deltaPp = weeklyDelta === null ? null : Math.round(weeklyDelta * 100);
  const weeklyStart = weeklyDelta === null
    ? null
    : Math.round(Math.max(0, Math.min(1, market.market_prob - weeklyDelta)) * 100);
  const closesMs = market.closes_at ? new Date(market.closes_at).getTime() : NaN;
  const closesDateLabel = Number.isNaN(closesMs)
    ? null
    : formatKosovoDate(closesMs);

  const buyPreview =
    !football && mode === "buy" && amount > 0
      ? previewBet({ q_yes: market.q_yes, q_no: market.q_no, b: market.b }, side, amount)
      : null;
  const sellPreview =
    mode === "sell" && sellShares > 0
      ? previewSell({ q_yes: market.q_yes, q_no: market.q_no, b: market.b }, side, sellShares)
      : null;
  const impactPp =
    buyPreview !== null
      ? Math.abs(buyPreview.newPriceYes - currentPrice) * 100
      : sellPreview !== null
        ? Math.abs(sellPreview.newPriceYes - currentPrice) * 100
        : 0;
  const priceAfterTradeYes = buyPreview?.newPriceYes ?? sellPreview?.newPriceYes ?? currentPrice;
  const sidePriceAfterTrade = side === "PO" ? priceAfterTradeYes : 1 - priceAfterTradeYes;
  const potentialProfit = buyPreview ? buyPreview.shares - amount : 0;
  const roi = buyPreview && amount > 0 ? (potentialProfit / amount) * 100 : 0;
  const footballPreview =
    football && mode === "buy" && footballSelectedOutcome && market.sport_outcomes && market.outcome_quantities
      ? previewSportOutcomeBet(
          {
            sport_outcomes: market.sport_outcomes,
            outcome_quantities: market.outcome_quantities,
            b: market.b,
          },
          footballSelectedOutcome.key,
          amount
        )
      : null;
  const footballSellPreview =
    football &&
    mode === "sell" &&
    footballSelectedOutcome &&
    market.sport_outcomes &&
    market.outcome_quantities &&
    sellShares > 0
      ? previewSportOutcomeSell(
          {
            sport_outcomes: market.sport_outcomes,
            outcome_quantities: market.outcome_quantities,
            b: market.b,
          },
          footballSelectedOutcome.key,
          sellShares
        )
      : null;
  const f1Held = f1OutcomeKey ? footballHeldOn(f1OutcomeKey) : undefined;
  const f1Preview =
    f1 && mode === "buy" && f1SelectedDriver && market.sport_outcomes && market.outcome_quantities
      ? previewSportOutcomeBet(
          {
            sport_outcomes: market.sport_outcomes,
            outcome_quantities: market.outcome_quantities,
            b: market.b,
          },
          f1SelectedDriver.key,
          amount
        )
      : null;
  const f1SellPreview =
    f1 && mode === "sell" && f1SelectedDriver && market.sport_outcomes && market.outcome_quantities && sellShares > 0
      ? previewSportOutcomeSell(
          {
            sport_outcomes: market.sport_outcomes,
            outcome_quantities: market.outcome_quantities,
            b: market.b,
          },
          f1SelectedDriver.key,
          sellShares
        )
      : null;

  const canBuy = !placing && amount > 0 && (balance === null || amount <= balance);
  const canSell = !placing && sellShares > 0 && Boolean(held);
  const canSellFootball =
    !placing &&
    sellShares > 0 &&
    Boolean(footballHeld) &&
    sellShares <= Number(footballHeld?.shares ?? 0);
  const canSellF1 =
    !placing &&
    sellShares > 0 &&
    Boolean(f1Held) &&
    sellShares <= Number(f1Held?.shares ?? 0);

  // Race grids (every outcome has a registry headshot) swap the mini-chart
  // grid for a live timing board ranked by the odds.
  const raceField = Boolean(group && group.outcomes.every((o) => outcomeMediaFor(o.label)?.photo));
  const isSportDetail = market.category === "sport" || Boolean(football || f1);
  const detailTone: "sport" | "serious" = isSportDetail ? "sport" : "serious";
  const sportBrandKey = f1 ? "f1" : market.live_event?.league ?? null;
  const sportIdentity = `${market.live_event?.sport ?? ""} ${market.live_event?.league ?? ""} ${market.market_type ?? ""}`.toLowerCase();
  const sportTheme = f1 || /formula|\bf1\b|racing/.test(sportIdentity)
    ? "f1"
    : /basket|\bnba\b|\bfbk\b/.test(sportIdentity)
      ? "basketball"
      : isSportDetail
        ? "football"
        : undefined;
  const headerFootballOutcomes = football?.outcomes
    .filter((outcome) => !/barazim|draw/i.test(`${outcome.key} ${outcome.label}`))
    .slice(0, 2) ?? [];
  const headerTitle = group && currentOutcome ? group.title : market.question;
  const headerSelection = footballSelectedOutcome?.label ?? f1SelectedDriver?.label ?? currentOutcome?.label ?? sideLabel("PO");
  const sportResolutionRules = sportTheme === "f1"
    ? "Tregu zgjidhet sipas klasifikimit zyrtar të garës pas përfundimit të saj."
    : sportTheme === "basketball"
      ? "Tregu zgjidhet sipas rezultatit zyrtar pas përfundimit të ndeshjes."
      : "Tregu zgjidhet sipas rezultatit zyrtar pas 90 minutave, përveç kur pyetja e tregut përcakton qartë një format tjetër.";
  const sportResolutionSource = sportTheme === "f1"
    ? "Klasifikimi zyrtar i garës"
    : "Rezultati zyrtar i ndeshjes";
  // Per-category chart accent (blue Politikë, green Ekonomi, gold Botë…).
  const chartCategory = SLUG_TO_CATEGORY[market.category] ?? market.category;
  const marketChartSeries = [{
    key: market.id,
    label: sideLabel("PO"),
    color: getCategoryColor(chartCategory),
    points: [
      ...snapshots.flatMap((snapshot) => recordedPoint(snapshot.created_at, snapshot.market_prob)),
      ...trades.flatMap((trade) => recordedPoint(trade.created_at, trade.price_yes)),
      ...recordedPoint(market.updated_at, market.market_prob),
    ],
    current: market.market_prob,
  }];

  const binaryTheme = tradeThemeColor(market);
  const mobileTradeOptions: MobileTradeOption[] = football
    ? football.outcomes.map((outcome) => ({
        key: outcome.key,
        label: outcome.label,
        probability: outcome.probability,
        color: outcome.color,
        imageUrl: outcome.logo,
        heldShares: Number(footballHeldOn(outcome.key)?.shares ?? 0),
      }))
    : f1
      ? f1.outcomes.map((driver) => ({
          key: driver.key,
          label: driver.label,
          probability: driver.probability,
          color: tradeThemeColor(market, undefined, driver.team_colour),
          imageUrl: driver.headshot_url,
          heldShares: Number(footballHeldOn(driver.key)?.shares ?? 0),
        }))
      : (["PO", "JO"] as Side[]).map((optionSide) => ({
          key: optionSide,
          label: sideLabel(optionSide),
          probability: optionSide === "PO" ? currentPrice : 1 - currentPrice,
          color: binaryTheme,
          heldShares: Number(heldOn(optionSide)?.shares ?? 0),
        }));
  const mobileSelectedKey = football ? footballOutcomeKey : f1 ? f1OutcomeKey : side;
  const mobileHeld = mobileTradeOptions.find((option) => option.key === mobileSelectedKey)?.heldShares ?? 0;
  const mobileSellEnabled = !isClosed && mobileTradeOptions.some((option) => Number(option.heldShares ?? 0) > 0);
  const mobileBuyReturn = football ? footballPreview?.shares ?? null : f1 ? f1Preview?.shares ?? null : buyPreview?.shares ?? null;
  const mobileSellReturn = football ? footballSellPreview?.coins ?? null : f1 ? f1SellPreview?.coins ?? null : sellPreview?.coins ?? null;

  const selectMobileTradeOption = (key: string, nextMode: MobileTradeMode = mode) => {
    if (football) setFootballOutcomeKey(key);
    else if (f1) setF1OutcomeKey(key);
    else setSide(key as Side);
    if (nextMode === "sell") setSellShares(Number(footballHeldOn(key)?.shares ?? heldOn(key as Side)?.shares ?? 0));
    setTradeMsg(null);
  };

  const changeMobileTradeMode = (nextMode: MobileTradeMode) => {
    setMode(nextMode);
    setTradeMsg(null);
    if (nextMode === "sell") {
      const firstHeld = mobileTradeOptions.find((option) => Number(option.heldShares ?? 0) > 0);
      if (firstHeld) selectMobileTradeOption(firstHeld.key, nextMode);
    }
  };

  const openMobileTrade = (nextMode: MobileTradeMode) => {
    changeMobileTradeMode(nextMode);
    setMobileTradeOpen(true);
  };

  const normalizedGroupHistory = normalizeRecordedOutcomeSeries(
    (group?.outcomes ?? []).map((outcome) => ({
      key: outcome.slug,
      points: eventSeriesFor(outcome),
    }))
  );
  const groupedChartSeries = (group?.outcomes ?? []).map((outcome) => {
    return {
      key: outcome.slug,
      label: outcome.label,
      color: outcome.color,
      points: normalizedGroupHistory[outcome.slug] ?? [],
      current: outcome.prob,
    };
  });

  // Registered head-to-head stat sheet for this event (null when none exists).
  const fallbackEventStats = group ? eventStatsFor(group.title) : null;
  const live = (football?.liveState ?? market.live_score_state) as {
    status?: string;
    detail?: string;
    competitors?: Array<{ team?: string; homeAway?: string; score?: number }>;
    metrics?: Record<string, Record<string, number>>;
  } | null;
  const liveTeams = live?.competitors ?? [];
  const homeTeam =
    liveTeams.find((competitor) => competitor.homeAway === "home") ??
    liveTeams[0] ??
    { team: market.live_event?.home_team, score: 0 };
  const awayTeam =
    liveTeams.find((competitor) => competitor.homeAway === "away") ??
    liveTeams[1] ??
    { team: market.live_event?.away_team, score: 0 };
  const homeName = homeTeam.team ?? "Vendasit";
  const awayName = awayTeam.team ?? "Mysafirët";
  const homeMetrics = live?.metrics?.[homeName] ?? {};
  const awayMetrics = live?.metrics?.[awayName] ?? {};
  const liveMetricRows = buildFootballMetricRows(homeMetrics, awayMetrics);
  const liveStats = live?.status !== "STATUS_SCHEDULED" && liveMetricRows.length > 0 && (football || group) ? {
    home: homeName,
    away: awayName,
    score: `${Number(homeTeam.score ?? 0)} - ${Number(awayTeam.score ?? 0)}`,
    note: `LIVE ${live?.detail ?? ""}`.trim(),
    rows: liveMetricRows,
  } : null;
  const eventStats = liveStats ?? (live?.status === "STATUS_SCHEDULED" ? null : fallbackEventStats);

  return (
    <div className="tregu-scope" data-sport-theme={sportTheme}>
      <Navbar />
      {/* Left-anchored container — Polymarket-style, not centered. */}
      <main
        className="tregu-detail-main"
        data-auto-refresh-ms={autoRefreshMs}
        data-sport-theme={sportTheme}
        style={{ maxWidth: 1560, margin: 0, padding: "96px 32px 80px 32px" }}
      >
        <StickyMarketBack />

        {/* ── Header: market context + question + verified ticker row ── */}
        <header className="tregu-detail-header" data-tone={detailTone} data-sport-theme={sportTheme}>
          <div className="tregu-detail-header-grid">
            <div className="tregu-detail-header-copy">
              <div className="tregu-detail-headline-row">
                <h1
                  className="tregu-detail-title"
                  style={{
                    fontSize: "clamp(24px, 3.2vw, 34px)",
                    fontWeight: 800,
                    margin: 0,
                    lineHeight: 1.16,
                    letterSpacing: "-0.025em",
                    textWrap: "balance",
                    maxWidth: "26ch",
                  }}
                >
                  {headerTitle}
                </h1>
                {isSportDetail && (
                  <div className="tregu-detail-reference" data-sport-theme={sportTheme} aria-label={`Referenca: ${headerSelection}`}>
                    {football && headerFootballOutcomes.length > 0 ? (
                      headerFootballOutcomes.map((outcome) => <FootballOutcomeMark key={outcome.key} outcome={outcome} size={42} />)
                    ) : f1SelectedDriver && f1DriverHeadshot(f1SelectedDriver.key, f1SelectedDriver.headshot_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f1DriverHeadshot(f1SelectedDriver.key, f1SelectedDriver.headshot_url)} alt="" aria-hidden referrerPolicy="no-referrer" />
                    ) : sportBrandKey ? (
                      <SportBrandMark brandKey={sportBrandKey} size="md" />
                    ) : null}
                  </div>
                )}
              </div>
              <div className="tregu-detail-meta-row" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                {isSportDetail && sportBrandKey ? <SportBrandMark brandKey={sportBrandKey} size="md" /> : null}
                <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
                {market.status === "resolved" && (
                  <span className="tregu-pill" style={{ color: market.outcome === "PO" ? "#00854A" : "#C51518" }}>
                    U zgjidh: {market.outcome}
                  </span>
                )}
                {market.status === "closed" && <span className="tregu-pill">Mbyllur</span>}
                {market.status === "open" && <span className="tregu-pill">{closesIn(market.closes_at)}</span>}
                {/* Permanent way back into the walkthrough once it has been dismissed. */}
                <button type="button" className="tregu-home-help" onClick={openTradeTutorial}>
                  <span aria-hidden>?</span>
                  Si funksionon
                </button>
              </div>
              {group && currentOutcome && (
                <nav className="tregu-event-tabs" aria-label="Rezultatet e ngjarjes">
                  {group.outcomes.map((o) => (
                    <Link
                      key={o.slug}
                      href={`/tregu/${o.slug}`}
                      className="tregu-event-tab"
                      data-active={o.slug === slug}
                      aria-current={o.slug === slug ? "page" : undefined}
                    >
                      {group.category === "sport" ? (
                        <TeamFlag team={o.label} size={20} radius={6} label={o.label} />
                      ) : (
                        <span className="tregu-gchart-chip-dot" style={{ background: o.color }} />
                      )}
                      {o.label} · {Math.round(o.prob * 100)}%
                    </Link>
                  ))}
                </nav>
              )}
              {market.description && !isSportDetail && (
                <p style={{ color: "#555555", fontSize: 14, margin: "0 0 14px", maxWidth: "70ch", lineHeight: 1.55 }}>
                  {market.description}
                </p>
              )}
              <div className="tregu-detail-quickfacts" style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "12px 22px" }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "#111111", fontVariantNumeric: "tabular-nums" }}>
                    {pct}%
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#6B6B6B" }}>
                    {footballSelectedOutcome
                      ? `gjasa ${footballSelectedOutcome.label}`
                      : f1SelectedDriver
                        ? `gjasa ${f1SelectedDriver.label}`
                        : currentOutcome
                          ? `gjasa ${currentOutcome.label}`
                          : "gjasa PO"}
                  </span>
                </span>
                {!f1 && !football && deltaPp !== null && deltaPp !== 0 && (
                  <span className="tregu-delta-chip" data-dir={deltaPp > 0 ? "up" : "down"}>
                    Këtë javë: {weeklyStart}% → {Math.round(market.market_prob * 100)}%
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: "#555555", fontVariantNumeric: "tabular-nums" }}>
                  {fmtNum(volume)} 383C vëllim · {fmtNum(tradeCount)} tregtime
                  {closesDateLabel ? ` · ${isClosed ? "u mbyll" : "mbyllet"} ${closesDateLabel}` : ""}
                </span>
                <MarketShareActions
                  slug={slug}
                  title={headerTitle}
                  selection={headerSelection}
                  probability={pct / 100}
                  volume={volume}
                  accent={tradeThemeColor(market, footballSelectedOutcome?.color, f1SelectedDriver?.team_colour)}
                />
              </div>
            </div>
            {detailTone === "serious" ? <MarketContextMedia media={market.market_media} variant="detail" /> : null}
          </div>
        </header>

        {/* ── 2-col: chart + social tabs | bet slip + AI signal + rules ── */}
        <div className="tregu-detail-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {football ? (
              <>
                <section
                  className="tregu-panel tregu-football-market tregu-detail-chart-shell"
                  data-tone="sport"
                  data-sport-theme="football"
                  data-football-live-chart
                  data-football-market-ui-version={FOOTBALL_MARKET_UI_VERSION}
                  data-outcome-count={football.outcomes.length}
                  data-market-intent={football.format.marketIntent}
                  data-draw-allowed={football.format.drawAllowed}
                  style={{ padding: 28 }}
                  aria-label={football.format.marketIntent === "to_qualify" ? "Gjasat live të kualifikimit" : "Gjasat live të ndeshjes"}
                >
                  <div className="tregu-football-market-head">
                    <div className="tregu-football-title-row">
                      {sportBrandKey ? <SportBrandMark brandKey={sportBrandKey} size="md" /> : null}
                      <div>
                        <h2>
                          {football.format.marketIntent === "to_qualify"
                            ? "Kush kualifikohet?"
                            : "Gjasat live"}
                        </h2>
                      </div>
                    </div>
                    <div className="tregu-football-meta">
                      <span className="tregu-football-stage">
                        {football.format.stageLabel}
                        {football.format.leg ? ` · Ndeshja ${football.format.leg}` : ""}
                      </span>
                    </div>
                  </div>
                  <div
                    className="tregu-football-legend"
                    data-outcome-count={football.outcomes.length}
                    aria-label={football.format.drawAllowed ? "Rezultatet e ndeshjes" : "Skuadrat që mund të kualifikohen"}
                  >
                    {football.outcomes.map((outcome) => (
                      <button
                        key={outcome.key}
                        type="button"
                        data-active={outcome.key === footballOutcomeKey}
                        onClick={() => {
                          setFootballOutcomeKey(outcome.key);
                          setTradeMsg(null);
                        }}
                      >
                        <FootballOutcomeMark outcome={outcome} size={26} />
                        <strong>{outcome.label}</strong>
                        <b>{(outcome.probability * 100).toFixed(1)}%</b>
                      </button>
                    ))}
                  </div>
                  <ExactMarketChart
                    height={460}
                    showRanges
                    showPulse
                    concise
                    tone="sport"
                    series={football.outcomes.map((outcome) => ({
                      key: outcome.key,
                      label: outcome.label,
                      color: outcome.color,
                      points: outcome.series,
                      current: outcome.probability,
                    }))}
                    ariaLabel={football.format.marketIntent === "to_qualify" ? "Historia e verifikuar e kualifikimit" : "Historia e verifikuar e rezultatit"}
                  />
                </section>
                {eventStats ? <MatchStats {...eventStats} /> : null}
              </>
            ) : f1 ? (
              <F1RaceControl
                marketId={market.id}
                marketOpen={market.status === "open"}
                drivers={f1.outcomes}
                timing={f1.timing}
                history={f1.history}
                selectedDriverKey={f1OutcomeKey}
                onBetDriver={(driverKey) => {
                  setF1OutcomeKey(driverKey);
                  setMode("buy");
                  setTradeMsg(null);
                  requestAnimationFrame(() => {
                    document.getElementById("f1-bet-slip")?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                      block: "center",
                    });
                  });
                }}
              />
            ) : group && currentOutcome ? (
              <>
                {/* Combined event chart — persisted writes only on public routes. */}
                <div className="tregu-panel tregu-detail-chart-shell" data-tone={detailTone} data-sport-theme={sportTheme} style={{ padding: 28 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px" }}>Të gjitha rezultatet</h3>
                  <ExactMarketChart
                    height={460}
                    showRanges
                    showPulse
                    derived
                    tone={detailTone}
                    series={groupedChartSeries}
                    ariaLabel={`Historia e regjistruar për ${group.title}`}
                  />
                </div>
                {/* Beneath the chart: the stat lines behind the price moves —
                    demo matches ship their own fixture, other events pull a
                    registered sheet from tregu-event-stats. */}
                {market?.market_type === "f1_race_winner" ? null : demo ? (
                  <MatchStats {...demoMatchStats()} />
                ) : eventStats ? (
                  <MatchStats {...eventStats} />
                ) : null}
                {/* Below the chart: timing board, or one exact tape per outcome. */}
                <div className="tregu-panel tregu-detail-chart-shell" data-tone={detailTone} data-sport-theme={sportTheme} style={{ padding: 28 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>
                    {raceField ? "Renditja live" : "Gjasat sipas rezultatit"}
                  </h3>
                  {raceField ? (
                    <RaceStandings outcomes={group.outcomes} currentSlug={slug} />
                  ) : (
                    <div className="tregu-omini-grid">
                      {groupedChartSeries.map((outcome) => (
                        <ExactMarketChart
                          key={outcome.key}
                          compact
                          derived
                          height={108}
                          tone={detailTone}
                          series={[outcome]}
                          ariaLabel={`Historia e regjistruar për ${outcome.label}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="tregu-panel tregu-detail-chart-shell" data-tone={detailTone} data-sport-theme={sportTheme} style={{ padding: 28 }}>
                <ExactMarketChart
                  height={460}
                  showRanges
                  showPulse
                  tone={detailTone}
                  series={marketChartSeries}
                  ariaLabel={`Historia e regjistruar për ${market.question}`}
                />
              </div>
            )}

            {/* Komentet | Mbajtësit | Pozicionet | Aktiviteti */}
            <MarketSocial
              marketId={market.id}
              holders={holders}
              comments={comments}
              activity={activity}
              priceYes={currentPrice}
              sideLabel={sideLabel}
              loggedIn={Boolean(user)}
              demo={demo}
            />

            {!isSportDetail && latestEvidence.length > 0 && (
              <div className="tregu-panel" style={{ padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>Bazuar në lajme</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {latestEvidence.map((e, evidenceIndex) => {
                    let host = "383lajme.com";
                    if (e.url) {
                      try {
                        host = new URL(e.url).hostname.replace(/^www\./, "");
                      } catch {
                        host = "383lajme.com";
                      }
                    }
                    // Evidence titles are sometimes blank; fall back to a readable
                    // headline built from the article slug so the card never shows
                    // an empty line.
                    const title =
                      e.title?.trim() ||
                      (e.slug
                        ? e.slug
                            .replace(/-\d{6,}.*$/, "")
                            .replace(/-/g, " ")
                            .replace(/^\w/, (c) => c.toUpperCase())
                        : "Lajm");
                    const initial = (title || host).trim().charAt(0).toUpperCase() || "3";
                    return (
                      <Link
                        key={e.slug || e.url || `${title}-${evidenceIndex}`}
                        href={`/article/${e.slug}`}
                        className="tregu-evidence-item"
                      >
                        <span className="tregu-evidence-thumb">
                          {e.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.imageUrl} alt="" aria-hidden loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                          ) : initial}
                        </span>
                        <span className="tregu-evidence-body">
                          <span className="tregu-evidence-title">{title}</span>
                          <span className="tregu-evidence-src">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            {host}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <aside className="tregu-detail-side">
            <div
              id={f1 ? "f1-bet-slip" : undefined}
              data-football-bet-slip={football ? "" : undefined}
              className="tregu-panel tregu-edge"
              data-cat={market.category}
              data-sport-theme={sportTheme}
              style={{ padding: 28 }}
            >
              {/* Event trade card header: cubic flag avatar + team, plus a
                 switcher — changing team swaps BOTH the name and the flag. */}
              {group && currentOutcome && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <TeamFlag team={currentOutcome.label} size={54} radius={15} label={currentOutcome.label} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", marginBottom: 3 }}>
                        {group.title}
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>{currentOutcome.label}</div>
                    </div>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 24,
                        fontWeight: 800,
                        color: currentOutcome.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Math.round(currentOutcome.prob * 100)}%
                    </span>
                  </div>
                  <nav
                    style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}
                    aria-label="Zgjidh skuadrën"
                  >
                    {group.outcomes.map((o) => (
                      <Link
                        key={o.slug}
                        href={`/tregu/${o.slug}`}
                        className="tregu-team-switch"
                        data-active={o.slug === slug}
                        aria-current={o.slug === slug ? "page" : undefined}
                      >
                        <TeamFlag team={o.label} size={22} radius={7} label={o.label} />
                        <span>{o.label}</span>
                        <span style={{ opacity: 0.72, fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(o.prob * 100)}%
                        </span>
                      </Link>
                    ))}
                  </nav>
                </div>
              )}
              {football && footballSelectedOutcome && (
                <div className="tregu-football-selection">
                  <FootballOutcomeMark outcome={footballSelectedOutcome} size={52} />
                  <span>
                    <small>
                      {football.format.marketIntent === "to_qualify"
                        ? "Kualifikimi i zgjedhur"
                        : "Rezultati i zgjedhur"}
                    </small>
                    <strong>{footballSelectedOutcome.label}</strong>
                  </span>
                  <b style={{ color: footballSelectedOutcome.color }}>
                    {(footballSelectedOutcome.probability * 100).toFixed(1)}%
                  </b>
                </div>
              )}
              {f1 && f1SelectedDriver && (
                <div
                  className="f1-trade-driver"
                  style={{ "--f1-team": f1TeamColor(f1SelectedDriver.team, f1SelectedDriver.team_colour) } as CSSProperties}
                >
                  {f1DriverHeadshot(f1SelectedDriver.key, f1SelectedDriver.headshot_url) ? (
                    <img
                      src={f1DriverHeadshot(f1SelectedDriver.key, f1SelectedDriver.headshot_url)}
                      alt={`Portreti i ${f1SelectedDriver.label}`}
                      decoding="async"
                    />
                  ) : (
                    <span className="f1-driver-fallback" aria-hidden>{f1SelectedDriver.key}</span>
                  )}
                  <span>
                    <strong>{f1SelectedDriver.label}</strong>
                    <small>{f1SelectedDriver.team}</small>
                  </span>
                  <b>{(f1SelectedDriver.probability * 100).toFixed(1)}%</b>
                </div>
              )}
              {!user ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ color: "#6B6B6B", marginBottom: 14 }}>
                    Duhet të krijosh llogari për të tregtuar — merr 100 383 Coin falas.
                  </p>
                  <Link href="/hyr" className="tregu-btn-primary" style={{ padding: "10px 22px", borderRadius: 100, textDecoration: "none", display: "inline-block" }}>
                    Hyr / Regjistrohu
                  </Link>
                </div>
              ) : isClosed ? (
                <p style={{ color: "#6B6B6B", margin: 0 }}>Ky treg nuk pranon më tregtime.</p>
              ) : football ? (
                <>
                  <div className="tregu-football-trade-mode">
                    <div className="tregu-sort" role="tablist" aria-label="Blej ose shit aksione">
                      <button
                        aria-pressed={mode === "buy"}
                        onClick={() => {
                          setMode("buy");
                          setTradeMsg(null);
                        }}
                        type="button"
                      >
                        Blej
                      </button>
                      <button
                        aria-pressed={mode === "sell"}
                        disabled={footballPositions.length === 0}
                        onClick={() => {
                          const firstPosition = footballPositions[0];
                          if (!firstPosition) return;
                          setMode("sell");
                          setTradeMsg(null);
                          setFootballOutcomeKey(firstPosition.side);
                          setSellShares(Number(firstPosition.shares));
                        }}
                        type="button"
                      >
                        Shit
                      </button>
                    </div>
                    {balance !== null && (
                      <span>
                        <CoinFace size={16} /> {fmtNum(balance)}
                      </span>
                    )}
                  </div>
                  <div className="tregu-football-bet-head">
                    <strong>
                      {mode === "sell"
                        ? "Shit aksionet e rezultatit"
                        : football.format.marketIntent === "to_qualify"
                          ? "Basto kush kualifikohet"
                          : "Basto për rezultatin"}
                    </strong>
                  </div>
                  <div
                    className="tregu-football-outcomes"
                    role="radiogroup"
                    aria-label={football.format.marketIntent === "to_qualify" ? "Zgjidh skuadrën që kualifikohet" : "Zgjidh rezultatin"}
                  >
                    {football.outcomes.map((outcome) => (
                      (() => {
                        const outcomePosition = footballHeldOn(outcome.key);
                        const unavailable = mode === "sell" && !outcomePosition;
                        return (
                          <button
                            key={outcome.key}
                            type="button"
                            role="radio"
                            aria-checked={outcome.key === footballOutcomeKey}
                            aria-disabled={unavailable}
                            data-active={outcome.key === footballOutcomeKey}
                            data-has-position={Boolean(outcomePosition)}
                            style={{ "--football-outcome": outcome.color } as CSSProperties}
                            onClick={() => {
                              if (unavailable) return;
                              setFootballOutcomeKey(outcome.key);
                              if (mode === "sell") setSellShares(Number(outcomePosition?.shares ?? 0));
                              setTradeMsg(null);
                            }}
                          >
                            <span>{outcome.label}</span>
                            <strong>{(outcome.probability * 100).toFixed(1)}%</strong>
                            {mode === "sell" && outcomePosition && (
                              <small>{Number(outcomePosition.shares).toFixed(2)} aksione</small>
                            )}
                          </button>
                        );
                      })()
                    ))}
                  </div>
                  {mode === "buy" ? (
                    <>
                      <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>
                        Shuma (383 Coin)
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 10px" }}>
                        <CoinFace size={20} />
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={amountInput}
                          placeholder="0"
                          onChange={(event) => setAmount(event.target.value)}
                          className="tregu-input"
                        />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {QUICK_AMOUNTS.map((quickAmount) => (
                          <button
                            key={quickAmount}
                            className="tregu-chip tregu-raise"
                            data-active={amount === quickAmount}
                            onClick={() => setAmount(quickAmount)}
                            type="button"
                          >
                            {quickAmount}
                          </button>
                        ))}
                        {balance !== null && balance >= 1 && (
                          <button
                            className="tregu-chip tregu-raise"
                            data-active={amount === Number(balance.toFixed(2))}
                            onClick={() => setAmount(Number(balance.toFixed(2)))}
                            type="button"
                          >
                            Max
                          </button>
                        )}
                      </div>
                      {footballPreview && footballSelectedOutcome && (
                        <div className="tregu-slip-summary">
                          <div>
                            <span>Çmimi aktual</span>
                            <strong>{(footballSelectedOutcome.probability * 100).toFixed(1)}%</strong>
                          </div>
                          <div>
                            <span>Aksione të parashikuara</span>
                            <strong>{footballPreview.shares.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span>Çmimi mesatar</span>
                            <strong>{(footballPreview.avgPrice * 100).toFixed(1)}%</strong>
                          </div>
                          <div>
                            <span>Gjasa pas bastit</span>
                            <strong>{((footballPreview.prices[footballSelectedOutcome.key] ?? 0) * 100).toFixed(1)}%</strong>
                          </div>
                        </div>
                      )}
                      {balance !== null && amount > balance && (
                        <p style={{ color: "#E41E20", fontSize: 12, marginBottom: 12 }}>
                          Nuk ke mjaftueshëm 383 Coin ({balance})
                        </p>
                      )}
                      <ConfirmButton onClick={submitTrade} disabled={!canBuy || !footballOutcomeKey}>
                        {placing
                          ? "Duke vendosur bastin..."
                          : `Basto ${amount} 383C te ${footballSelectedOutcome?.label ?? "rezultati"}`}
                      </ConfirmButton>
                    </>
                  ) : (
                    <>
                      {footballHeld && (
                        <p className="tregu-football-position">
                          Pozicioni yt: <strong>{Number(footballHeld.shares).toFixed(2)} aksione</strong>
                          {Number(footballHeld.shares) > 0 && (
                            <> · hyrja {((Number(footballHeld.coins_staked) / Number(footballHeld.shares)) * 100).toFixed(0)}%</>
                          )}
                        </p>
                      )}
                      <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>
                        Aksione për të shitur
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 12px" }}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          max={Number(footballHeld?.shares ?? 0)}
                          value={sellShares || ""}
                          onChange={(event) => {
                            const value = Math.max(0, Number(event.target.value));
                            setSellShares(Math.min(value, Number(footballHeld?.shares ?? 0)));
                          }}
                          className="tregu-input"
                        />
                        {footballHeld && (
                          <button
                            className="tregu-chip"
                            onClick={() => setSellShares(Number(footballHeld.shares))}
                            type="button"
                          >
                            Të gjitha
                          </button>
                        )}
                      </div>
                      {footballSellPreview && footballSelectedOutcome && (
                        <div className="tregu-slip-summary">
                          <div>
                            <span>Merr</span>
                            <strong style={{ color: "#00854A" }}>{footballSellPreview.coins.toFixed(1)} 383C</strong>
                          </div>
                          <div>
                            <span>Çmimi mesatar i shitjes</span>
                            <strong>{(footballSellPreview.avgPrice * 100).toFixed(1)}%</strong>
                          </div>
                          <div>
                            <span>Gjasa pas shitjes</span>
                            <strong>{((footballSellPreview.prices[footballSelectedOutcome.key] ?? 0) * 100).toFixed(1)}%</strong>
                          </div>
                        </div>
                      )}
                      <ConfirmButton
                        onClick={submitTrade}
                        disabled={!canSellFootball || !footballOutcomeKey}
                        variant="sell"
                      >
                        {placing
                          ? "Duke shitur..."
                          : `Shit ${footballSelectedOutcome?.label ?? "rezultatin"}`}
                      </ConfirmButton>
                    </>
                  )}
                  {tradeMsg && (
                    <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: tradeMsg.ok ? "#00854A" : "#E41E20" }}>
                      {tradeMsg.text}
                    </p>
                  )}
                </>
              ) : f1 ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <strong style={{ fontSize: 14 }}>Basto për fituesin</strong>
                    {balance !== null && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        <CoinFace size={16} /> {fmtNum(balance)}
                      </span>
                    )}
                  </div>
                  <p className="f1-trade-note">
                    Zgjidh një pilot nga lista. Gjasat dhe renditja rifreskohen pa ringarkuar faqen.
                  </p>
                  <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>Shuma (383 Coin)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 10px" }}>
                    <CoinFace size={20} />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={amountInput}
                      placeholder="0"
                      onChange={(event) => setAmount(event.target.value)}
                      className="tregu-input"
                    />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {QUICK_AMOUNTS.map((quickAmount) => (
                      <button
                        key={quickAmount}
                        className="tregu-chip tregu-raise"
                        data-active={amount === quickAmount}
                        onClick={() => setAmount(quickAmount)}
                        type="button"
                      >
                        {quickAmount}
                      </button>
                    ))}
                    {balance !== null && balance >= 1 && (
                      <button
                        className="tregu-chip tregu-raise"
                        data-active={amount === Number(balance.toFixed(2))}
                        onClick={() => setAmount(Number(balance.toFixed(2)))}
                        type="button"
                      >
                        Max
                      </button>
                    )}
                  </div>
                  {balance !== null && amount > balance && (
                    <p style={{ color: "#E41E20", fontSize: 12, marginBottom: 12 }}>
                      Nuk ke mjaftueshëm 383 Coin ({balance})
                    </p>
                  )}
                  <ConfirmButton onClick={submitTrade} disabled={!canBuy || !f1OutcomeKey}>
                    {placing
                      ? "Duke vendosur bastin..."
                      : `Basto ${amount} 383C te ${f1SelectedDriver?.key ?? "piloti"}`}
                  </ConfirmButton>
                  {tradeMsg && (
                    <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: tradeMsg.ok ? "#00854A" : "#E41E20" }}>
                      {tradeMsg.text}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div className="tregu-sort">
                      <button aria-pressed={mode === "buy"} onClick={() => { setMode("buy"); setTradeMsg(null); }} type="button">
                        Blej
                      </button>
                      <button
                        aria-pressed={mode === "sell"}
                        disabled={positions.every((p) => p.shares <= 0)}
                        onClick={() => {
                          setMode("sell");
                          setTradeMsg(null);
                          // Jump to a side the user actually holds.
                          const h = heldOn(side) ?? positions.find((p) => p.shares > 0);
                          if (h) {
                            setSide(h.side as Side);
                            setSellShares(Number(h.shares));
                          }
                        }}
                        type="button"
                        style={positions.every((p) => p.shares <= 0) ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                      >
                        Shit
                      </button>
                    </div>
                    {balance !== null && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        <CoinFace size={16} /> {fmtNum(balance)}
                      </span>
                    )}
                  </div>

                  {/* Side selector with live prices per side. */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    {(["PO", "JO"] as Side[]).map((s) => {
                      const p = s === "PO" ? currentPrice : 1 - currentPrice;
                      const active = side === s;
                      const disabled = mode === "sell" && !heldOn(s);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            if (disabled) return;
                            setSide(s);
                            if (mode === "sell") setSellShares(Number(heldOn(s)?.shares ?? 0));
                          }}
                          className={`tregu-raise${active ? (s === "PO" ? " tregu-btn-yes" : " tregu-btn-no") : ""}`}
                          type="button"
                          style={{
                            flex: 1,
                            padding: "12px 10px",
                            borderRadius: 12,
                            fontWeight: 800,
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.4 : 1,
                            background: active ? undefined : "#FFFFFF",
                            border: active ? undefined : "1px solid rgba(17,17,17,0.10)",
                            color: active ? undefined : "#111111",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <span>{sideLabel(s)}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                            {(p * 100).toFixed(0)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {held && (
                    <p style={{ fontSize: 12, color: "#6B6B6B", margin: "0 0 12px", fontVariantNumeric: "tabular-nums" }}>
                      Pozicioni yt: <strong style={{ color: "#111111" }}>{Number(held.shares).toFixed(2)} {held.side}</strong>
                      {held.shares > 0 && (
                        <> · hyrja {((held.coins_staked / held.shares) * 100).toFixed(0)}%</>
                      )}
                    </p>
                  )}

                  {mode === "buy" ? (
                    <>
                      <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>Shuma (383 Coin)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 10px" }}>
                        <CoinFace size={20} />
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={amountInput}
                          placeholder="0"
                          onChange={(event) => setAmount(event.target.value)}
                          className="tregu-input"
                        />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {QUICK_AMOUNTS.map((q) => (
                          <button key={q} className="tregu-chip tregu-raise" data-active={amount === q} onClick={() => setAmount(q)} type="button">
                            {q}
                          </button>
                        ))}
                        {balance !== null && balance >= 1 && (
                          <button className="tregu-chip tregu-raise" data-active={amount === Number(balance.toFixed(2))} onClick={() => setAmount(Number(balance.toFixed(2)))} type="button">
                            Max
                          </button>
                        )}
                      </div>

                      {buyPreview && (
                        <div className="tregu-slip-summary">
                          <div><span>Çmimi aktual {sideLabel(side)}</span><strong>{(sidePrice * 100).toFixed(1)}%</strong></div>
                          <div><span>Aksione</span><strong>{buyPreview.shares.toFixed(2)}</strong></div>
                          <div><span>Çmimi mesatar</span><strong>{(buyPreview.avgPrice * 100).toFixed(1)}%</strong></div>
                          <div>
                            <span>Gjasa pas blerjes</span>
                            <strong style={{ color: impactPp > 5 ? "#B45309" : undefined }}>
                              {(sidePriceAfterTrade * 100).toFixed(1)}%{impactPp > 5 ? " (ndryshim i madh)" : ""}
                            </strong>
                          </div>
                          <div>
                            <span>Fitimi nëse {sideLabel(side)}</span>
                            <strong style={{ color: "#00854A" }}>
                              +{potentialProfit.toFixed(1)} 383C ({roi.toFixed(0)}%)
                            </strong>
                          </div>
                        </div>
                      )}

                      {balance !== null && amount > balance && (
                        <p style={{ color: "#E41E20", fontSize: 12, marginBottom: 12 }}>Nuk ke mjaftueshëm 383 Coin ({balance})</p>
                      )}

                      <ConfirmButton onClick={submitTrade} disabled={!canBuy}>
                        {placing ? "Duke blerë..." : `Blej ${sideLabel(side)} · ${amount} 383C`}
                      </ConfirmButton>
                    </>
                  ) : (
                    <>
                      <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>Aksione për të shitur</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 10px" }}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          max={held ? Number(held.shares) : 0}
                          value={sellShares || ""}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            setSellShares(held ? Math.min(v, Number(held.shares)) : v);
                          }}
                          className="tregu-input"
                        />
                        {held && (
                          <button className="tregu-chip" onClick={() => setSellShares(Number(held.shares))} type="button">
                            Të gjitha
                          </button>
                        )}
                      </div>

                      {sellPreview && (
                        <div className="tregu-slip-summary">
                          <div><span>Merr</span><strong style={{ color: "#00854A" }}>{sellPreview.coins.toFixed(1)} 383C</strong></div>
                          <div><span>Çmimi mesatar i shitjes</span><strong>{(sellPreview.avgPrice * 100).toFixed(1)}%</strong></div>
                          <div>
                            <span>Gjasa pas shitjes</span>
                            <strong style={{ color: impactPp > 5 ? "#B45309" : undefined }}>
                              {(sidePriceAfterTrade * 100).toFixed(1)}%{impactPp > 5 ? " (ndryshim i madh)" : ""}
                            </strong>
                          </div>
                        </div>
                      )}

                      <ConfirmButton onClick={submitTrade} disabled={!canSell} variant="sell">
                        {placing ? "Duke shitur..." : `Shit ${sideLabel(side)}`}
                      </ConfirmButton>
                    </>
                  )}

                  {tradeMsg && (
                    <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: tradeMsg.ok ? "#00854A" : "#E41E20" }}>{tradeMsg.text}</p>
                  )}
                </>
              )}
            </div>

            {/* Related events — compact rows under the trade card. */}
            {related.length > 0 && (
              <div className="tregu-panel" style={{ padding: "22px 24px" }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>Ngjarje të lidhura</h3>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {related.map((m) => (
                    <Link key={m.slug} href={`/tregu/${m.slug}`} className="tregu-rel-row">
                      <RelatedMarketMark market={m} />
                      <span className="tregu-rel-q">{m.question}</span>
                      <span className="tregu-rel-pct">{Math.round(m.prob * 100)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution rules — the trust surface. */}
            <div className="tregu-panel" style={{ padding: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Rregullat e zgjidhjes</h3>
              <p style={{ fontSize: 13, color: "#111111", lineHeight: 1.6, margin: "0 0 12px" }}>
                {(isSportDetail ? sportResolutionRules : market.resolution_rules) ||
                  "Tregu zgjidhet PO nëse ngjarja e përshkruar ndodh dhe konfirmohet nga burime zyrtare para datës së mbylljes. Çdo rezultat tjetër zgjidhet JO."}
              </p>
              <div style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.7 }}>
                <div>
                  <strong style={{ color: "#111111" }}>Burimi:</strong>{" "}
                  {(isSportDetail ? sportResolutionSource : market.resolution_source) || "Burime zyrtare + raportimi i 383"}
                </div>
                <div>
                  <strong style={{ color: "#111111" }}>Mbyllet:</strong>{" "}
                  {formatKosovoDate(market.closes_at, { year: true })}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <MobileTradeSheet
          open={mobileTradeOpen}
          mode={mode}
          marketOpen={!isClosed}
          loggedIn={Boolean(user)}
          loginHref={`/hyr?next=${encodeURIComponent(`/tregu/${slug}`)}`}
          question={group && currentOutcome ? group.title : market.question}
          balance={balance}
          options={mobileTradeOptions}
          selectedKey={mobileSelectedKey}
          amount={amount}
          amountInput={amountInput}
          sellShares={sellShares}
          maxSellShares={Number(mobileHeld)}
          buyReturn={mobileBuyReturn}
          sellReturn={mobileSellReturn}
          canBuy={canBuy && Boolean(mobileSelectedKey)}
          canSell={football ? canSellFootball : f1 ? canSellF1 : canSell}
          sellEnabled={mobileSellEnabled}
          placing={placing}
          message={tradeMsg}
          receipt={purchaseReceipt}
          soundProfile={resolveTradeSuccessSoundProfile({ sportTheme, league: market.live_event?.league })}
          onOpen={openMobileTrade}
          onClose={closeMobileTrade}
          onModeChange={changeMobileTradeMode}
          onSelect={selectMobileTradeOption}
          onAmountChange={setAmount}
          onSellSharesChange={setSellShares}
          onSubmit={submitTrade}
          onDismissReceipt={dismissPurchaseReceipt}
        />

        {/* Practice sandbox — first market page a visitor opens walks them
            through reading the graph, betting and getting back out. */}
        <TradeTutorial />
      </main>
    </div>
  );
}
