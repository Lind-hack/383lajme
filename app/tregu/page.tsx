"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import MarketMiniCard from "@/components/tregu/market-mini-card";
import VideoHero from "@/components/tregu/video-hero";
import CoinFace from "@/components/tregu/coin-face";
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

export default function TreguHub() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [coinSpin, setCoinSpin] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = category === "all" ? "" : `?category=${category}`;
    fetch(`/api/tregu/markets${qs}`)
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets ?? []))
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

  const claimBonus = async () => {
    setClaiming(true);
    setBonusMsg(null);
    const res = await fetch("/api/tregu/daily-bonus", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setBonusMsg(`+${data.bonus} 383C!`);
      setBalance((b) => (b === null ? null : b + Number(data.bonus)));
      // Earn flip on the chip coin — same state as the approved coin mock.
      setCoinSpin(true);
      window.setTimeout(() => setCoinSpin(false), 950);
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
      <main id="tregjet" style={{ maxWidth: 1160, margin: "0 auto", padding: "56px 24px 80px", scrollMarginTop: 88 }}>
        {/* Header — accent bar + uppercase label, same pattern as the homepage sections */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 4, height: 34, background: "#FF4422", borderRadius: 2, flexShrink: 0 }} />
            <div>
              <h1 style={{ fontSize: "clamp(24px, 3.2vw, 34px)", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                Tregu
              </h1>
              <p style={{ color: "#6B6B6B", fontSize: 13, margin: "2px 0 0" }}>
                Parashiko të ardhmen. Vër bast me 383 Coin.
              </p>
            </div>
          </div>

          {balance !== null && (
            <div className="tregu-glass" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
              <CoinFace size={28} spinning={coinSpin} hoverTilt />
              <span style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
                {balance.toLocaleString("sq-AL")}
              </span>
              <button
                onClick={claimBonus}
                disabled={claiming}
                className="tregu-btn-primary"
                style={{ padding: "7px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer" }}
              >
                {claiming ? "..." : "Bonusi ditor"}
              </button>
              {bonusMsg && <span style={{ fontSize: 12, fontWeight: 700, color: "#00A651" }}>{bonusMsg}</span>}
              <Link href="/tregu/portofoli" style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700, textDecoration: "none" }}>
                Portofoli →
              </Link>
            </div>
          )}
        </div>

        {/* Category filters — ink active state, matches the rest of the site */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
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

        {loading ? (
          <div className="tregu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="tregu-glass" style={{ height: 180, opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <div className="tregu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
            {markets.map((m) => (
              <MarketMiniCard
                key={m.id}
                market={{
                  slug: m.slug,
                  question: m.question,
                  category: m.category,
                  prob: m.market_prob,
                  volume: (m.q_yes ?? 0) + (m.q_no ?? 0),
                  closesAt: m.closes_at,
                }}
              />
            ))}
            {markets.length === 0 && (
              <div className="tregu-glass" style={{ padding: 24, color: "#6B6B6B", fontSize: 14 }}>
                Nuk ka tregje aktive për këtë kategori ende.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
