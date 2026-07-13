"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import CoinFace from "@/components/tregu/coin-face";
import { createClient } from "@/lib/supabase/client";
import { fmtNum } from "@/lib/format";

interface Position {
  id: string;
  market_id: string;
  side: "PO" | "JO";
  shares: number;
  coins_staked: number;
  currentPrice: number | null;
  currentValue: number | null;
  entryPrice: number | null;
  unrealizedPnl: number | null;
  markets: { question: string; slug: string; status: string; outcome: string | null } | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  meta: Record<string, unknown> | null;
}

interface Profile {
  coins: number;
  display_name: string | null;
}

interface Withdrawal {
  id: string;
  status: string;
  coins_amount: number;
  payout_method: string;
  requested_at: string;
}

interface Stats {
  coins: number;
  openValue: number;
  totalValue: number;
  openStaked: number;
  openPnl: number;
  realizedPnl: number;
  winRate: number | null;
  settledCount: number;
}

const TX_LABEL: Record<string, string> = {
  signup_bonus: "Bonus regjistrimi",
  daily_bonus: "Bonus ditor",
  bet: "Blerje",
  sell: "Shitje",
  payout: "Fitim",
  withdrawal: "Tërheqje",
};

function pnlColor(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return "#6B6B6B";
  return v > 0 ? "#00854A" : "#E41E20";
}

function signed(v: number, digits = 1): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;
}

