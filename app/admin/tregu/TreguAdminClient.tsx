"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./TreguAdminClient.module.css";

type MarketClassification = "general_news" | "live_football" | "live_basketball" | "live_f1";
type MarketStatus = "draft" | "open" | "stale" | "closed" | "resolved";
type ActivityFilter = "changed" | "all" | "unchanged";

interface Market {
  id: string;
  slug: string;
  question: string;
  description: string | null;
  category: string;
  market_classification?: MarketClassification;
  status: MarketStatus;
  outcome: "PO" | "JO" | null;
  market_type?: "binary" | "two_outcome" | "three_outcome" | "f1_race_winner";
  closes_at: string;
  ai_generated: boolean;
  last_checked_at?: string | null;
  last_scan_result?: { status?: string; evidence_count?: number } | null;
}

interface Withdrawal {
  id: string;
  status: string;
  coins_amount: number;
  payout_method: string;
  requested_at: string;
  profiles?: { display_name: string | null } | null;
}

interface MarketActivity {
  id: string;
  automation: "news" | "sports";
  slug: string;
  status: string;
  provider: string | null;
  fallback_index: number;
  before_probability: number | null;
  after_probability: number | null;
  question: string | null;
  applied_at: string;
  odds_changed: boolean;
  percentage_point_change: number | null;
}

interface RefreshSourceHealth {
  status: "active" | "healthy" | "stale" | "failed";
  cadence_seconds: number;
  last_successful_refresh: string | null;
  latest_run: { status?: string; details?: Record<string, unknown>; error?: string | null } | null;
  activity_window_minutes: number;
  recent_market_activity: MarketActivity[];
  runner_identity?: string;
}

interface RefreshHealth {
  sports_refresh: RefreshSourceHealth;
  news_reprice: RefreshSourceHealth;
  tregu_live?: RefreshSourceHealth;
}

const statusLabels: Record<MarketStatus, string> = {
  draft: "Draft",
  open: "Aktiv",
  stale: "Pezulluar",
  closed: "Gati për zgjidhje",
  resolved: "I zgjidhur",
};

function formatPercent(value: number | null) {
  return value === null ? "Pa odds" : `${(value * 100).toFixed(2)}%`;
}

