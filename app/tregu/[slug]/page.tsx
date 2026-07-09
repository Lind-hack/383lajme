"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import ProbChart, { type ChartPoint } from "@/components/tregu/prob-chart";
import CoinIcon from "@/components/tregu/coin-icon";
import { createClient } from "@/lib/supabase/client";
import { previewBet, lmsrPriceYes, type Side } from "@/lib/tregu-client";

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
}

interface Snapshot {
  ai_prob: number | null;
  market_prob: number;
  created_at: string;
  evidence: { title: string; slug: string; url?: string }[] | null;
}

export default function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [side, setSide] = useState<Side>("PO");
  const [amount, setAmount] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [betMsg, setBetMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    fetch(`/api/tregu/markets/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setNotFound(true);
          return;
        }
        setMarket(d.market);
        setSnapshots(d.snapshots ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Card PO/JO buttons deep-link with ?ana=po|jo to pre-select the side.
    const ana = new URLSearchParams(window.location.search).get("ana");
    if (ana === "po") setSide("PO");
    if (ana === "jo") setSide("JO");
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetch("/api/tregu/portfolio")
          .then((r) => r.json())
          .then((d) => setBalance(d.profile?.coins ?? null));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
    ...snapshots.map((s) => ({ t: s.created_at, aiProb: s.ai_prob, marketProb: s.market_prob })),
    { t: "now", aiProb: null, marketProb: market.market_prob },
  ];

  const latestEvidence = [...snapshots].reverse().find((s) => s.evidence && s.evidence.length > 0)?.evidence ?? [];

  const preview = amount > 0 ? previewBet({ q_yes: market.q_yes, q_no: market.q_no, b: market.b }, side, amount) : null;
  const currentPrice = lmsrPriceYes(market.q_yes, market.q_no, market.b);
  const pct = Math.round(market.market_prob * 100);
  const isClosed = market.status !== "open";

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
              {market.status === "resolved" && (
                <span className="tregu-pill" style={{ color: market.outcome === "PO" ? "#00A651" : "#E41E20" }}>
                  U zgjidh: {market.outcome}
                </span>
              )}
              {market.status === "closed" && <span className="tregu-pill">Mbyllur</span>}
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.25 }}>
              {market.question}
            </h1>
            {market.description && <p style={{ color: "#6B6B6B", fontSize: 14, marginBottom: 20 }}>{market.description}</p>}
            <div style={{ fontSize: 40, fontWeight: 800, color: pct >= 50 ? "#00A651" : "#E41E20" }}>{pct}% PO</div>
            <p style={{ color: "#6B6B6B", fontSize: 12, marginTop: 4 }}>
              Mbyllet: {new Date(market.closes_at).toLocaleDateString("sq-AL")}
            </p>

            <div style={{ marginTop: 24 }}>
              <ProbChart points={points} />
            </div>
          </div>

          <div className="tregu-glass" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 16px" }}>Vendos bast</h3>

            {!user ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "#6B6B6B", marginBottom: 14 }}>Duhet të krijosh llogari për të vënë bast — merr 100 383 Coin falas.</p>
                <Link href="/hyr" className="tregu-btn-primary" style={{ padding: "10px 22px", borderRadius: 100, textDecoration: "none", display: "inline-block" }}>
                  Hyr / Regjistrohu
                </Link>
              </div>
            ) : isClosed ? (
              <p style={{ color: "#6B6B6B" }}>Ky treg nuk pranon më baste.</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <button
                    onClick={() => setSide("PO")}
                    className={side === "PO" ? "tregu-btn-yes" : undefined}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      background: side === "PO" ? undefined : "rgba(17,17,17,0.04)",
                      border: side === "PO" ? undefined : "1px solid rgba(17,17,17,0.10)",
                      color: side === "PO" ? undefined : "#111111",
                      transition: "transform 160ms var(--ease-out), background-color 200ms var(--ease-out)",
                    }}
                  >
                    PO
                  </button>
                  <button
                    onClick={() => setSide("JO")}
                    className={side === "JO" ? "tregu-btn-no" : undefined}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      background: side === "JO" ? undefined : "rgba(17,17,17,0.04)",
                      border: side === "JO" ? undefined : "1px solid rgba(17,17,17,0.10)",
                      color: side === "JO" ? undefined : "#111111",
                      transition: "transform 160ms var(--ease-out), background-color 200ms var(--ease-out)",
                    }}
                  >
                    JO
                  </button>
                </div>

                <label style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 700 }}>Shuma (383 Coin)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" }}>
                  <CoinIcon size={20} />
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

          {latestEvidence.length > 0 && (
            <div className="tregu-glass" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>Bazuar në lajme</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {latestEvidence.map((e) => (
                  <Link
                    key={e.slug}
                    href={`/article/${e.slug}`}
                    style={{ color: "#111111", fontSize: 13, textDecoration: "none", padding: "10px 14px", borderRadius: 10, background: "rgba(17,17,17,0.04)" }}
                  >
                    {e.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
