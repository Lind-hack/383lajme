"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import MarketChart from "@/components/tregu/market-chart";
import GroupChart, { OutcomeMiniChart } from "@/components/tregu/group-chart";
import { type MiniMarket } from "@/components/tregu/market-mini-card";
import TeamFlag from "@/components/tregu/team-flag";
import MarketSocial, { type HolderRow, type CommentItem } from "@/components/tregu/market-social";
import CoinFace from "@/components/tregu/coin-face";
import ConfirmButton from "@/components/tregu/confirm-button";
import { createClient } from "@/lib/supabase/client";
import { previewBet, previewSell, lmsrPriceYes, type Side, type MarketTrade } from "@/lib/tregu-client";
import { fmtNum } from "@/lib/format";
import { DEMO_SLUG, demoDetail, demoEventMinis, demoMatchSeries, demoMatchStats, isDemoEnabled } from "@/lib/tregu-demo";
import MatchStats from "@/components/tregu/match-stats";
import { groupForSlug, parseEvent, type GroupOutcome, type MarketGroup } from "@/lib/tregu-groups";
import { outcomeMediaFor } from "@/lib/tregu-media";
import { eventStatsFor } from "@/lib/tregu-event-stats";
import RaceStandings from "@/components/tregu/race-standings";
import { dramatizeSeries, dramatizeSpark } from "@/lib/tregu-tape";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";

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
  outcome: Side | null;
  market_prob: number;
  q_yes: number;
  q_no: number;
  b: number;
  closes_at: string;
  source_article_slugs: string[];
  resolution_rules: string | null;
  resolution_source: string | null;
  live_score_state?: unknown;
}

interface Snapshot {
  ai_prob: number | null;
  market_prob: number;
  created_at: string;
  evidence: { title: string; slug: string; url?: string }[] | null;
}

