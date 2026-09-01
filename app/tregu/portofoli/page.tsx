"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Navbar from "@/components/navbar";
import CoinFace from "@/components/tregu/coin-face";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { formatKosovoDate } from "@/lib/tregu-local-time.mjs";
import styles from "./portfolio.module.css";

type Market = { question: string; slug: string; status: string; outcome: string | null; category: string; closes_at?: string; market_type?: string; market_classification?: string };
type Position = { id: string; market_id: string; side: string; sideLabel: string; shares: number; coins_staked: number; currentPrice: number | null; currentValue: number | null; entryPrice: number | null; unrealizedPnl: number | null; sideColor?: string | null; sideHeadshotUrl?: string | null; sellKind: "binary" | "sport_outcome" | "f1_winner"; markets: Market | null };
type Trade = { marketId: string; slug: string; question: string; category: string; invested: number; cashOuts: number; settlementPayout: number; returned: number; pnl: number; result: "win" | "loss" | "flat"; resolution: "settled" | "sold"; concludedAtIso: string | null; selected: { key: string; label: string }[]; official: { key: string; label: string } | null };
type Transaction = { id: string; type: string; amount: number; created_at: string; markets: { question: string; slug: string } | null };
type Profile = { coins: number; display_name: string | null };
type Withdrawal = { id: string; status: string; coins_amount: number; payout_method: string; requested_at: string };
type Stats = { coins: number; openValue: number; totalValue: number; openStaked: number; openPnl: number; realizedPnl: number; pnl30d: number; realizedBalance: number; winRate: number | null; settledCount: number };
type BalancePoint = { t: number; coins: number; pnl?: number; kind?: string; question?: string };

const signed = (value: number, digits = 1) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const tone = (value: number | null | undefined) => value == null || Math.abs(value) < 0.001 ? "neutral" : value > 0 ? "positive" : "negative";
const statusColor = (status: string) => status === "paid" || status === "approved" ? "#087443" : status === "rejected" ? "#b4181a" : "#b45309";

