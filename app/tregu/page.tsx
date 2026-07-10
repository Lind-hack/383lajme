"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar";
import MarketMiniCard from "@/components/tregu/market-mini-card";
import VideoHero from "@/components/tregu/video-hero";
import CoinFace from "@/components/tregu/coin-face";
import MobileAccountBar from "@/components/tregu/mobile-account-bar";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("vellim");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [coinSpin, setCoinSpin] = useState(false);
  const [flyCoins, setFlyCoins] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    const qs = category === "all" ? "" : `?category=${category}`;
    fetch(`/api/tregu/markets${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setMarkets(d.markets ?? []);
        setUpdatedAt(new Date().toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" }));
      })
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      fetch("/api/tregu/portfolio")
        .then((r) => r.json())
        .then((d) => setBalance(d.profile?.coins ?? null));
    });
  }, []);

  // Live floor totals — real numbers computed from the loaded book.
  const totals = useMemo(
    () => ({
      count: markets.length,
      volume: markets.reduce((s, m) => s + vol(m), 0),
    }),
    [markets]
  );

  // Sorting is the affordance that makes the trader think: chase volume,
  // beat the clock, or hunt the most contested (closest-to-50) markets.
  const sorted = useMemo(() => {
    const arr = [...markets];
    if (sort === "vellim") arr.sort((a, b) => vol(b) - vol(a));
    else if (sort === "afat")
      arr.sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime());
    else if (sort === "nxehta")
      arr.sort((a, b) => Math.abs(0.5 - a.market_prob) - Math.abs(0.5 - b.market_prob));
    return arr;
  }, [markets, sort]);

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
            <span className="tregu-stat-value">{loading ? "—" : totals.count.toLocaleString("sq-AL")}</span>
          </span>
          <span className="tregu-stat">
            <span className="tregu-stat-label">Vëllimi</span>
            <span className="tregu-stat-value">
              {loading ? "—" : `${Math.round(totals.volume).toLocaleString("sq-AL")} 383C`}
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
                {balance.toLocaleString("sq-AL")}
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

        {/* Controls — count + segmented sort (traders sort). */}
        <div className="tregu-controls">
          <span className="tregu-count">
            {loading ? (
              "Duke ngarkuar tregjet…"
            ) : (
              <>
                <strong>{sorted.length}</strong> {sorted.length === 1 ? "treg aktiv" : "tregje aktive"}
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
          <div className="tregu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="tregu-glass" style={{ height: 208, opacity: 0.5 }} />
            ))}
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
              <MarketMiniCard
                key={m.id}
                market={{
                  slug: m.slug,
                  question: m.question,
                  category: m.category,
                  prob: m.market_prob,
                  volume: vol(m),
                  closesAt: m.closes_at,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