interface Position {
  side: Side;
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

function closesIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Mbyllet për ${days} ${days === 1 ? "ditë" : "ditë"}`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Mbyllet për ${hours} orë`;
  return `Mbyllet për ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  if (ms < 60_000) return "tani";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `para ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `para ${h} orësh`;
  return `para ${Math.floor(h / 24)} ditësh`;
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<Side>("PO");
  const [amount, setAmount] = useState(10);
  const [sellShares, setSellShares] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [tradeMsg, setTradeMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
        setSnapshots(d.snapshots ?? []);
        setTrades(d.trades ?? []);
        setActivity(d.activity ?? []);
        setRelated(d.related ?? []);
        setWeeklyDelta(d.weeklyDelta ?? null);
        setTradeCount(d.tradeCount ?? 0);
        setPositions(Array.isArray(d.position) ? d.position : []);
        setHolders(d.holders ?? []);
        setComments(d.comments ?? []);
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

  // Live refresh: the VPS cron reprices every 5 min and inserts a snapshot;
  // polling each minute picks the new chart point up without a reload.
  useEffect(() => {
    if (demo) return;
    const id = setInterval(load, 12_000);
    return () => clearInterval(id);
  }, [load, demo]);

  const heldOn = (s: Side) => positions.find((p) => p.side === s && p.shares > 0);
  const held = heldOn(side);

  const submitTrade = async () => {
    if (!market) return;
    if (demo) {
      setTradeMsg({ ok: true, text: "Treg demonstrimi — tregtimet e vërteta hapen kur tregu të jetë live." });
      return;
    }
    setPlacing(true);
    setTradeMsg(null);
    if (mode === "buy") {
      const res = await fetch("/api/tregu/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, side, coins: amount }),
      });
      const data = await res.json();
      if (res.ok) {
        setTradeMsg({ ok: true, text: `✓ Bleve ${data.sharesBought?.toFixed(2)} aksione ${side} për ${amount} 383C` });
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
        setTradeMsg({ ok: true, text: `✓ Shite ${sellShares.toFixed(2)} aksione ${side} për ${Number(data.coinsReceived ?? 0).toFixed(1)} 383C` });
        setSellShares(0);
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
  // Bonus: live AI signal — the newest news-scored probability vs the market.
  const latestAiSnap = [...snapshots].reverse().find((s) => s.ai_prob !== null) ?? null;
  const currentOutcome = group?.outcomes.find((o) => o.slug === slug) ?? null;
  // Grouped events trade in outcome language, not raw PO/JO:
  // PO → "Barazim", JO → "Jo Barazim".
  const sideLabel = (s: Side) =>
    currentOutcome ? (s === "PO" ? currentOutcome.label : `Jo ${currentOutcome.label}`) : s;
  // Timestamped tape per outcome: real cron snapshots from the API when
  // available, otherwise the hub sparkline mapped onto a 5-min grid ending now
  // (demo + brand-new markets without snapshot history yet).
  const eventSeriesFor = (o: GroupOutcome): { t: number; p: number }[] | undefined => {
    // Demo events carry a scripted in-play match simulation at 2-min steps.
    if (demo) {
      const sim = demoMatchSeries(o.slug);
      if (sim) return sim;
    }
    const fromApi = eventData?.outcomes.find((x) => x.slug === o.slug)?.series;
    if (fromApi && fromApi.length >= 2) return fromApi;
    if (o.spark && o.spark.length >= 2) {
      const now = Date.now();
      const step = 5 * 60_000;
      const n = o.spark.length;
      return dramatizeSeries(
        o.spark.map((p, i) => ({ t: now - (n - 1 - i) * step, p })),
        o.slug
      );
    }
    return undefined;
  };
  const currentPrice = lmsrPriceYes(market.q_yes, market.q_no, market.b);
  const sidePrice = side === "PO" ? currentPrice : 1 - currentPrice;
  const pct = Math.round(market.market_prob * 100);
  const isClosed = market.status !== "open";
  const volume = Math.round(market.q_yes + market.q_no);
  const deltaPp = weeklyDelta === null ? null : Math.round(weeklyDelta * 100);
  const closesMs = market.closes_at ? new Date(market.closes_at).getTime() : NaN;
  const closesDateLabel = Number.isNaN(closesMs)
    ? null
    : new Date(closesMs).toLocaleDateString("sq-AL", { day: "numeric", month: "short" });

  const buyPreview =
    mode === "buy" && amount > 0
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
  const potentialProfit = buyPreview ? buyPreview.shares - amount : 0;
  const roi = buyPreview && amount > 0 ? (potentialProfit / amount) * 100 : 0;

  const canBuy = !placing && amount > 0 && (balance === null || amount <= balance);
  const canSell = !placing && sellShares > 0 && Boolean(held);

  // Race grids (every outcome has a registry headshot) swap the mini-chart
  // grid for a live timing board ranked by the odds.
  const raceField = Boolean(group && group.outcomes.every((o) => outcomeMediaFor(o.label)?.photo));
  // Repricing cadence: live sports (football, F1 grids) reprice every 2 min,
  // general/news markets every 5 min. Drives the chart's countdown pill.
  const isLiveSport = market.category === "sport" || raceField;
  const chartCadenceMs = isLiveSport ? 120_000 : 300_000;
  // Per-category chart accent (blue Politikë, green Ekonomi, gold Botë…).
  const chartCategory = SLUG_TO_CATEGORY[market.category] ?? market.category;

  // Registered head-to-head stat sheet for this event (null when none exists).
  const fallbackEventStats = group ? eventStatsFor(group.title) : null;
  const live = market.live_score_state as { status?: string; detail?: string; competitors?: Array<{ team?: string; score?: number }>; metrics?: Record<string, Record<string, number>> } | null;
  const liveMetrics = live?.metrics;
  const liveStats = live?.status !== "STATUS_SCHEDULED" && liveMetrics && group ? {
    home: "Argjentina", away: "Spanja",
    score: `${live.competitors?.find((c) => c.team === "Argentina")?.score ?? 0} - ${live.competitors?.find((c) => c.team === "Spain")?.score ?? 0}`,
    note: `LIVE · ${live.detail ?? ""}`,
    rows: [
      { label: "Posedimi i topit", home: liveMetrics.Argentina?.possession ?? 0, away: liveMetrics.Spain?.possession ?? 0, homeText: `${liveMetrics.Argentina?.possession ?? 0}%`, awayText: `${liveMetrics.Spain?.possession ?? 0}%` },
      { label: "Gjuajtjet totale", home: liveMetrics.Argentina?.shots ?? 0, away: liveMetrics.Spain?.shots ?? 0 },
      { label: "Gjuajtjet në portë", home: liveMetrics.Argentina?.shots_on_target ?? 0, away: liveMetrics.Spain?.shots_on_target ?? 0 },
      { label: "Goditje nga këndi", home: liveMetrics.Argentina?.corners ?? 0, away: liveMetrics.Spain?.corners ?? 0 },
      { label: "Shanse të mëdha të krijuara", home: liveMetrics.Argentina?.big_chances ?? 0, away: liveMetrics.Spain?.big_chances ?? 0 },
      { label: "Kartonë të verdhë", home: liveMetrics.Argentina?.yellow_cards ?? 0, away: liveMetrics.Spain?.yellow_cards ?? 0 },
      { label: "Kartonë të kuq", home: liveMetrics.Argentina?.red_cards ?? 0, away: liveMetrics.Spain?.red_cards ?? 0 },
    ],
  } : null;
  const eventStats = liveStats ?? fallbackEventStats;

  return (
    <div className="tregu-scope">
      <Navbar />
      {/* Left-anchored container — Polymarket-style, not centered. */}
      <main style={{ maxWidth: 1560, margin: 0, padding: "96px 32px 80px 32px" }}>
        <Link href="/tregu" style={{ color: "#6B6B6B", fontSize: 13, textDecoration: "none" }}>
          ← Tregu
        </Link>

        {/* ── Header: flat, no card — question + live ticker row ── */}
        <header style={{ marginTop: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
            {market.status === "resolved" && (
              <span className="tregu-pill" style={{ color: market.outcome === "PO" ? "#00854A" : "#C51518" }}>
                U zgjidh: {market.outcome}
              </span>
            )}
            {market.status === "closed" && <span className="tregu-pill">Mbyllur</span>}
            {market.status === "open" && <span className="tregu-pill">{closesIn(market.closes_at)}</span>}
          </div>
          <h1
            style={{
              fontSize: "clamp(24px, 3.2vw, 34px)",
              fontWeight: 800,
              margin: "0 0 10px",
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              textWrap: "balance",
              maxWidth: "26ch",
            }}
          >
            {group && currentOutcome ? group.title : market.question}
          </h1>
          {group && currentOutcome && (
            <div className="tregu-event-tabs" role="tablist" aria-label="Rezultatet e ngjarjes">
              {group.outcomes.map((o) => (
                <Link
                  key={o.slug}
                  href={`/tregu/${o.slug}`}
                  className="tregu-event-tab"
                  data-active={o.slug === slug}
                  role="tab"
                  aria-selected={o.slug === slug}
                >
                  <span className="tregu-gchart-chip-dot" style={{ background: o.color }} />
                  {o.label} · {Math.round(o.prob * 100)}%
                </Link>
              ))}
            </div>
          )}
          {market.description && (
            <p style={{ color: "#555555", fontSize: 14, margin: "0 0 14px", maxWidth: "70ch", lineHeight: 1.55 }}>
              {market.description}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "12px 22px" }}>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "#111111", fontVariantNumeric: "tabular-nums" }}>
                {pct}%
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#6B6B6B" }}>
                {currentOutcome ? `gjasa ${currentOutcome.label}` : "gjasa PO"}
              </span>
            </span>
            {deltaPp !== null && deltaPp !== 0 && (
              <span className="tregu-delta-chip" data-dir={deltaPp > 0 ? "up" : "down"}>
                {deltaPp > 0 ? "▲" : "▼"} {Math.abs(deltaPp)}pp këtë javë
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: "#555555", fontVariantNumeric: "tabular-nums" }}>
              {fmtNum(volume)} 383C vëllim · {fmtNum(tradeCount)} tregtime
              {closesDateLabel ? ` · ${isClosed ? "u mbyll" : "mbyllet"} ${closesDateLabel}` : ""}
            </span>
          </div>
        </header>

        {/* ── 2-col: chart + social tabs | bet slip + AI signal + rules ── */}
        <div className="tregu-detail-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {group && currentOutcome ? (
              <>
                {/* Combined event chart — every outcome's live line, Polymarket-style. */}
                <div className="tregu-panel" style={{ padding: 28 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px" }}>Të gjitha rezultatet</h3>
                  {/* No remount key: the left-to-right reveal must play once on
                      open, not replay every poll. Prop changes re-render in
                      place and the internal per-second sim drives the tail. */}
                  <GroupChart
                    height={460}
                    cadenceMs={chartCadenceMs}
                    series={group.outcomes.map((o) => ({
                      label: o.label,
                      color: o.color,
                      series: eventSeriesFor(o),
                      prob: o.rawProb,
                    }))}
                  />
                </div>
                {/* Beneath the chart: the stat lines behind the price moves —
                    demo matches ship their own fixture, other events pull a
                    registered sheet from tregu-event-stats. */}
                {demo ? (
                  <MatchStats {...demoMatchStats()} />
                ) : eventStats ? (
                  <MatchStats {...eventStats} />
                ) : null}
                {/* Below the chart: live timing board for race grids, or one
                    graph per outcome for everything else. */}
                <div className="tregu-panel" style={{ padding: 28 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>
                    {raceField ? "Renditja live" : "Gjasat sipas rezultatit"}
                  </h3>
                  {raceField ? (
                    <RaceStandings outcomes={group.outcomes} currentSlug={slug} />
                  ) : (
                    <div className="tregu-omini-grid">
                      {group.outcomes.map((o) => (
                        <OutcomeMiniChart key={o.slug} label={o.label} color={o.color} points={dramatizeSpark(o.spark, o.slug)} prob={o.prob} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="tregu-panel" style={{ padding: 28 }}>
                <MarketChart trades={trades} snapshots={snapshots} currentProb={market.market_prob} seedKey={slug} category={chartCategory} cadenceMs={chartCadenceMs} />
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

            {latestEvidence.length > 0 && (
              <div className="tregu-panel" style={{ padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>Bazuar në lajme</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {latestEvidence.map((e) => {
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
                        key={e.slug}
                        href={`/article/${e.slug}`}
                        className="tregu-evidence-item"
                      >
                        <span className="tregu-evidence-thumb">{initial}</span>
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
            <div className="tregu-panel tregu-edge" data-cat={market.category} style={{ padding: 28 }}>
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
                  <div
                    style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}
                    role="tablist"
                    aria-label="Zgjidh skuadrën"
                  >
                    {group.outcomes.map((o) => (
                      <Link
                        key={o.slug}
                        href={`/tregu/${o.slug}`}
                        className="tregu-team-switch"
                        data-active={o.slug === slug}
                        role="tab"
                        aria-selected={o.slug === slug}
                      >
                        <TeamFlag team={o.label} size={22} radius={7} label={o.label} />
                        <span>{o.label}</span>
                        <span style={{ opacity: 0.72, fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(o.prob * 100)}%
                        </span>
                      </Link>
                    ))}
                  </div>
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
                            setSide(h.side);
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
                          min={1}
                          value={amount}
                          onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
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
                          <button className="tregu-chip tregu-raise" data-active={amount === Math.floor(balance)} onClick={() => setAmount(Math.floor(balance))} type="button">
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
                            <span>Ndikimi në çmim</span>
                            <strong style={{ color: impactPp > 5 ? "#B45309" : undefined }}>
                              {impactPp.toFixed(1)}pp{impactPp > 5 ? " ⚠" : ""}
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
                            <span>Ndikimi në çmim</span>
                            <strong style={{ color: impactPp > 5 ? "#B45309" : undefined }}>
                              {impactPp.toFixed(1)}pp{impactPp > 5 ? " ⚠" : ""}
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
                      {/* Event questions carry both team names — flag must key off the outcome half. */}
                      <TeamFlag
                        team={parseEvent(m.question)?.outcome ?? m.question}
                        size={34}
                        radius={10}
                        label={m.question}
                      />
                      <span className="tregu-rel-q">{m.question}</span>
                      <span className="tregu-rel-pct">{Math.round(m.prob * 100)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Sinjali AI — how the newest news-scored probability compares to
               the crowd. This is the surface of the 5-min refresh loop: when
               news moves the AI line away from the market, traders see the
               edge before the odds catch up. */}
            {latestAiSnap && latestAiSnap.ai_prob !== null && (
              <div className="tregu-panel" style={{ padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Sinjali AI</h3>
                  <span style={{ fontSize: 11, color: "#6B6B6B" }}>{timeAgo(latestAiSnap.created_at)}</span>
                </div>
                {(() => {
                  const ai = latestAiSnap.ai_prob as number;
                  const gapPp = Math.round((ai - market.market_prob) * 100);
                  return (
                    <>
                      <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", marginBottom: 2 }}>AI nga lajmet</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: "#B45309", fontVariantNumeric: "tabular-nums" }}>
                            {Math.round(ai * 100)}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", marginBottom: 2 }}>Tregu</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: "#00854A", fontVariantNumeric: "tabular-nums" }}>
                            {pct}%
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: 12.5, color: "#555555", lineHeight: 1.55, margin: 0 }}>
                        {Math.abs(gapPp) < 3
                          ? "AI dhe tregu pajtohen — çmimi duket i drejtë."
                          : gapPp > 0
                            ? `AI e vlerëson ${sideLabel("PO")} ${Math.abs(gapPp)}pp më lart se tregu — lajmet e fundit anojnë PO.`
                            : `AI e vlerëson ${sideLabel("PO")} ${Math.abs(gapPp)}pp më poshtë se tregu — lajmet e fundit anojnë JO.`}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Resolution rules — the trust surface. */}
            <div className="tregu-panel" style={{ padding: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Rregullat e zgjidhjes</h3>
              <p style={{ fontSize: 13, color: "#111111", lineHeight: 1.6, margin: "0 0 12px" }}>
                {market.resolution_rules ||
                  "Tregu zgjidhet PO nëse ngjarja e përshkruar ndodh dhe konfirmohet nga burime zyrtare para datës së mbylljes. Çdo rezultat tjetër zgjidhet JO."}
              </p>
              <div style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.7 }}>
                <div>
                  <strong style={{ color: "#111111" }}>Burimi:</strong>{" "}
                  {market.resolution_source || "Burime zyrtare + raportimi i 383"}
                </div>
                <div>
                  <strong style={{ color: "#111111" }}>Mbyllet:</strong>{" "}
                  {new Date(market.closes_at).toLocaleDateString("sq-AL", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
          </aside>
        </div>

      </main>
    </div>
  );
}
