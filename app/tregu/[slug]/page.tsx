"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import MarketChart from "@/components/tregu/market-chart";
import MarketMiniCard, { type MiniMarket } from "@/components/tregu/market-mini-card";
import CoinFace from "@/components/tregu/coin-face";
import { createClient } from "@/lib/supabase/client";
import { previewBet, previewSell, lmsrPriceYes, type Side, type MarketTrade } from "@/lib/tregu-client";

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

  const load = useCallback(() => {
    fetch(`/api/tregu/markets/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setNotFound(true);
          return;
        }
        setMarket(d.market);
        setSnapshots(d.snapshots ?? []);
        setTrades(d.trades ?? []);
        setActivity(d.activity ?? []);
        setRelated(d.related ?? []);
        setWeeklyDelta(d.weeklyDelta ?? null);
        setTradeCount(d.tradeCount ?? 0);
        setPositions(Array.isArray(d.position) ? d.position : []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

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
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) refreshBalance();
    });
  }, [slug, load, refreshBalance]);

  const heldOn = (s: Side) => positions.find((p) => p.side === s && p.shares > 0);
  const held = heldOn(side);

  const submitTrade = async () => {
    if (!market) return;
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
  const currentPrice = lmsrPriceYes(market.q_yes, market.q_no, market.b);
  const sidePrice = side === "PO" ? currentPrice : 1 - currentPrice;
  const pct = Math.round(market.market_prob * 100);
  const isClosed = market.status !== "open";
  const volume = Math.round(market.q_yes + market.q_no);
  const deltaPp = weeklyDelta === null ? null : Math.round(weeklyDelta * 100);

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

  return (
    <div className="tregu-scope">
      <Navbar />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "104px 24px 80px" }}>
        <Link href="/tregu" style={{ color: "#6B6B6B", fontSize: 13, textDecoration: "none" }}>
          ← Tregu
        </Link>

        {/* ── Header: pills, question, ticker ── */}
        <div className="tregu-glass" style={{ padding: "24px 28px", marginTop: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
            {market.status === "resolved" && (
              <span className="tregu-pill" style={{ color: market.outcome === "PO" ? "#00A651" : "#E41E20" }}>
                U zgjidh: {market.outcome}
              </span>
            )}
            {market.status === "closed" && <span className="tregu-pill">Mbyllur</span>}
            {market.status === "open" && <span className="tregu-pill">{closesIn(market.closes_at)}</span>}
            <span className="tregu-pill" style={{ fontVariantNumeric: "tabular-nums" }}>
              Vëllimi {volume.toLocaleString("sq-AL")} 383C · {tradeCount} tregtime
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.25 }}>
            {market.question}
          </h1>
          {market.description && <p style={{ color: "#6B6B6B", fontSize: 14, margin: "0 0 16px" }}>{market.description}</p>}
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: pct >= 50 ? "#00A651" : "#E41E20", fontVariantNumeric: "tabular-nums" }}>
              {pct}%
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#6B6B6B" }}>gjasa PO</span>
            {deltaPp !== null && deltaPp !== 0 && (
              <span className="tregu-delta-chip" data-dir={deltaPp > 0 ? "up" : "down"}>
                {deltaPp > 0 ? "▲" : "▼"} {Math.abs(deltaPp)}pp këtë javë
              </span>
            )}
          </div>
        </div>

        {/* ── 2-col: chart + feed | bet slip + rules ── */}
        <div className="tregu-detail-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div className="tregu-glass" style={{ padding: 24 }}>
              <MarketChart trades={trades} snapshots={snapshots} currentProb={market.market_prob} />
            </div>

            {activity.length > 0 && (
              <div className="tregu-glass" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 14px" }}>Aktiviteti</h3>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activity.map((t) => (
                    <div key={t.id} className="tregu-activity-row">
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 700 }}>{t.profiles?.display_name || "Anonim"}</span>{" "}
                        <span style={{ color: "#6B6B6B" }}>{t.action === "buy" ? "bleu" : "shiti"}</span>{" "}
                        <span style={{ fontWeight: 800, color: t.side === "PO" ? "#00A651" : "#E41E20" }}>{t.side}</span>{" "}
                        <span style={{ color: "#6B6B6B", fontVariantNumeric: "tabular-nums" }}>
                          {Number(t.coins).toFixed(0)} 383C · {Math.round(t.price_yes * 100)}%
                        </span>
                      </div>
                      <span style={{ color: "#6B6B6B", fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

          {/* ── Right column ── */}
          <aside className="tregu-detail-side">
            <div className="tregu-glass tregu-glass-hi" style={{ padding: 24 }}>
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
                        <CoinFace size={16} /> {balance.toLocaleString("sq-AL")}
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
                          className={active ? (s === "PO" ? "tregu-btn-yes" : "tregu-btn-no") : undefined}
                          type="button"
                          style={{
                            flex: 1,
                            padding: "12px 10px",
                            borderRadius: 12,
                            fontWeight: 800,
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.4 : 1,
                            background: active ? undefined : "rgba(17,17,17,0.04)",
                            border: active ? undefined : "1px solid rgba(17,17,17,0.10)",
                            color: active ? undefined : "#111111",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            transition: "transform 160ms var(--ease-out), background-color 200ms var(--ease-out)",
                          }}
                        >
                          <span>{s}</span>
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
                          <button key={q} className="tregu-chip" data-active={amount === q} onClick={() => setAmount(q)} type="button">
                            {q}
                          </button>
                        ))}
                        {balance !== null && balance >= 1 && (
                          <button className="tregu-chip" data-active={amount === Math.floor(balance)} onClick={() => setAmount(Math.floor(balance))} type="button">
                            Max
                          </button>
                        )}
                      </div>

                      {buyPreview && (
                        <div className="tregu-slip-summary">
                          <div><span>Çmimi aktual {side}</span><strong>{(sidePrice * 100).toFixed(1)}%</strong></div>
                          <div><span>Aksione</span><strong>{buyPreview.shares.toFixed(2)}</strong></div>
                          <div><span>Çmimi mesatar</span><strong>{(buyPreview.avgPrice * 100).toFixed(1)}%</strong></div>
                          <div>
                            <span>Ndikimi në çmim</span>
                            <strong style={{ color: impactPp > 5 ? "#B45309" : undefined }}>
                              {impactPp.toFixed(1)}pp{impactPp > 5 ? " ⚠" : ""}
                            </strong>
                          </div>
                          <div>
                            <span>Fitimi nëse {side}</span>
                            <strong style={{ color: "#00854A" }}>
                              +{potentialProfit.toFixed(1)} 383C ({roi.toFixed(0)}%)
                            </strong>
                          </div>
                        </div>
                      )}

                      {balance !== null && amount > balance && (
                        <p style={{ color: "#E41E20", fontSize: 12, marginBottom: 12 }}>Nuk ke mjaftueshëm 383 Coin ({balance})</p>
                      )}

                      <button
                        onClick={submitTrade}
                        disabled={!canBuy}
                        className="tregu-btn-primary"
                        style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, cursor: "pointer" }}
                      >
                        {placing ? "Duke blerë..." : `Blej ${side} · ${amount} 383C`}
                      </button>
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

                      <button
                        onClick={submitTrade}
                        disabled={!canSell}
                        className="tregu-btn-primary"
                        style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, cursor: "pointer" }}
                      >
                        {placing ? "Duke shitur..." : `Shit ${side}`}
                      </button>
                    </>
                  )}

                  {tradeMsg && (
                    <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: tradeMsg.ok ? "#00854A" : "#E41E20" }}>{tradeMsg.text}</p>
                  )}
                </>
              )}
            </div>

            {/* Resolution rules — the trust surface. */}
            <div className="tregu-glass" style={{ padding: 24 }}>
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

        {/* ── Related markets ── */}
        {related.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>Tregje të ngjashme</h2>
            <div className="tregu-related-grid">
              {related.map((m) => (
                <MarketMiniCard key={m.slug} market={m} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