function formatDelta(value: number | null) {
  if (value === null) return "Pa ndryshim";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function formatTime(value: string | null) {
  if (!value) return "Pa të dhëna";
  return new Intl.DateTimeFormat("sq-AL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function classificationLabel(value: MarketClassification | undefined) {
  if (value === "live_football") return "Live Football";
  if (value === "live_basketball") return "Live Basketball";
  if (value === "live_f1") return "Live F1";
  return "General / News";
}

function marketTypeLabel(value: Market["market_type"]) {
  if (value === "f1_race_winner") return "F1 · 20-22 pilotë";
  if (value === "three_outcome") return "3 rezultate";
  if (value === "two_outcome") return "2 rezultate";
  return "PO/JO";
}

export default function TreguAdminClient() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [refreshHealth, setRefreshHealth] = useState<RefreshHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [tab, setTab] = useState<"markets" | "withdrawals">("markets");

  const loadMarkets = async () => {
    const response = await fetch("/api/admin/tregu/markets");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    setMarkets(data.markets ?? []);
  };

  const loadWithdrawals = async () => {
    const response = await fetch("/api/admin/tregu/withdrawals");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    setWithdrawals(data.withdrawals ?? []);
  };

  const loadRefreshHealth = async () => {
    try {
      const response = await fetch("/api/admin/tregu/health", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.sports_refresh || !data.news_reprice) throw new Error(data.error ?? `HTTP ${response.status}`);
      setRefreshHealth(data);
      setHealthError(null);
    } catch (error) {
      setHealthError(String(error instanceof Error ? error.message : error));
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadMarkets(), loadWithdrawals(), loadRefreshHealth()]);
  };

  useEffect(() => {
    void refreshAll();
    const healthTimer = window.setInterval(() => void loadRefreshHealth(), 30_000);
    return () => window.clearInterval(healthTimer);
  }, []);

  const createHungaryF1Drafts = async () => {
    const drivers = [["ANT", "Andrea Kimi Antonelli", "Mercedes"], ["RUS", "George Russell", "Mercedes"], ["LEC", "Charles Leclerc", "Ferrari"], ["HAM", "Lewis Hamilton", "Ferrari"], ["VER", "Max Verstappen", "Red Bull"], ["HAD", "Isack Hadjar", "Red Bull"], ["PIA", "Oscar Piastri", "McLaren"], ["NOR", "Lando Norris", "McLaren"], ["BOR", "Gabriel Bortoleto", "Audi"], ["HUL", "Nico Hülkenberg", "Audi"], ["LIN", "Arvid Lindblad", "RB F1 Team"], ["LAW", "Liam Lawson", "RB F1 Team"], ["COL", "Franco Colapinto", "Alpine F1 Team"], ["GAS", "Pierre Gasly", "Alpine F1 Team"], ["BEA", "Oliver Bearman", "Haas F1 Team"], ["OCO", "Esteban Ocon", "Haas F1 Team"], ["ALB", "Alexander Albon", "Williams"], ["SAI", "Carlos Sainz", "Williams"], ["BOT", "Valtteri Bottas", "Cadillac F1 Team"], ["PER", "Sergio Pérez", "Cadillac F1 Team"], ["ALO", "Fernando Alonso", "Aston Martin"], ["STR", "Lance Stroll", "Aston Martin"]] as const;
    if (!window.confirm("Krijo një treg të vetëm F1 Hungari me 22 pilotë?")) return;
    setDrafting(true);
    try {
      const created = await fetch("/api/admin/tregu/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Kush fiton Çmimin e Madh të Hungarisë 2026?",
          description: "Një treg i vetëm me të gjithë pilotët. Gridi zyrtar vendoset pas kualifikimit.",
          category: "Sport",
          closesInDays: 2,
          status: "draft",
          resolutionRules: "Fituesi është piloti P1 në klasifikimin zyrtar final të F1.",
          resolutionSource: "Formula 1 Dashboard / klasifikimi zyrtar F1",
        }),
      }).then((response) => response.json());
      if (created.market?.id) {
        await fetch(`/api/admin/tregu/markets/${created.market.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            market_classification: "live_f1",
            market_type: "f1_race_winner",
            outcomes: drivers.map(([code]) => code),
            sport_outcomes: drivers.map(([code, label, team]) => ({ key: code, label, team })),
            outcome_quantities: Object.fromEntries(drivers.map(([code]) => [code, 0])),
            reference_probabilities: Object.fromEntries(drivers.map(([code]) => [code, 1 / drivers.length])),
            live_event: { provider: "formula1_dashboard", event_id: "hungarian-grand-prix-2026" },
          }),
        });
      }
      await loadMarkets();
    } finally {
      setDrafting(false);
    }
  };

  const draftFromNews = async () => {
    setDrafting(true);
    try {
      await fetch("/api/admin/tregu/draft", { method: "POST" });
      await loadMarkets();
    } finally {
      setDrafting(false);
    }
  };

  const marketAction = async (id: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/tregu/markets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.error ?? "Veprimi dështoi");
      return;
    }
    await loadMarkets();
  };

  const deleteDraft = async (id: string) => {
    const response = await fetch(`/api/admin/tregu/markets/${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.error ?? "Fshirja dështoi");
      return;
    }
    await loadMarkets();
  };

  const withdrawalAction = async (id: string, status: "approved" | "paid" | "rejected") => {
    await fetch(`/api/admin/tregu/withdrawals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadWithdrawals();
  };

  const recentChangesBySlug = useMemo(() => {
    const changes = [
      ...(refreshHealth?.news_reprice.recent_market_activity ?? []),
      ...(refreshHealth?.sports_refresh.recent_market_activity ?? []),
    ].sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
    const latestBySlug = new Map<string, MarketActivity>();
    for (const change of changes) {
      if (!change.odds_changed || !change.slug || latestBySlug.has(change.slug)) continue;
      latestBySlug.set(change.slug, change);
    }
    return latestBySlug;
  }, [refreshHealth]);

  const marketsForStatus = (status: MarketStatus) => markets
    .filter((market) => market.status === status)
    .sort((a, b) => Number(recentChangesBySlug.has(b.slug)) - Number(recentChangesBySlug.has(a.slug)));

  return (
    <main className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>383 Tregu</p>
          <h1>Operacione tregu</h1>
          <p className={styles.pageIntro}>Kontrollo tregjet, ndryshimet e fundit të odds dhe vendimet që presin veprim.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin" className={styles.buttonSecondary}>Admin kryesor</Link>
          <button type="button" onClick={draftFromNews} disabled={drafting} className={styles.buttonAccent}>
            {drafting ? "Duke krijuar..." : "Krijo nga lajmet"}
          </button>
          <button type="button" onClick={createHungaryF1Drafts} disabled={drafting} className={styles.buttonPrimary}>Krijo F1 Hungari</button>
        </div>
      </header>

      <RefreshHealthPanel health={refreshHealth} error={healthError} recentChangesBySlug={recentChangesBySlug} />

      <div className={styles.tabs} role="tablist" aria-label="Seksionet e administrimit">
        <button type="button" role="tab" aria-selected={tab === "markets"} onClick={() => setTab("markets")} className={`${styles.tab} ${tab === "markets" ? styles.tabActive : ""}`}>
          Tregjet <span>{markets.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "withdrawals"} onClick={() => setTab("withdrawals")} className={`${styles.tab} ${tab === "withdrawals" ? styles.tabActive : ""}`}>
          Tërheqjet <span>{withdrawals.filter((withdrawal) => withdrawal.status === "pending").length}</span>
        </button>
      </div>

      {tab === "markets" && (
        <div className={styles.sections}>
          <MarketSection title="Draftet" subtitle="Kërkojnë miratim" markets={marketsForStatus("draft")} changes={recentChangesBySlug} empty="Nuk ka drafte për miratim.">
            {(market, change) => <DraftActions market={market} change={change} marketAction={marketAction} onDelete={deleteDraft} onSaved={loadMarkets} />}
          </MarketSection>
          <MarketSection title="Tregje aktive" subtitle="Të hapura për baste" markets={marketsForStatus("open")} changes={recentChangesBySlug} empty="Nuk ka tregje aktive.">
            {(market, change) => <MarketCard market={market} change={change}><div className={styles.cardActions}><button type="button" onClick={() => marketAction(market.id, { action: "close" })} className={styles.buttonSecondary}>Mbyll bastet</button></div></MarketCard>}
          </MarketSection>
          <MarketSection title="Gati për zgjidhje" subtitle="Bastet janë mbyllur" markets={marketsForStatus("closed")} changes={recentChangesBySlug} empty="Nuk ka tregje për zgjidhje.">
            {(market, change) => <MarketCard market={market} change={change}><div className={styles.cardActions}><button type="button" onClick={() => marketAction(market.id, { action: "resolve", outcome: "PO" })} className={styles.buttonYes}>Zgjidh PO</button><button type="button" onClick={() => marketAction(market.id, { action: "resolve", outcome: "JO" })} className={styles.buttonNo}>Zgjidh JO</button></div></MarketCard>}
          </MarketSection>
          <MarketSection title="Pezulluara" subtitle="Pa baste derisa të vijë referenca" markets={marketsForStatus("stale")} changes={recentChangesBySlug} empty="Nuk ka tregje të pezulluara.">
            {(market, change) => <MarketCard market={market} change={change}><p className={styles.notice}>Prit referencën e suksesshme nga lajmet. Automatizimi nuk ndryshon 383C ose pozicionet.</p></MarketCard>}
          </MarketSection>
          <MarketSection title="Të zgjidhura" subtitle="Historiku i tregjeve" markets={marketsForStatus("resolved")} changes={recentChangesBySlug} empty="Nuk ka tregje të zgjidhura.">
            {(market, change) => <MarketCard market={market} change={change} />}
          </MarketSection>
        </div>
      )}

      {tab === "withdrawals" && <Withdrawals withdrawals={withdrawals} onAction={withdrawalAction} />}
    </main>
  );
}

function RefreshHealthPanel({ health, error, recentChangesBySlug }: { health: RefreshHealth | null; error: string | null; recentChangesBySlug: Map<string, MarketActivity> }) {
  const [filter, setFilter] = useState<ActivityFilter>("changed");
  const live = health?.news_reprice ?? health?.tregu_live;
  const sports = health?.sports_refresh;
  const details = live?.latest_run?.details ?? {};
  const activity = [
    ...(live?.recent_market_activity ?? []),
    ...(sports?.recent_market_activity ?? []),
  ].sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());
  const changed = activity.filter((item) => item.odds_changed);
  const unchanged = activity.filter((item) => !item.odds_changed);
  const visibleActivity = filter === "changed" ? changed : filter === "unchanged" ? unchanged : activity;
  const updatedMarkets = recentChangesBySlug.size;

  return (
    <section className={styles.healthPanel} aria-live="polite">
      <div className={styles.healthHeader}>
        <div>
          <p className={styles.kicker}>Monitorim i drejtpërdrejtë</p>
          <h2>Gjendja e automatizimit</h2>
          <p>Odds e ndryshuara mbeten të theksuara për 30 minuta në këtë panel dhe te karta e tregut.</p>
        </div>
        <span className={`${styles.healthState} ${styles[`health${(live?.status ?? "stale").replace(/^./, (letter) => letter.toUpperCase())}`]}`}><i />{healthLabel(live?.status)}</span>
      </div>

      {error && <p className={styles.errorMessage}>Nuk u lexua gjendja e fundit. Po shfaqet informacioni i ruajtur: {error}</p>}

      <div className={styles.summaryGrid}>
        <SummaryMetric value={String(changed.length)} label="Odds të ndryshuara" hint="30 minutat e fundit" tone="accent" />
        <SummaryMetric value={String(updatedMarkets)} label="Tregje të prekura" hint="të shënuara më poshtë" />
        <SummaryMetric value={String(details.open_markets_scanned ?? "0")} label="Tregjet e kontrolluara" hint="run-i më i fundit" />
        <SummaryMetric value={formatTime(live?.last_successful_refresh ?? null)} label="Përditësimi i fundit" hint={`kadenca ${live?.cadence_seconds ?? "-"} sek.`} />
      </div>

      <div className={styles.sourceGrid}>
        <HealthSource title="Lajme të verifikuara (2 min)" source={live} detail={`${live?.runner_identity ?? "383-tregu-reprice.timer"} · Ndryshimet e aplikuara: ${String(details.updates_applied ?? "0")}`} />
        <HealthSource title="Procesori zyrtar sportiv (2 min)" source={sports} detail={`Përditësime zyrtare: ${String(sports?.latest_run?.details?.official_updates ?? "0")}`} />
      </div>

      <div className={styles.activityPanel}>
        <div className={styles.activityHeader}>
          <div>
            <h3>Regjistri i odds</h3>
            <p>Çdo rresht ruan para, pas, drejtimin dhe kohën e ndryshimit.</p>
          </div>
          <div className={styles.filterTabs} role="tablist" aria-label="Filtro regjistrin e odds">
            <ActivityFilterButton active={filter === "changed"} onClick={() => setFilter("changed")} label="Ndryshuar" count={changed.length} />
            <ActivityFilterButton active={filter === "all"} onClick={() => setFilter("all")} label="Të gjitha" count={activity.length} />
            <ActivityFilterButton active={filter === "unchanged"} onClick={() => setFilter("unchanged")} label="Pa ndryshim" count={unchanged.length} />
          </div>
        </div>

        {visibleActivity.length === 0 ? <p className={styles.emptyActivity}>Nuk ka {filter === "changed" ? "odds të ndryshuara" : "aktivitet"} në 30 minutat e fundit.</p> : <div className={styles.activityList}>
          {visibleActivity.map((item) => <ActivityRow key={item.id} item={item} />)}
        </div>}
      </div>
    </section>
  );
}

function SummaryMetric({ value, label, hint, tone }: { value: string; label: string; hint: string; tone?: "accent" }) {
  return <div className={`${styles.summaryMetric} ${tone === "accent" ? styles.summaryMetricAccent : ""}`}><strong>{value}</strong><span>{label}</span><small>{hint}</small></div>;
}

function HealthSource({ title, source, detail }: { title: string; source: RefreshSourceHealth | undefined; detail: string }) {
  const status = source?.status ?? "stale";
  return <div className={styles.healthSource}><div className={styles.healthSourceTitle}><span className={`${styles.statusDot} ${styles[`dot${status.replace(/^./, (letter) => letter.toUpperCase())}`]}`} /><strong>{title}</strong><span>{healthLabel(status)}</span></div><p>{detail}</p><dl><div><dt>Kadenca</dt><dd>{source?.cadence_seconds ?? "-"} sek.</dd></div><div><dt>Run i fundit</dt><dd>{formatTime(source?.last_successful_refresh ?? null)}</dd></div></dl>{source?.latest_run?.error && <p className={styles.errorMessage}>Gabim: {source.latest_run.error}</p>}</div>;
}

function ActivityFilterButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <button type="button" role="tab" aria-selected={active} className={`${styles.filterTab} ${active ? styles.filterTabActive : ""}`} onClick={onClick}>{label}<span>{count}</span></button>;
}

function ActivityRow({ item }: { item: MarketActivity }) {
  const direction = (item.percentage_point_change ?? 0) >= 0 ? "up" : "down";
  return <article className={`${styles.activityRow} ${item.odds_changed ? styles.activityRowChanged : ""}`}>
    <div className={styles.activityIdentity}>
      <div className={styles.activityTitleLine}>{item.odds_changed && <span className={styles.changedMark}>Odds të ndryshuara</span>}<strong>{(item.question ?? item.slug) || "Treg pa emër"}</strong></div>
      <p>{item.automation === "sports" ? "Sport / F1" : "Lajme"} · {item.provider ?? "Pa thirrje AI"}{item.fallback_index > 0 ? ` · fallback ${item.fallback_index}` : ""} · {formatTime(item.applied_at)}</p>
    </div>
    {item.odds_changed ? <div className={styles.oddsChange} data-direction={direction}><span>{formatPercent(item.before_probability)}</span><b>{formatPercent(item.after_probability)}</b><strong>{formatDelta(item.percentage_point_change)}</strong></div> : <div className={styles.noChange}><span>{activityStatusLabel(item.status)}</span><small>Pa ndryshim odds</small></div>}
  </article>;
}

function MarketSection({ title, subtitle, markets, changes, empty, children }: { title: string; subtitle: string; markets: Market[]; changes: Map<string, MarketActivity>; empty: string; children: (market: Market, change: MarketActivity | undefined) => React.ReactNode }) {
  return <section className={styles.marketSection}><header className={styles.sectionHeader}><div><h2>{title}</h2><p>{subtitle}</p></div><span>{markets.length}</span></header>{markets.length ? <div className={styles.marketList}>{markets.map((market) => children(market, changes.get(market.slug)))}</div> : <p className={styles.emptyState}>{empty}</p>}</section>;
}

function MarketCard({ market, change, children }: { market: Market; change?: MarketActivity; children?: React.ReactNode }) {
  return <article className={`${styles.marketCard} ${change ? styles.marketCardChanged : ""}`}>
    <div className={styles.marketTopLine}><div className={styles.marketTags}><span>{market.category}</span><span>{classificationLabel(market.market_classification)}</span><span>{marketTypeLabel(market.market_type)}</span>{market.ai_generated && <span className={styles.aiTag}>AI</span>}</div><span className={`${styles.marketStatus} ${styles[`market${market.status.replace(/^./, (letter) => letter.toUpperCase())}`]}`}>{statusLabels[market.status]}</span></div>
    <h3>{market.question}</h3>
    {market.description && <p className={styles.marketDescription}>{market.description}</p>}
    <div className={styles.marketMeta}><span>Mbyllet {new Intl.DateTimeFormat("sq-AL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(market.closes_at))}</span>{market.last_checked_at && <span>Kontrolluar {formatTime(market.last_checked_at)}{market.last_scan_result?.evidence_count !== undefined ? ` · ${market.last_scan_result.evidence_count} evidenca` : ""}</span>}{market.outcome && <span className={market.outcome === "PO" ? styles.outcomeYes : styles.outcomeNo}>Zgjidhur: {market.outcome}</span>}</div>
    {change && <div className={styles.marketChange}><span className={styles.changedMark}>Odds të ndryshuara</span><strong>{formatPercent(change.before_probability)} <i>→</i> {formatPercent(change.after_probability)}</strong><small>{formatDelta(change.percentage_point_change)} · {formatTime(change.applied_at)}</small></div>}
    {children}
  </article>;
}

function DraftActions({ market: m, change, marketAction, onDelete, onSaved }: { market: Market; change?: MarketActivity; marketAction: (id: string, body: Record<string, unknown>) => Promise<void>; onDelete: (id: string) => Promise<void>; onSaved: () => Promise<void> }) {
  return <MarketCard market={m} change={change}><div className={styles.marketConfig}><label>Klasifikimi<select aria-label="Klasifikimi i tregut" value={m.market_classification ?? "general_news"} onChange={(event) => { const value = event.target.value as MarketClassification; void marketAction(m.id, { market_classification: value }); }}><option value="general_news">General / News</option><optgroup label="Sport"><option value="live_football">Football — score, cards, time</option><option value="live_basketball">Basketball — NBA / FBK Superliga</option><option value="live_f1">F1 — official live timing</option></optgroup></select></label><label>Lloji<select aria-label="Lloji i tregut" value={m.market_type ?? "binary"} onChange={(event) => { const value = event.target.value as NonNullable<Market["market_type"]>; void marketAction(m.id, { market_type: value }); }}><option value="binary">Binar (PO/JO)</option><option value="two_outcome">Dy rezultate</option><option value="three_outcome">Tri rezultate</option><option value="f1_race_winner">F1 Race Winner</option></select></label></div>{m.market_classification === "live_f1" && m.market_type !== "f1_race_winner" && <F1ConfigEditor market={m} onSaved={onSaved} />}<div className={styles.cardActions}><button type="button" onClick={() => void marketAction(m.id, { action: "approve" })} className={styles.buttonYes}>Mirato tregun</button><button type="button" onClick={() => void onDelete(m.id)} className={styles.buttonDanger}>Fshi draftin</button></div></MarketCard>;
}

function Withdrawals({ withdrawals, onAction }: { withdrawals: Withdrawal[]; onAction: (id: string, status: "approved" | "paid" | "rejected") => Promise<void> }) {
  return <section className={styles.marketSection}><header className={styles.sectionHeader}><div><h2>Tërheqjet</h2><p>Veprime financiare që kërkojnë kontroll administrativ.</p></div><span>{withdrawals.length}</span></header>{withdrawals.length ? <div className={styles.withdrawalList}>{withdrawals.map((withdrawal) => <article key={withdrawal.id} className={styles.withdrawalCard}><div><h3>{withdrawal.profiles?.display_name ?? "Përdorues"}</h3><p>{withdrawal.coins_amount.toLocaleString("sq-AL")} 383C · {withdrawal.payout_method}</p><small>{formatTime(withdrawal.requested_at)}</small></div><div className={styles.withdrawalActions}><span className={styles.withdrawalStatus}>{withdrawal.status}</span>{withdrawal.status === "pending" && <><button type="button" onClick={() => void onAction(withdrawal.id, "approved")} className={styles.buttonSecondary}>Mirato</button><button type="button" onClick={() => void onAction(withdrawal.id, "paid")} className={styles.buttonYes}>U pagua</button><button type="button" onClick={() => void onAction(withdrawal.id, "rejected")} className={styles.buttonDanger}>Refuzo</button></>}{withdrawal.status === "approved" && <button type="button" onClick={() => void onAction(withdrawal.id, "paid")} className={styles.buttonYes}>U pagua</button>}</div></article>)}</div> : <p className={styles.emptyState}>Nuk ka tërheqje për momentin.</p>}</section>;
}

function F1ConfigEditor({ market, onSaved }: { market: Market; onSaved: () => Promise<void> }) {
  const existing = (market as Market & { live_event?: Record<string, unknown> }).live_event ?? {};
  const [eventId, setEventId] = useState(String(existing.event_id ?? "hungarian-grand-prix-2026"));
  const [driverCode, setDriverCode] = useState(String(existing.driver_code ?? ""));
  const [team, setTeam] = useState(String(existing.team ?? ""));
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const code = driverCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || !/^[A-Za-z0-9_-]+$/.test(eventId.trim()) || !team.trim()) {
      setError("Plotëso event ID, kodin 3-shkronjash të pilotit dhe ekipin.");
      return;
    }
    const response = await fetch(`/api/admin/tregu/markets/${market.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ live_event: { provider: "formula1_dashboard", event_id: eventId.trim(), driver_code: code, team: team.trim() } }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Ruajtja e konfigurimit dështoi.");
      return;
    }
    setError(null);
    await onSaved();
  };
  return <fieldset className={styles.f1Config}><legend>F1 Live configuration</legend><div><label>Event ID<input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="event ID" /></label><label>Kodi i pilotit<input value={driverCode} onChange={(event) => setDriverCode(event.target.value)} placeholder="VER" maxLength={3} /></label><label>Ekipi<input value={team} onChange={(event) => setTeam(event.target.value)} placeholder="Red Bull" /></label></div><button type="button" onClick={() => void save()} className={styles.buttonSecondary}>Ruaj konfigurimin</button>{error && <p className={styles.errorMessage}>{error}</p>}</fieldset>;
}

function healthLabel(status: RefreshSourceHealth["status"] | undefined) {
  if (status === "active") return "Aktiv";
  if (status === "healthy") return "I freskët";
  if (status === "failed") return "Gabim";
  return "Kërkon kontroll";
}

function activityStatusLabel(status: string) {
  if (status === "no_fresh_evidence") return "Pa evidencë të re";
  if (status === "no_change") return "Kontrolluar";
  if (status === "skipped_closed") return "I anashkaluar";
  if (status === "oracle_failed") return "Kontrolli dështoi";
  return status.replaceAll("_", " ");
}
