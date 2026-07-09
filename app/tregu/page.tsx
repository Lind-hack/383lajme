"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import MarketMiniCard, { type MiniMarket } from "@/components/tregu/market-mini-card";
import CoinIcon from "@/components/tregu/coin-icon";
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
    } else {
      setBonusMsg(data.error ?? "Gabim");
    }
    setClaiming(false);
  };

  const featured = markets[0];

  return (
    <div className="tregu-scope">
      <Navbar />
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "104px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              383 Tregu
            </h1>
            <p style={{ color: "#8B90A0", fontSize: 14, marginTop: 6 }}>
              Parashiko të ardhmen e Kosovës. Vër bast me 383 Coin.
            </p>
          </div>
          {balance !== null ? (
            <div className="tregu-glass" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
              <CoinIcon size={26} />
              <span style={{ fontWeight: 800, fontSize: 17 }}>{balance.toLocaleString("sq-AL")}</span>
              <button
                onClick={claimBonus}
                disabled={claiming}
                className="tregu-btn-primary"
                style={{ padding: "7px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer" }}
              >
                {claiming ? "..." : "Bonusi ditor"}
              </button>
              {bonusMsg && <span style={{ fontSize: 12, color: "#F5B942" }}>{bonusMsg}</span>}
              <Link href="/tregu/portofoli" style={{ fontSize: 12, color: "#8B90A0", fontWeight: 700 }}>
                Portofoli →
              </Link>
            </div>
          ) : (
            <Link href="/hyr" className="tregu-btn-primary" style={{ padding: "10px 20px", borderRadius: 100, fontSize: 13, textDecoration: "none" }}>
              Merr 100 383 Coin falas
            </Link>
          )}
        </div>

        {featured && (
          <Link
            href={`/tregu/${featured.slug}`}
            className="tregu-glass tregu-glass-hi"
            style={{ display: "block", padding: 24, marginBottom: 28, textDecoration: "none", color: "#F3F4F7" }}
          >
            <span className="tregu-pill" style={{ marginBottom: 12, display: "inline-flex" }}>
              I zgjedhur
            </span>
            <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.3 }}>{featured.question}</p>
            <div style={{ maxWidth: 420 }}>
              <ProbBarInline prob={featured.market_prob} />
            </div>
          </Link>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              style={{
                padding: "8px 16px",
                borderRadius: 100,
                border: "1px solid " + (category === c.value ? "transparent" : "rgba(255,255,255,0.12)"),
                background: category === c.value ? "linear-gradient(135deg, #FF4422, #F5B942)" : "rgba(255,255,255,0.04)",
                color: category === c.value ? "#06070A" : "#F3F4F7",
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "#8B90A0" }}>Duke ngarkuar...</p>
        ) : markets.length === 0 ? (
          <p style={{ color: "#8B90A0" }}>Nuk ka tregje aktive për këtë kategori ende.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {markets.map((m) => (
              <MarketMiniCard
                key={m.id}
                market={{ slug: m.slug, question: m.question, category: m.category, prob: m.market_prob }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProbBarInline({ prob }: { prob: number }) {
  const pct = Math.round(prob * 100);
  const color = pct >= 50 ? "#00E599" : "#FF3B5C";
  return (
    <div>
      <div className="tregu-prob-track" style={{ height: 10 }}>
        <div className="tregu-prob-marker" style={{ left: `${pct}%`, boxShadow: `0 0 0 3px rgba(0,0,0,0.4), 0 0 16px ${color}` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: "#FF3B5C" }}>JO</span>
        <span style={{ color, fontSize: 16 }}>{pct}% PO</span>
        <span style={{ color: "#00E599" }}>PO</span>
      </div>
    </div>
  );
}
