"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar";
import MarketMiniCard from "@/components/tregu/market-mini-card";
import FeaturedCarousel from "@/components/tregu/featured-carousel";
import type { MiniMarket } from "@/components/tregu/market-mini-card";
import VideoHero from "@/components/tregu/video-hero";
import CoinFace from "@/components/tregu/coin-face";
import MobileAccountBar from "@/components/tregu/mobile-account-bar";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { fmtNum } from "@/lib/format";

interface MarketRow {
  id: string;
  slug: string;
  question: string;
  category: string;
  market_prob: number;
  status: string;
  closes_at: string;
  q_yes: number;
  q_no: number;
  spark?: number[];
  delta7d?: number | null;
  trade_count?: number;
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
  return (m.q_yes ?? 0) + (m.q_no ?? 0);
}

export default function TreguHub() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("vellim");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [coinSpin, setCoinSpin] = useState(false);
  const [flyCoins, setFlyCoins] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    const qs = category === "all" ? "" : `?category=${category}`;
    fetch(`/api/tregu/markets${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`markets ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setMarkets(d.markets ?? []);
        setActivity(d.activity ?? []);
        setUpdatedAt(new Date().toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" }));
      })
      // Offline or a 5xx must never masquerade as "no markets exist".
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
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
      setFlyCoins(Array.from({ length: n }, (_, i) => performance.now() + i));
      setCoinSpin(true);
      window.setTimeout(() => setFlyCoins([]), n * 55 + 600);
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
      count: markets.length,
      volume: markets.reduce((s, m) => s + vol(m), 0),
    }),
    [markets]
  );

  // The big events: highest-volume open markets rotate through the flagship
  // carousel. Always volume-ranked regardless of the grid sort — size of the
  // book is what makes an event "big". Capped at 4 and never more than half
  // the floor, so the grid below always keeps something to browse.
  const featured = useMemo(() => {
    if (markets.length < 3) return [] as MarketRow[];
    const n = Math.min(4, Math.floor(markets.length / 2));
    return [...markets].sort((a, b) => vol(b) - vol(a)).slice(0, n);
  }, [markets]);

  // Sorting is the affordance that makes the trader think: chase volume,
  // beat the clock, or hunt the most contested (closest-to-50) markets.
  const sorted = useMemo(() => {
    const featuredSlugs = new Set(featured.map((m) => m.slug));
    const arr = markets.filter((m) => !featuredSlugs.has(m.slug));
    if (sort === "vellim") arr.sort((a, b) => vol(b) - vol(a));
    else if (sort === "afat")
      arr.sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime());
    else if (sort === "nxehta")
      arr.sort((a, b) => Math.abs(0.5 - a.market_prob) - Math.abs(0.5 - b.market_prob));
    return arr;
  }, [markets, featured, sort]);

  const toMini = (m: MarketRow): MiniMarket => ({
    slug: m.slug,
    question: m.question,
    category: m.category,
    prob: m.market_prob,
    volume: vol(m),
    closesAt: m.closes_at,
    spark: m.spark,
    delta7d: m.delta7d,
  });

  const claimBonus = async () => {
    setClaiming(true);
    setBonusMsg(null);
    const res = await fetch("/api/tregu/daily-bonus", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setBonusMsg(`+${data.bonus} 383C`);
      setBalance((b) => (b === null ? null : b + Number(data.bonus)));
      // Earn flip on the chip coin — same state as the approved coin mock.
      setCoinSpin(true);
      window.setTimeout(() => setCoinSpin(false), 950);
      // Stream coins into the mobile bar chip (the navbar chip that plays this
      // on desktop is hidden on mobile). Count scales with the bonus size.
      const n = Math.min(10, Math.max(4, Math.ceil(Number(data.bonus) / 25)));
      setFlyCoins(Array.from({ length: n }, (_, i) => performance.now() + i));
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
            <span className="tregu-stat-label">Vëllimi</span>
            <span className="tregu-stat-value">
              {loading || loadError ? "—" : `${fmtNum(totals.volume)} 383C`}
            </span>
          </span>
          <span className="tregu-stat">
            <span className="tregu-stat-label">Përditësuar</span>
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
            </div>
          </div>

          {balance !== null && (
            <div className="tregu-glass tregu-glass-hi tregu-headchip" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px 9px 14px" }}>
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
        <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
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
          <div className="tregu-ticker" aria-label="Tregtimet e fundit">
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
                  <span className="tregu-ticker-time">{timeAgo(a.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Flagship carousel — the biggest books rotate through one big card. */}
        {!loading && !loadError && featured.length > 0 && (
          <FeaturedCarousel key={category} markets={featured.map(toMini)} />
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
            {/* Carousel-shaped skeleton so the flagship slot doesn't pop in late. */}
            <div className="tregu-glass" style={{ height: 280, opacity: 0.5, marginBottom: 18, borderRadius: 18 }} />
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
        ) : sorted.length === 0 ? (
          <div className="tregu-glass" style={{ padding: "40px 28px", textAlign: "center" }}>
            <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Asnjë treg aktiv këtu ende</p>
            <p style={{ color: "#6B6B6B", fontSize: 14, margin: "6px 0 0" }}>
              Provo një kategori tjetër. Tregjet e reja lindin nga lajmet e ditës.
            </p>
          </div>
        ) : (
          <div className="tregu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {sorted.map((m) => (
              <MarketMiniCard key={m.id} market={toMini(m)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