// 30-day coin balance — small dependency-free SVG area chart with hover.
function BalanceChart({ history }: { history: { t: number; coins: number }[] }) {
  const [hover, setHover] = useState<{ frac: number; t: number; coins: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const W = 640;
  const H = 140;
  const PAD = 10;

  if (history.length < 2) {
    return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>Ende pa histori</div>;
  }

  const tMin = history[0].t;
  const tMax = history[history.length - 1].t;
  const vals = history.map((h) => h.coins);
  const vMin = Math.min(...vals);
  const vMax = Math.max(...vals);
  const spread = vMax - vMin || 1;
  const xFor = (t: number) => ((t - tMin) / (tMax - tMin || 1)) * W;
  const yFor = (v: number) => PAD + (1 - (v - vMin) / spread) * (H - PAD * 2);

  // Step line — the balance holds between transactions.
  let path = "";
  history.forEach((h, i) => {
    path += i === 0 ? `M ${xFor(h.t).toFixed(1)} ${yFor(h.coins).toFixed(1)}` : ` H ${xFor(h.t).toFixed(1)} V ${yFor(h.coins).toFixed(1)}`;
  });
  const area = `${path} L ${W} ${H - PAD} L 0 ${H - PAD} Z`;
  const last = history[history.length - 1];
  const up = last.coins >= history[0].coins;
  const stroke = up ? "#00854A" : "#B91C1C";

  const onMove = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = tMin + frac * (tMax - tMin);
    // Step semantics: the balance at time t is the last entry at or before t.
    let cur = history[0];
    for (const h of history) if (h.t <= t) cur = h;
    setHover({ frac, t, coins: cur.coins });
  };

  return (
    <div ref={boxRef} style={{ position: "relative", touchAction: "pan-y" }} onPointerMove={(e) => onMove(e.clientX)} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="tg-bal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tg-bal)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        {hover ? (
          <line x1={hover.frac * W} y1={PAD} x2={hover.frac * W} y2={H - PAD} stroke="rgba(17,17,17,0.28)" strokeDasharray="3 3" />
        ) : (
          <circle cx={W} cy={yFor(last.coins)} r="4" fill={stroke} stroke="#FFFFFF" strokeWidth="2" />
        )}
      </svg>
      {hover && (
        <div className="tregu-chart-tip" style={{ left: `${Math.max(12, Math.min(88, hover.frac * 100))}%`, top: 0 }}>
          <div className="tregu-chart-tip-date">{new Date(hover.t).toLocaleDateString("sq-AL", { day: "numeric", month: "short" })}</div>
          <div className="tregu-chart-tip-row">
            <span className="tregu-chart-tip-dot" style={{ background: stroke }} />
            <strong>{fmtNum(hover.coins)} 383C</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortofoliPage() {
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<{ t: number; coins: number }[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [payoutMethod, setPayoutMethod] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSell, setConfirmSell] = useState<string | null>(null); // position id awaiting confirm
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellMsg, setSellMsg] = useState<string | null>(null);

  const load = () => {
    setLoadError(false);
    Promise.all([
      fetch("/api/tregu/portfolio").then((r) => {
        if (!r.ok) throw new Error(`portfolio ${r.status}`);
        return r.json();
      }),
      fetch("/api/tregu/withdraw").then((r) => {
        if (!r.ok) throw new Error(`withdraw ${r.status}`);
        return r.json();
      }),
    ])
      .then(([p, w]) => {
        setProfile(p.profile ?? null);
        setPositions(p.positions ?? []);
        setTransactions(p.transactions ?? []);
        setStats(p.stats ?? null);
        setBalanceHistory(p.balanceHistory ?? []);
        setWithdrawals(w.withdrawals ?? []);
      })
      // A failed fetch must never render as a zero balance.
      .catch(() => setLoadError(true))
      .finally(() => setLoadingProfile(false));
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(Boolean(user));
      setCheckedAuth(true);
      if (user) load();
    });
  }, []);

  const cashOut = async (p: Position) => {
    if (confirmSell !== p.id) {
      setConfirmSell(p.id);
      // Confirm window expires so a stray click never sells later.
      setTimeout(() => setConfirmSell((c) => (c === p.id ? null : c)), 4000);
      return;
    }
    setConfirmSell(null);
    setSellingId(p.id);
    setSellMsg(null);
    const res = await fetch("/api/tregu/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId: p.market_id, side: p.side, shares: p.shares }),
    });
    const data = await res.json();
    if (res.ok) {
      setSellMsg(`✓ Dole nga pozicioni — more ${Number(data.coinsReceived ?? 0).toFixed(1)} 383C`);
      load();
    } else {
      setSellMsg(data.error ?? "Gabim gjatë shitjes");
    }
    setSellingId(null);
  };

  const requestWithdraw = async () => {
    if (!payoutMethod.trim()) return;
    setSubmitting(true);
    setWithdrawMsg(null);
    const res = await fetch("/api/tregu/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutMethod }),
    });
    const data = await res.json();
    if (res.ok) {
      setWithdrawMsg("Kërkesa u dërgua! Do të përpunohet brenda pak ditësh.");
      setPayoutMethod("");
      load();
    } else {
      setWithdrawMsg(data.error ?? "Gabim");
    }
    setSubmitting(false);
  };

  if (checkedAuth && !signedIn) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <div style={{ padding: "140px 24px", textAlign: "center" }}>
          <p style={{ marginBottom: 16 }}>Duhet të kyçesh për të parë portofolin tënd.</p>
          <Link href="/hyr" className="tregu-btn-primary" style={{ padding: "10px 22px", borderRadius: 100, textDecoration: "none" }}>
            Hyr
          </Link>
        </div>
      </div>
    );
  }

  if (checkedAuth && signedIn && loadingProfile) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "104px 24px 80px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 24px" }}>Portofoli</h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="tregu-glass"
                style={{ height: 92, borderRadius: 16, opacity: 0.5 }}
                aria-hidden
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (checkedAuth && signedIn && loadError) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "104px 24px 80px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 24px" }}>Portofoli</h1>
          <div className="tregu-glass" style={{ padding: "40px 28px", textAlign: "center" }}>
            <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Portofoli nuk u ngarkua</p>
            <p style={{ color: "#6B6B6B", fontSize: 14, margin: "6px 0 16px" }}>
              Kontrollo lidhjen me internetin dhe provo përsëri.
            </p>
            <button
              onClick={() => {
                setLoadingProfile(true);
                load();
              }}
              className="tregu-btn-primary"
              style={{ padding: "10px 22px", borderRadius: 100, fontSize: 13, cursor: "pointer" }}
            >
              Provo përsëri
            </button>
          </div>
        </main>
      </div>
    );
  }

  const canWithdraw = (profile?.coins ?? 0) >= 10000;

  return (
    <div className="tregu-scope">
      <Navbar />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "104px 24px 80px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 24px" }}>Portofoli</h1>

        {/* ── Stat tiles ── */}
        <div className="tregu-tiles">
          <div className="tregu-glass tregu-glass-hi tregu-tile">
            <span className="tregu-tile-label">Vlera totale</span>
            <span className="tregu-tile-value" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <CoinFace size={22} />
              {fmtNum(stats?.totalValue ?? profile?.coins ?? 0)}
            </span>
            <span className="tregu-tile-sub">{fmtNum(profile?.coins ?? 0)} të lira · 10,000 = 10€</span>
          </div>
          <div className="tregu-glass tregu-tile">
            <span className="tregu-tile-label">Në pozicione</span>
            <span className="tregu-tile-value">{fmtNum(stats?.openValue ?? 0)}</span>
            <span className="tregu-tile-sub">{fmtNum(stats?.openStaked ?? 0)} 383C të investuara</span>
          </div>
          <div className="tregu-glass tregu-tile">
            <span className="tregu-tile-label">P/L i hapur</span>
            <span className="tregu-tile-value" style={{ color: pnlColor(stats?.openPnl) }}>
              {stats ? signed(stats.openPnl) : "—"}
            </span>
            <span className="tregu-tile-sub">vlera kundrejt investimit</span>
          </div>
          <div className="tregu-glass tregu-tile">
            <span className="tregu-tile-label">P/L i realizuar</span>
            <span className="tregu-tile-value" style={{ color: pnlColor(stats?.realizedPnl) }}>
              {stats ? signed(stats.realizedPnl) : "—"}
            </span>
            <span className="tregu-tile-sub">
              {stats?.winRate !== null && stats?.winRate !== undefined
                ? `${Math.round(stats.winRate * 100)}% fitore · ${stats.settledCount} tregje`
                : "ende pa tregje të mbyllura"}
            </span>
          </div>
        </div>

        {/* ── 30-day balance ── */}
        <div className="tregu-glass" style={{ padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>Bilanci — 30 ditët e fundit</h2>
          <BalanceChart history={balanceHistory} />
        </div>

        {/* ── Positions table ── */}
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Pozicionet aktive</h2>
        {sellMsg && <p style={{ fontSize: 13, fontWeight: 600, color: sellMsg.startsWith("✓") ? "#00854A" : "#E41E20", marginBottom: 12 }}>{sellMsg}</p>}
        {positions.length === 0 ? (
          <p style={{ color: "#6B6B6B", fontSize: 13, marginBottom: 28 }}>
            Ende pa pozicione — <Link href="/tregu" style={{ color: "#00854A" }}>shko te Tregu</Link> dhe vër bastin e parë.
          </p>
        ) : (
          <div className="tregu-glass tregu-table-wrap" style={{ marginBottom: 28 }}>
            <div className="tregu-table">
              <div className="tregu-table-head">
                <span>Tregu</span>
                <span>Ana</span>
                <span>Aksione</span>
                <span>Hyrja</span>
                <span>Tani</span>
                <span>Vlera</span>
                <span>P/L</span>
                <span />
              </div>
              {positions.map((p) => {
                const open = p.markets?.status === "open";
                return (
                  <div key={p.id} className="tregu-table-row">
                    <Link href={`/tregu/${p.markets?.slug}`} style={{ color: "#111111", textDecoration: "none", fontWeight: 700, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.markets?.question}
                    </Link>
                    <span className="tregu-pill" style={{ color: p.side === "PO" ? "#00A651" : "#E41E20", justifySelf: "start" }}>{p.side}</span>
                    <span>{Number(p.shares).toFixed(2)}</span>
                    <span>{p.entryPrice !== null ? `${(p.entryPrice * 100).toFixed(0)}%` : "—"}</span>
                    <span>{p.currentPrice !== null ? `${(p.currentPrice * 100).toFixed(0)}%` : "—"}</span>
                    <span style={{ fontWeight: 800 }}>{p.currentValue !== null ? p.currentValue.toFixed(1) : "—"}</span>
                    <span style={{ fontWeight: 800, color: pnlColor(p.unrealizedPnl) }}>
                      {p.unrealizedPnl !== null ? signed(p.unrealizedPnl) : "—"}
                    </span>
                    {open ? (
                      <button
                        className="tregu-chip"
                        data-active={confirmSell === p.id}
                        onClick={() => cashOut(p)}
                        disabled={sellingId === p.id}
                        type="button"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {sellingId === p.id ? "..." : confirmSell === p.id ? "Konfirmo" : "Dil"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: "#6B6B6B" }}>{p.markets?.status === "resolved" ? "U zgjidh" : "Mbyllur"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Withdraw ── */}
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Tërhiqe fitimin</h2>
        <div className="tregu-glass" style={{ padding: 20, marginBottom: 28 }}>
          {canWithdraw ? (
            <>
              <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 12 }}>
                Ke {fmtNum(profile?.coins ?? 0)} 383 Coin — mund të tërheqësh 10,000 për 10€.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  placeholder="PayPal email ose IBAN"
                  className="tregu-input"
                  style={{ fontSize: 13, fontWeight: 500 }}
                />
                <button
                  onClick={requestWithdraw}
                  disabled={submitting || !payoutMethod.trim()}
                  className="tregu-btn-primary"
                  style={{ padding: "10px 20px", borderRadius: 10, cursor: "pointer" }}
                >
                  Kërko
                </button>
              </div>
              {withdrawMsg && <p style={{ fontSize: 12, marginTop: 10, color: "#B45309" }}>{withdrawMsg}</p>}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#6B6B6B" }}>
              Duhen 10,000 383 Coin për të tërhequr (ke {fmtNum(profile?.coins ?? 0)}).
            </p>
          )}

          {withdrawals.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {withdrawals.map((w) => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6B6B" }}>
                  <span>{new Date(w.requested_at).toLocaleDateString("sq-AL")} · {w.coins_amount} 383C</span>
                  <span style={{ fontWeight: 700, color: statusColor(w.status) }}>{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── History ── */}
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Historiku</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {transactions.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6B6B", padding: "8px 4px", borderBottom: "1px solid rgba(17,17,17,0.08)" }}>
              <span>{TX_LABEL[t.type] ?? t.type} · {new Date(t.created_at).toLocaleDateString("sq-AL")}</span>
              <span style={{ color: t.amount >= 0 ? "#00854A" : "#E41E20", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {t.amount >= 0 ? "+" : ""}
                {Number(t.amount).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function statusColor(status: string) {
  if (status === "paid") return "#00A651";
  if (status === "rejected") return "#E41E20";
  return "#B45309";
}
