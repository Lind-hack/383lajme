"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import ProbChart, { type ChartPoint } from "@/components/tregu/prob-chart";
import CoinFace from "@/components/tregu/coin-face";
import { createClient } from "@/lib/supabase/client";
import { lmsrThreeOutcomePrices, previewBet, type BinarySide, type Side } from "@/lib/tregu-client";
import { formatOfficialLiveScore, getMarketPrices, officialMetricsForDisplay } from "@/lib/tregu-market-detail.mjs";

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
  market_type?: "binary" | "three_outcome";
  q_england?: number;
  q_draw?: number;
  q_argentina?: number;
  three_outcome_prices?: { england: number; draw: number; argentina: number } | null;
  live_event?: { provider: "espn"; event_id: string } | null;
  live_score_state?: {
    status?: string;
    detail?: string;
    competitors?: { team: string; score: number }[];
    metrics?: Record<string, { shots?: number; shots_on_target?: number; possession?: number; corners?: number; xg?: number }>;
    metric_sources?: Record<string, Record<string, "espn" | "flashscore">>;
    supplemental?: { flashscore?: { availability?: "available" | "unavailable"; source_url?: string; retrieved_at?: string; reason?: string } };
    starting_lineups?: Record<string, string[]>;
  } | null;
  official_final_at?: string | null;
  settlement_due_at?: string | null;
  pre_match_analysis?: { claims?: unknown[]; sources?: { title: string; url: string; source: string }[] } | null;
  b: number;
  closes_at: string;
  source_article_slugs: string[];
}

interface Snapshot {
  ai_prob: number | null;
  reference_probability?: number | null;
  oracle_kind?: string | null;
  oracle_reasoning?: string | null;
  oracle_cap?: number | null;
  market_prob_before?: number | null;

  market_prob: number;
  volume: number;
  created_at: string;
  evidence: { title: string; slug: string; url?: string }[] | null;
}