function BalanceChart({ history }: { history: BalancePoint[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ point: BalancePoint; left: number } | null>(null);
  const W = 900, H = 270, left = 58, right = 18, top = 18, bottom = 38;
  if (history.length < 2) return <div className={styles.chartEmpty}>Ende pa tregti të përfunduara.</div>;
  const t0 = history[0].t, t1 = history.at(-1)?.t ?? t0 + 1;
  const values = history.map((point) => point.coins);
  const rawMin = Math.min(...values), rawMax = Math.max(...values);
  const padding = Math.max(20, (rawMax - rawMin) * 0.22);
  const min = Math.max(0, rawMin - padding), max = rawMax + padding;
  const x = (time: number) => left + ((time - t0) / Math.max(1, t1 - t0)) * (W - left - right);
  const y = (value: number) => top + (1 - (value - min) / Math.max(1, max - min)) * (H - top - bottom);
  const path = history.map((point, index) => `${index ? "L" : "M"} ${x(point.t).toFixed(1)} ${y(point.coins).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(t1).toFixed(1)} ${H - bottom} L ${x(t0).toFixed(1)} ${H - bottom} Z`;
  const ticks = [0, 0.5, 1].map((ratio) => ({ ratio, value: max - (max - min) * ratio }));
  const onMove = (clientX: number) => {
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = t0 + ratio * (t1 - t0);
    const point = history.reduce((best, candidate) => Math.abs(candidate.t - time) < Math.abs(best.t - time) ? candidate : best, history[0]);
    setActive({ point, left: ratio * 100 });
  };
  return <div ref={host} className={styles.chart} onPointerMove={(event) => onMove(event.clientX)} onPointerLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bilanci i realizuar gjatë 30 ditëve">
      {ticks.map((tick) => <g key={tick.ratio}><line x1={left} x2={W - right} y1={top + tick.ratio * (H - top - bottom)} y2={top + tick.ratio * (H - top - bottom)} className={styles.gridLine}/><text x={left - 10} y={top + tick.ratio * (H - top - bottom) + 4} textAnchor="end" className={styles.axisText}>{fmtNum(tick.value)}</text></g>)}
      <defs><linearGradient id="balanceGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6a35" stopOpacity=".28"/><stop offset="100%" stopColor="#ff4422" stopOpacity="0"/></linearGradient></defs>
      <path d={area} className={styles.balanceArea}/><path d={path} className={styles.balanceLine}/>
      <text x={left} y={H - 8} className={styles.axisText}>{formatKosovoDate(t0)}</text><text x={W - right} y={H - 8} textAnchor="end" className={styles.axisText}>Sot</text>
      {active && <><line x1={x(active.point.t)} x2={x(active.point.t)} y1={top} y2={H - bottom} className={styles.inspector}/><circle cx={x(active.point.t)} cy={y(active.point.coins)} r="5" className={styles.activeDot}/></>}
    </svg>
    {active && <div className={styles.tooltip} data-align={active.left > 72 ? "end" : "start"} style={{ left: `${active.left}%` }}><span>{formatKosovoDate(active.point.t, { year: true })}</span><strong>{fmtNum(active.point.coins)} 383C</strong>{active.point.pnl ? <small data-tone={tone(active.point.pnl)}>{signed(active.point.pnl)} nga tregtia</small> : null}</div>}
  </div>;
}

function PositionCard({ position, confirming, selling, onSell }: { position: Position; confirming: boolean; selling: boolean; onSell: () => void }) {
  const market = position.markets;
  const color = position.sideColor || "#ff4422";
  return <article className={`tregu-glass tregu-market tregu-native-market tregu-edge ${styles.positionCard}`} style={{ "--position-color": color } as CSSProperties}>
    <div className="tregu-market-top"><span className={styles.marketTag}>{market?.market_classification === "live_f1" ? "F1 · Pozicioni yt" : `${market?.category || "Tregu"} · Pozicioni yt`}</span><span className="tregu-market-close">Aktiv</span></div>
    <Link href={`/tregu/${market?.slug}`} className="tregu-native-title">{market?.question}</Link>
    <div className={styles.pickRow}>{position.sideHeadshotUrl ? <img src={position.sideHeadshotUrl} alt="" aria-hidden/> : <i aria-hidden/>}<div><span>Zgjedhja jote</span><strong>{position.sideLabel || position.side}</strong></div><b>{position.currentPrice == null ? "—" : `${(position.currentPrice * 100).toFixed(1)}%`}</b></div>
    <div className={styles.positionFacts}><span><small>Investuar</small><strong>{fmtNum(position.coins_staked)} 383C</strong></span><span><small>Vlera tani</small><strong>{position.currentValue == null ? "—" : `${fmtNum(position.currentValue)} 383C`}</strong></span><span><small>P/L i hapur</small><strong data-tone={tone(position.unrealizedPnl)}>{position.unrealizedPnl == null ? "—" : `${signed(position.unrealizedPnl)} 383C`}</strong></span></div>
    <footer className={`tregu-market-foot ${styles.positionActions}`}><Link href={`/tregu/${market?.slug}`} className="tregu-market-open">Hap tregun →</Link><button type="button" onClick={onSell} disabled={selling}>{selling ? "Duke shitur…" : confirming ? "Konfirmo shitjen" : "Shit të gjitha"}</button></footer>
  </article>;
}

export default function PortofoliPage() {
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null), [positions, setPositions] = useState<Position[]>([]), [trades, setTrades] = useState<Trade[]>([]), [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null), [history, setHistory] = useState<BalancePoint[]>([]), [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [confirmSell, setConfirmSell] = useState<string | null>(null), [selling, setSelling] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const [payoutMethod, setPayoutMethod] = useState(""), [submitting, setSubmitting] = useState(false);
  const load = async () => {
    setFailed(false);
    try {
      const [portfolioResponse, withdrawalResponse] = await Promise.all([
        fetch("/api/tregu/portfolio", { cache: "no-store" }),
        fetch("/api/tregu/withdraw", { cache: "no-store" }),
      ]);
      if (!portfolioResponse.ok || !withdrawalResponse.ok) throw new Error("portfolio");
      const portfolio = await portfolioResponse.json(), withdrawal = await withdrawalResponse.json();
      setProfile(portfolio.profile ?? null); setPositions(portfolio.positions ?? []); setTrades(portfolio.tradeHistory ?? []); setTransactions(portfolio.transactions ?? []); setStats(portfolio.stats ?? null); setHistory(portfolio.balanceHistory ?? []); setWithdrawals(withdrawal.withdrawals ?? []);
    } catch { setFailed(true); } finally { setLoading(false); }
  };
  useEffect(() => { createClient().auth.getUser().then(({ data: { user } }) => { setAuth(user ? "in" : "out"); if (user) void load(); }); }, []);
  const sellAll = async (position: Position) => {
    if (confirmSell !== position.id) { setConfirmSell(position.id); window.setTimeout(() => setConfirmSell((value) => value === position.id ? null : value), 4000); return; }
    setConfirmSell(null); setSelling(position.id); setMessage(null);
    const payload: Record<string, unknown> = { marketId: position.market_id, shares: position.shares, side: position.side };
    if (position.sellKind === "sport_outcome") Object.assign(payload, { kind: "sport_outcome", outcomeKey: position.side });
    if (position.sellKind === "f1_winner") Object.assign(payload, { kind: "f1_race_winner", outcomeKey: position.side });
    const response = await fetch("/api/tregu/sell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); setMessage(response.ok ? `Pozicioni u shit. U kthyen ${fmtNum(Number(result.coinsReceived ?? 0))} 383C.` : result.error ?? "Shitja dështoi.");
    if (response.ok) setPositions((current) => current.filter((item) => item.id !== position.id));
    setSelling(null); if (response.ok) await load();
  };
  const withdraw = async () => {
    if (!payoutMethod.trim()) return; setSubmitting(true); setMessage(null);
    const response = await fetch("/api/tregu/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payoutMethod }) });
    const result = await response.json(); setMessage(response.ok ? "Kërkesa për tërheqje u regjistrua." : result.error ?? "Kërkesa dështoi.");
    if (response.ok) { setPayoutMethod(""); await load(); } setSubmitting(false);
  };

  if (auth === "out") return <div className="tregu-scope"><Navbar/><main className={styles.state}><h1>Portofoli yt</h1><p>Kyçu për të parë pozicionet dhe rezultatet e tua.</p><Link href="/hyr" className="tregu-btn-primary">Hyr</Link></main></div>;
  if (auth === "checking" || loading) return <div className="tregu-scope"><Navbar/><main className={styles.page}><div className={styles.loadingHero}/><div className={styles.loadingGrid}>{[0,1,2].map((key) => <i key={key}/>)}</div></main></div>;
  if (failed) return <div className="tregu-scope"><Navbar/><main className={styles.state}><h1>Portofoli nuk u ngarkua</h1><p>Kontrollo lidhjen dhe provo përsëri.</p><button className="tregu-btn-primary" onClick={() => { setLoading(true); void load(); }}>Provo përsëri</button></main></div>;

  const extras = transactions.filter((transaction) => !["bet", "sell", "payout"].includes(transaction.type));
  const canWithdraw = Number(profile?.coins ?? 0) >= 10000;
  return <div className="tregu-scope"><Navbar/><main className={styles.page}>
    <header className={styles.hero}><div><Link href="/tregu" className={styles.eyebrow}>TREGU / PORTOFOLI</Link><h1>Portofoli yt</h1><p>Kapitali aktiv, rezultati i realizuar dhe çdo tregti e mbyllur — pa e numëruar një investim të hapur si humbje.</p></div><div className={styles.heroBalance}><span>Bilanci i realizuar</span><strong>{fmtNum(stats?.realizedBalance ?? profile?.coins ?? 0)} <small>383C</small></strong><b data-tone={tone(stats?.pnl30d)}>{signed(stats?.pnl30d ?? 0, 0)} në 30 ditë</b></div></header>
    <section className={styles.summary} aria-label="Përmbledhja"><article className={`tregu-glass tregu-glass-hi ${styles.totalCard}`}><span>Vlera totale tani</span><strong><CoinFace size={28}/>{fmtNum(stats?.totalValue ?? 0)}</strong><small>{fmtNum(profile?.coins ?? 0)} të lira · {fmtNum(stats?.openValue ?? 0)} vlerë e hapur</small></article><article className={`tregu-glass ${styles.metricCard}`}><span><small>Fituar / humbur · 30 ditë</small><strong data-tone={tone(stats?.pnl30d)}>{signed(stats?.pnl30d ?? 0)} 383C</strong></span><span><small>P/L i hapur</small><strong data-tone={tone(stats?.openPnl)}>{signed(stats?.openPnl ?? 0)} 383C</strong></span><span><small>Norma e fitoreve</small><strong>{stats?.winRate == null ? "—" : `${Math.round(stats.winRate * 100)}%`}</strong></span></article></section>
    <section className={`tregu-glass ${styles.chartPanel}`}><div className={styles.sectionHead}><div><span>REZULTATI I REALIZUAR</span><h2>30 ditët e fundit</h2><p>Vija lëviz vetëm kur një tregti shitet ose zgjidhet.</p></div><strong data-tone={tone(stats?.pnl30d)}>{signed(stats?.pnl30d ?? 0)} 383C</strong></div><BalanceChart history={history}/></section>
    <section className={styles.section}><div className={styles.sectionTitle}><div><span>KAPITAL NË PUNË</span><h2>Pozicionet aktive</h2></div><b>{positions.length}</b></div>{message && <p className={styles.message}>{message}</p>}{positions.length ? <div className={styles.positionGrid}>{positions.map((position) => <PositionCard key={position.id} position={position} confirming={confirmSell === position.id} selling={selling === position.id} onSell={() => void sellAll(position)}/>)}</div> : <div className={styles.empty}><p>Nuk ke pozicione aktive.</p><Link href="/tregu">Shiko tregjet →</Link></div>}</section>
    <section className={styles.section}><div className={styles.sectionTitle}><div><span>REZULTATET E MBYLLURA</span><h2>Historiku i tregtimeve</h2></div><b>{trades.length}</b></div><div className={styles.tradeList}>{trades.length ? trades.map((trade) => <article key={trade.marketId} className={styles.tradeRow}><span className={styles.resultMark} data-result={trade.result}>{trade.result === "win" ? "F" : trade.result === "loss" ? "H" : "—"}</span><div className={styles.tradeIdentity}><Link href={`/tregu/${trade.slug}`}>{trade.question}</Link><small>{trade.selected.map((item) => item.label).join(", ") || "Pozicion"}{trade.official ? ` · Rezultati: ${trade.official.label}` : " · Shitur para mbylljes"}</small></div><div><small>Investuar</small><strong>{fmtNum(trade.invested)}</strong></div><div><small>{trade.cashOuts > 0 && trade.settlementPayout > 0 ? "Gjithsej kthyer" : "Kthyer"}</small><strong>{fmtNum(trade.returned)}</strong>{trade.cashOuts > 0 && trade.settlementPayout > 0 ? <em className={styles.returnBreakdown}>{fmtNum(trade.cashOuts)} shitje + {fmtNum(trade.settlementPayout)} shlyerje</em> : null}</div><div className={styles.tradePnl}><small>P/L</small><strong data-tone={tone(trade.pnl)}>{signed(trade.pnl)} 383C</strong></div><time>{trade.concludedAtIso ? formatKosovoDate(trade.concludedAtIso, { year: true }) : "—"}</time></article>) : <div className={styles.empty}><p>Ende pa tregti të përfunduara.</p></div>}</div></section>
    <section className={styles.lowerGrid}><article className={`tregu-glass ${styles.withdraw}`}><span>TËRHEQJA</span><h2>Ktheji 383C në shpërblim</h2><div className={styles.withdrawProgress} aria-label={`${Math.min(100, Math.floor((Number(profile?.coins ?? 0) / 10000) * 100))}% e pragut të tërheqjes`}><i style={{ width: `${Math.min(100, (Number(profile?.coins ?? 0) / 10000) * 100)}%` }}/></div><div className={styles.withdrawNumbers}><strong>{Math.min(100, Math.floor((Number(profile?.coins ?? 0) / 10000) * 100))}% arritur</strong><span>{fmtNum(Math.max(0, 10000 - Number(profile?.coins ?? 0)))} 383C mbeten</span></div><p>{canWithdraw ? `Pragu u arrit. Raporti është 10,000 383C për 10€.` : `Duhen 10,000 383C. Aktualisht ke ${fmtNum(profile?.coins ?? 0)}.`}</p><p className={styles.withdrawTrust}>Çdo kërkesë verifikohet kundrejt bilancit dhe historikut të transaksioneve. Konfirmimi dërgohet nga <a href="mailto:info@383media.com">info@383media.com</a>.</p>{canWithdraw && <div><input className="tregu-input" value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} placeholder="PayPal email ose IBAN"/><button className="tregu-btn-primary" disabled={submitting || !payoutMethod.trim()} onClick={() => void withdraw()}>Kërko verifikim</button></div>}{withdrawals.map((withdrawal) => <small key={withdrawal.id}>{formatKosovoDate(withdrawal.requested_at, { year: true })} · {fmtNum(withdrawal.coins_amount)} 383C <b style={{ color: statusColor(withdrawal.status) }}>{withdrawal.status}</b></small>)}</article><article className={`tregu-glass ${styles.otherActivity}`}><span>LËVIZJE TË TJERA</span><h2>Bonuse dhe tërheqje</h2>{extras.length ? extras.slice(0, 8).map((transaction) => <div key={transaction.id}><span>{transaction.type === "daily_bonus" ? "Bonus ditor" : transaction.type === "signup_bonus" ? "Bonus regjistrimi" : transaction.type}</span><strong data-tone={tone(transaction.amount)}>{signed(Number(transaction.amount), 0)}</strong></div>) : <p>Pa lëvizje të tjera.</p>}</article></section>
  </main></div>;
}