export default function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshMode, setRefreshMode] = useState<"live" | "polling" | "offline">("offline");
  const [detailMode, setDetailMode] = useState<"simple" | "advanced">("simple");
  const [movementFilter, setMovementFilter] = useState<"all" | "trade" | "news_oracle">("all");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [side, setSide] = useState<Side>("PO");
  const [amount, setAmount] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [betMsg, setBetMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tregu/markets/${slug}?fresh=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.error) {
        if (response.status === 404) setNotFound(true);
        else setLoadError(data.error ?? "Nuk mund t’i përditësojmë të dhënat e tregut.");
        return;
      }
      setNotFound(false);
      setLoadError(null);
      setMarket(data.market);
      setSnapshots(data.snapshots ?? []);
    } catch {
      setLoadError("Lidhja me tregun u ndërpre. Provo përsëri.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
    // Card PO/JO buttons deep-link with ?ana=po|jo to pre-select the side.
    const ana = new URLSearchParams(window.location.search).get("ana");
    if (ana === "po") setSide("PO");
    if (ana === "jo") setSide("JO");
    try {
      const savedMode = window.localStorage.getItem("383:tregu-detail-mode");
      if (savedMode === "simple" || savedMode === "advanced") setDetailMode(savedMode);
    } catch {
      // Storage can be unavailable in private browsing; Simple remains usable.
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetch("/api/tregu/portfolio")
          .then((r) => r.json())
          .then((d) => setBalance(d.profile?.coins ?? null));
      }
    });
  }, [load]);

  useEffect(() => {
    if (!market?.id) return;
    let cancelled = false;
    let debounceTimer: number | undefined;
    let pollingTimer: number | undefined;
    const refresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => { if (!cancelled) load(); }, 250);
    };
    const startPolling = () => {
      if (pollingTimer || cancelled) return;
      setRefreshMode("polling");
      pollingTimer = window.setInterval(refresh, 12_000);
    };

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      startPolling();
      return () => {
        cancelled = true;
        window.clearTimeout(debounceTimer);
        if (pollingTimer) window.clearInterval(pollingTimer);
      };
    }

    startPolling();
    const supabase = createClient();
    const channel = supabase
      .channel(`tregu-market-${market.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "markets", filter: `id=eq.${market.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_snapshots", filter: `market_id=eq.${market.id}` }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRefreshMode("live");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      if (pollingTimer) window.clearInterval(pollingTimer);
      supabase.removeChannel(channel);
    };
  }, [load, market?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectDetailMode = (mode: "simple" | "advanced") => {
    setDetailMode(mode);
    try { window.localStorage.setItem("383:tregu-detail-mode", mode); } catch { /* optional preference */ }
  };

  const placeBet = async () => {
    if (!market) return;
    setPlacing(true);
    setBetMsg(null);
    const res = await fetch("/api/tregu/bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId: market.id, side, coins: amount }),
    });
    const data = await res.json();
    if (res.ok) {
      setBetMsg({ ok: true, text: `Bast i vendosur: ${data.sharesBought?.toFixed(2)} aksione ${side}` });
      setBalance((b) => (b === null ? null : b - amount));
      load();
    } else {
      setBetMsg({ ok: false, text: data.error ?? "Gabim" });
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

  if (loadError && !market) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <div style={{ padding: "140px 24px", textAlign: "center" }} role="alert">
          <p>{loadError}</p>
          <button onClick={load} className="tregu-btn-primary" style={{ padding: "10px 18px", borderRadius: 10, cursor: "pointer" }}>Provo përsëri</button>
        </div>
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

  const points: ChartPoint[] = [
    ...snapshots.map((s) => ({
      t: s.created_at,
      marketProb: s.oracle_kind === "trade" || s.oracle_kind === "news_oracle" ? s.market_prob : null,
      movementKind: (s.oracle_kind === "trade" || s.oracle_kind === "news_oracle" ? s.oracle_kind : null) as ChartPoint["movementKind"],
    })),
    { t: "now", marketProb: market.market_prob },
  ];

  const latestEvidence = [...snapshots].reverse().find((s) => s.evidence && s.evidence.length > 0)?.evidence ?? [];
  const latestReference = [...snapshots].reverse().find((s) => s.reference_probability !== null && s.reference_probability !== undefined);
  const timeline = [...snapshots].reverse().filter((snapshot) => movementFilter === "all" || snapshot.oracle_kind === movementFilter);

  const isThreeOutcome = market.market_type === "three_outcome";
  const threePrices = market.three_outcome_prices ?? lmsrThreeOutcomePrices(market);
  const preview = !isThreeOutcome && amount > 0 ? previewBet({ q_yes: market.q_yes, q_no: market.q_no, b: market.b }, side as BinarySide, amount) : null;
  const { po: currentPrice, jo: currentJoPrice } = getMarketPrices(market.market_prob);
  const pct = Math.round(currentPrice * 100);
  const poPrice = Math.round(currentPrice * 100);
  const joPrice = Math.round(currentJoPrice * 100);
  const isClosed = market.status !== "open";
  const isStale = market.status === "stale";
  const liveSystemActive = Boolean(market.live_event) && market.status === "open" && refreshMode !== "offline";
  const liveMetrics = market.live_score_state?.metrics ?? {};
  const officialMetrics = officialMetricsForDisplay(liveMetrics, market.live_score_state?.metric_sources);
  const flashscoreAudit = market.live_score_state?.supplemental?.flashscore;
  const officialLiveScore = formatOfficialLiveScore(market.live_score_state ?? undefined);
  const flashscoreAvailable = flashscoreAudit?.availability === "available";
  const settlementRemaining = market.settlement_due_at ? Math.max(0, new Date(market.settlement_due_at).getTime() - clockNow) : null;
  const settlementCountdown = settlementRemaining === null ? null : `${Math.floor(settlementRemaining / 60_000)}:${String(Math.floor(settlementRemaining / 1000) % 60).padStart(2, "0")}`;

  return (
    <div className="tregu-scope">
      <Navbar />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "104px 24px 80px" }}>
        <Link href="/tregu" style={{ color: "#6B6B6B", fontSize: 13, textDecoration: "none" }}>
          ← Tregu
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, marginTop: 16 }}>
          <div className="tregu-glass" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span className="tregu-pill">{market.category}</span>
              {liveSystemActive && <span className="tregu-live-dot" role="status" aria-label="Lidhja e përditësimeve live është aktive"><span aria-hidden="true" /> LIVE</span>}
              {market.status === "resolved" && (
                <span className="tregu-pill" style={{ color: market.outcome === "PO" ? "#00A651" : "#E41E20" }}>
                  U zgjidh: {market.outcome}
                </span>
              )}
              {market.status === "closed" && <span className="tregu-pill">Mbyllur</span>}
              {isStale && <span className="tregu-pill" style={{ color: "#b45309" }}>Pezulluar</span>}
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.25 }}>
              {market.question}
            </h1>
            {market.description && <p style={{ color: "#6B6B6B", fontSize: 14, marginBottom: 20 }}>{market.description}</p>}
            {isThreeOutcome ? (
              <div aria-label="Probabilitetet e rezultatit pas 90 minutash" style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {[["England fiton", threePrices.england, "#2563EB"], ["Barazim", threePrices.draw, "#D97706"], ["Argentina fiton", threePrices.argentina, "#00A651"]].map(([label, value, color]) => (
                  <div key={String(label)} style={{ display: "grid", gridTemplateColumns: "132px 1fr 48px", alignItems: "center", gap: 10, fontWeight: 800 }}>
                    <span>{label}</span><span aria-hidden="true" style={{ height: 8, borderRadius: 999, background: "rgba(17,17,17,.1)", overflow: "hidden" }}><span style={{ display: "block", width: `${Number(value) * 100}%`, height: "100%", background: String(color), borderRadius: 999, transition: "width 200ms ease-out" }} /></span><span>{Math.round(Number(value) * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 40, fontWeight: 800, color: pct >= 50 ? "#00A651" : "#E41E20" }}>{pct}% PO</div>}
            <p style={{ color: "#6B6B6B", fontSize: 12, marginTop: 4 }}>
              Mbyllet: {new Date(market.closes_at).toLocaleDateString("sq-AL")}
            </p>
            {market.live_event && market.live_score_state && (
              <section aria-label="Gjendja zyrtare live ESPN" style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "rgba(17,17,17,.045)" }}>
                <strong>{market.status === "open" ? "LIVE · " : "I kyçur · "}{officialLiveScore.sourceLabel} · {officialLiveScore.status}</strong>
                {officialLiveScore.score && <p style={{ margin: "6px 0 0", fontWeight: 700 }}>{officialLiveScore.score}</p>}
                {officialMetrics.length > 0 && <div style={{ marginTop: 10 }}><strong style={{ fontSize: 12 }}>Statistikat live (ESPN zyrtar{flashscoreAvailable ? "; Flashscore suplementar" : ""})</strong>{officialMetrics.map((metrics) => <p key={metrics.team} style={{ fontSize: 12, margin: "5px 0 0" }}>{metrics.team}: {[metrics.shots !== undefined && `Goditje ${metrics.shots}${flashscoreAvailable && metrics.sources.shots === "flashscore" ? " (Flashscore)" : ""}`, metrics.shotsOnTarget !== undefined && `në portë ${metrics.shotsOnTarget}${flashscoreAvailable && metrics.sources.shots_on_target === "flashscore" ? " (Flashscore)" : ""}`, metrics.possession !== undefined && `Posedim ${metrics.possession}%${flashscoreAvailable && metrics.sources.possession === "flashscore" ? " (Flashscore)" : ""}`, metrics.corners !== undefined && `Kënde ${metrics.corners}${flashscoreAvailable && metrics.sources.corners === "flashscore" ? " (Flashscore)" : ""}`, metrics.xg !== undefined && `xG ${metrics.xg}${flashscoreAvailable && metrics.sources.xg === "flashscore" ? " (Flashscore)" : ""}`].filter(Boolean).join(" · ")}</p>)}</div>}
                {flashscoreAudit && <p style={{ margin: "10px 0 0", color: "#6B6B6B", fontSize: 11 }}>{flashscoreAudit.availability === "available" ? <>Flashscore: metrika suplementare të marra {new Date(flashscoreAudit.retrieved_at ?? "").toLocaleString("sq-AL")}{flashscoreAudit.source_url ? <> · <a href={flashscoreAudit.source_url} target="_blank" rel="noreferrer">Burimi ↗</a></> : null}</> : <>Flashscore i padisponueshëm — po përdorim statistikat ESPN{flashscoreAudit.reason ? ` (${flashscoreAudit.reason})` : ""}.</>}</p>}
              </section>
            )}
            {market.status === "closed" && settlementCountdown && <p role="status" style={{ color: "#6B6B6B", fontSize: 13, fontWeight: 700 }}>Rezultati zyrtar verifikohet; zgjidhja për {settlementCountdown}.</p>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 18 }}>
              {!isThreeOutcome && <><strong style={{ fontSize: 24, color: "#00A651" }}>PO {poPrice}%</strong><strong style={{ fontSize: 24, color: "#E41E20" }}>JO {joPrice}%</strong></>}
              <span style={{ fontSize: 12, color: "#6B6B6B" }}>{isThreeOutcome ? "3 çmime LMSR · 100% gjithsej" : "një çmim LMSR"} · {refreshMode === "live" ? "Live" : refreshMode === "polling" ? "Përditësim rezervë" : "Duke u lidhur"}</span>
            </div>
            <div role="group" aria-label="Mënyra e detajeve të grafikut" style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={() => selectDetailMode("simple")} aria-pressed={detailMode === "simple"} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(17,17,17,.15)", background: detailMode === "simple" ? "#111111" : "transparent", color: detailMode === "simple" ? "#fff" : "#111111", cursor: "pointer", fontWeight: 700 }}>Simple</button>
              <button onClick={() => selectDetailMode("advanced")} aria-pressed={detailMode === "advanced"} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(17,17,17,.15)", background: detailMode === "advanced" ? "#111111" : "transparent", color: detailMode === "advanced" ? "#fff" : "#111111", cursor: "pointer", fontWeight: 700 }}>Advanced</button>
            </div>
            {loadError && <p role="status" style={{ color: "#b45309", fontSize: 12, marginTop: 12 }}>{loadError}</p>}
            <div style={{ marginTop: 20 }}>
              {snapshots.length === 0 ? <div style={{ minHeight: 150, display: "grid", placeItems: "center", color: "#6B6B6B", fontSize: 13 }}>Ende nuk ka lëvizje të regjistruara; çmimi aktual është {poPrice}% PO.</div> : <ProbChart points={points} />}
            </div>
          </div>

          <div className="tregu-glass" style={{ padding: 24, opacity: isClosed ? 0.62 : 1 }} aria-disabled={isClosed}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 16px" }}>Vendos bast</h3>

            {!user ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "#6B6B6B", marginBottom: 14 }}>Duhet të krijosh llogari për të vënë bast — merr 100 383 Coin falas.</p>
                <Link href="/hyr" className="tregu-btn-primary" style={{ padding: "10px 22px", borderRadius: 100, textDecoration: "none", display: "inline-block" }}>
                  Hyr / Regjistrohu
                </Link>
              </div>
            ) : isClosed ? (
              <p style={{ color: "#6B6B6B" }}>
                Ky treg nuk pranon më baste.
              </p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  {(isThreeOutcome ? [["ENGLAND", "England"], ["DRAW", "Barazim"], ["ARGENTINA", "Argentina"]] : [["PO", "PO"], ["JO", "JO"]]).map(([value, label]) => (
                    <button key={value} onClick={() => setSide(value as Side)} className={side === value ? (value === "JO" ? "tregu-btn-no" : "tregu-btn-yes") : undefined} style={{ flex: 1, padding: "12px", borderRadius: 12, fontWeight: 800, cursor: "pointer", background: side === value ? undefined : "rgba(17,17,17,0.04)", border: side === value ? undefined : "1px solid rgba(17,17,17,0.10)", color: side === value ? undefined : "#111111", transition: "transform 160ms var(--ease-out), background-color 200ms var(--ease-out)" }}>{label}</button>
                  ))}
                </div>

                <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>Shuma (383 Coin)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" }}>
                  <CoinFace size={20} />
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(17,17,17,0.12)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: "#111111",
                      fontSize: 16,
                      fontWeight: 700,
                      transition: "border-color 160ms var(--ease-out), background-color 160ms var(--ease-out)",
                    }}
                  />
                </div>

                {preview && (
                  <div style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 16, lineHeight: 1.7 }}>
                    Çmimi aktual: <strong style={{ color: "#111111" }}>{(currentPrice * 100).toFixed(1)}%</strong>
                    <br />
                    Aksione të blera: <strong style={{ color: "#111111" }}>{preview.shares.toFixed(2)}</strong>
                    <br />
                    Çmimi i ri: <strong style={{ color: "#111111" }}>{(preview.newPriceYes * 100).toFixed(1)}%</strong>
                    <br />
                    Fitim max nëse ndodh: <strong style={{ color: "#00A651" }}>{preview.shares.toFixed(0)} 383C</strong>
                  </div>
                )}

                {balance !== null && amount > balance && (
                  <p style={{ color: "#E41E20", fontSize: 12, marginBottom: 12 }}>Nuk ke mjaftueshëm 383 Coin ({balance})</p>
                )}

                <button
                  onClick={placeBet}
                  disabled={placing || (balance !== null && amount > balance)}
                  className="tregu-btn-primary"
                  style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, cursor: "pointer" }}
                >
                  {placing ? "Duke vendosur..." : `Vër bast ${side}`}
                </button>

                {betMsg && (
                  <p style={{ marginTop: 12, fontSize: 13, color: betMsg.ok ? "#00A651" : "#E41E20" }}>{betMsg.text}</p>
                )}
              </>
            )}
          </div>

          {detailMode === "advanced" && (
            <section className="tregu-glass" style={{ padding: 24 }} aria-label="Paneli i avancuar i tregut">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>Kokpiti i tregut</h3>
                  <p style={{ fontSize: 12, color: "#6B6B6B", margin: 0 }}>I njëjti grafik LMSR sipër është burimi i vetëm i çmimit; këtu shfaqet evidenca pas lëvizjeve.</p>
                </div>
                <span style={{ fontSize: 12, color: "#6B6B6B" }}>Likuiditeti b: <strong style={{ color: "#111111" }}>{market.b}</strong></span>
              </div>
              <div role="group" aria-label="Filtro lëvizjet" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0" }}>
                {(["all", "trade", "news_oracle"] as const).map((filter) => (
                  <button key={filter} onClick={() => setMovementFilter(filter)} aria-pressed={movementFilter === filter} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(17,17,17,.15)", background: movementFilter === filter ? "#111111" : "transparent", color: movementFilter === filter ? "#fff" : "#111111", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{filter === "all" ? "Të gjitha" : filter === "trade" ? "Baste" : "Oracle lajmesh"}</button>
                ))}
              </div>
              {timeline.length === 0 ? <p style={{ color: "#6B6B6B", fontSize: 13 }}>Nuk ka lëvizje të verifikuara për këtë filtër.</p> : (
                <div style={{ display: "grid", gap: 10 }}>
                  {timeline.map((snapshot, index) => (
                    <article key={`${snapshot.created_at}-${index}`} style={{ padding: "12px 0", borderTop: "1px solid rgba(17,17,17,.09)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                        <strong>{snapshot.oracle_kind === "trade" ? "Bast 383C" : snapshot.oracle_kind === "news_oracle" ? "Oracle i verifikuar" : "Referencë lajmesh"}</strong>
                        <span>{new Date(snapshot.created_at).toLocaleString("sq-AL")}</span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#374151" }}>PO {Math.round(snapshot.market_prob * 100)}% · Vëllimi {Math.round(snapshot.volume ?? 0)} 383C{snapshot.reference_probability !== null && snapshot.reference_probability !== undefined ? ` · Referenca PO ${Math.round(snapshot.reference_probability * 100)}%` : ""}{snapshot.oracle_cap ? ` · Kufiri ${(snapshot.oracle_cap * 100).toFixed(0)} pikë` : ""}</p>
                      {snapshot.oracle_reasoning && <p style={{ margin: "6px 0 0", fontSize: 13 }}>{snapshot.oracle_reasoning}</p>}
                    </article>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(17,17,17,.09)" }}>
                <h4 style={{ fontSize: 14, margin: "0 0 8px" }}>Burime të papërpunuara</h4>
                {latestEvidence.length === 0 ? <p style={{ color: "#6B6B6B", fontSize: 13, margin: 0 }}>Ende nuk ka burime të dokumentuara.</p> : latestEvidence.map((e) => e.url ? (
                  <a key={e.slug} href={e.url} target="_blank" rel="noreferrer" style={{ display: "block", color: "#111111", fontSize: 13, marginTop: 8 }}>{e.title} ↗</a>
                ) : <p key={e.slug} style={{ color: "#6B6B6B", fontSize: 13, margin: "8px 0 0" }}>{e.title} — lidhja e burimit nuk është ruajtur.</p>)}
              </div>
              {latestReference?.oracle_reasoning && <p style={{ fontSize: 12, color: "#6B6B6B", margin: "18px 0 0" }}>Oracle lëviz vetëm gjendjen LMSR me kufi të audituar; nuk ndryshon 383C, bilancet ose pozicionet.</p>}
            </section>
          )}
        </div>
      </main>
      <style jsx global>{`@media (prefers-reduced-motion: reduce) { .tregu-live-dot span, .tregu-scope * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`}</style>
    </div>
  );
}
