"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Market {
  id: string;
  slug: string;
  question: string;
  description: string | null;
  category: string;
  status: "draft" | "open" | "stale" | "closed" | "resolved";
  outcome: "PO" | "JO" | null;
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

interface RefreshSourceHealth {
  status: "active" | "healthy" | "stale" | "failed";
  cadence_seconds: number;
  last_successful_refresh: string | null;
  latest_run: { status?: string; details?: Record<string, unknown>; error?: string | null } | null;
}

interface RefreshHealth {
  llm_refresh: RefreshSourceHealth;
  tregu_live: RefreshSourceHealth;
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#F9F6F1", fontFamily: "inherit", padding: "40px 32px" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8E3DB", borderRadius: 16, padding: 20, marginBottom: 14 };
const btn: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, border: "1px solid #E8E3DB", background: "#F3F4F6", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

export default function TreguAdminClient() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [refreshHealth, setRefreshHealth] = useState<RefreshHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [tab, setTab] = useState<"markets" | "withdrawals">("markets");

  const loadMarkets = () => fetch("/api/admin/tregu/markets").then((r) => r.json()).then((d) => setMarkets(d.markets ?? []));
  const loadWithdrawals = () => fetch("/api/admin/tregu/withdrawals").then((r) => r.json()).then((d) => setWithdrawals(d.withdrawals ?? []));
  const loadRefreshHealth = async () => {
    try {
      const response = await fetch("/api/admin/tregu/health", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.llm_refresh || !data.tregu_live) throw new Error(data.error ?? `HTTP ${response.status}`);
      setRefreshHealth(data);
      setHealthError(null);
    } catch (error) {
      setHealthError(String(error instanceof Error ? error.message : error));
    }
  };

  useEffect(() => {
    loadMarkets();
    loadWithdrawals();
    loadRefreshHealth();
    const healthTimer = window.setInterval(loadRefreshHealth, 30_000);
    return () => window.clearInterval(healthTimer);
  }, []);

  const draftFromNews = async () => {
    setDrafting(true);
    await fetch("/api/admin/tregu/draft", { method: "POST" });
    await loadMarkets();
    setDrafting(false);
  };

  const marketAction = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/tregu/markets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    loadMarkets();
  };

  const deleteDraft = async (id: string) => {
    await fetch(`/api/admin/tregu/markets/${id}`, { method: "DELETE" });
    loadMarkets();
  };

  const withdrawalAction = async (id: string, status: "approved" | "paid" | "rejected") => {
    await fetch(`/api/admin/tregu/withdrawals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadWithdrawals();
  };

  const byStatus = (s: Market["status"]) => markets.filter((m) => m.status === s);

  return (
    <main style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>383 Tregu — Admin</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin" style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
            ← Admin kryesor
          </Link>
          <button onClick={draftFromNews} disabled={drafting} style={{ ...btn, background: "#FF4422", color: "#fff", border: "none" }}>
            {drafting ? "Duke krijuar..." : "Krijo tregje nga lajmet"}
          </button>
        </div>
      </div>

      <RefreshHealthPanel health={refreshHealth} error={healthError} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("markets")} style={{ ...btn, background: tab === "markets" ? "#111" : "#F3F4F6", color: tab === "markets" ? "#fff" : "#111" }}>
          Tregjet ({markets.length})
        </button>
        <button onClick={() => setTab("withdrawals")} style={{ ...btn, background: tab === "withdrawals" ? "#111" : "#F3F4F6", color: tab === "withdrawals" ? "#fff" : "#111" }}>
          Tërheqjet ({withdrawals.filter((w) => w.status === "pending").length} në pritje)
        </button>
      </div>

      {tab === "markets" && (
        <>
          <Section title={`Draft — kërkojnë miratim (${byStatus("draft").length})`}>
            {byStatus("draft").map((m) => (
              <div key={m.id} style={card}>
                <MarketRow m={m} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => marketAction(m.id, { action: "approve" })} style={{ ...btn, background: "#22C55E", color: "#fff", border: "none" }}>
                    Mirato
                  </button>
                  <button onClick={() => deleteDraft(m.id)} style={{ ...btn, color: "#e53e3e" }}>
                    Fshi
                  </button>
                </div>
              </div>
            ))}
            {byStatus("draft").length === 0 && <Empty />}
          </Section>

          <Section title={`Aktive (${byStatus("open").length})`}>
            {byStatus("open").map((m) => (
              <div key={m.id} style={card}>
                <MarketRow m={m} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => marketAction(m.id, { action: "close" })} style={btn}>
                    Mbyll bastet
                  </button>
                </div>
              </div>
            ))}
            {byStatus("open").length === 0 && <Empty />}
          </Section>

          <Section title={`Mbyllura — gati për zgjidhje (${byStatus("closed").length})`}>
            {byStatus("closed").map((m) => (
              <div key={m.id} style={card}>
                <MarketRow m={m} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => marketAction(m.id, { action: "resolve", outcome: "PO" })} style={{ ...btn, background: "#00E599", border: "none" }}>
                    Zgjidh: PO
                  </button>
                  <button onClick={() => marketAction(m.id, { action: "resolve", outcome: "JO" })} style={{ ...btn, background: "#FF3B5C", color: "#fff", border: "none" }}>
                    Zgjidh: JO
                  </button>
                </div>
              </div>
            ))}
            {byStatus("closed").length === 0 && <Empty />}
          </Section>

          <Section title={`Pezulluara nga lajmet — pa baste (${byStatus("stale").length})`}>
            {byStatus("stale").map((m) => (
              <div key={m.id} style={card}>
                <MarketRow m={m} />
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#b45309" }}>
                  Prit referencën e suksesshme nga lajmet; automatizimi nuk ndryshon 383C ose pozicionet.
                </p>
              </div>
            ))}
            {byStatus("stale").length === 0 && <Empty />}
          </Section>

          <Section title={`Të zgjidhura (${byStatus("resolved").length})`}>
            {byStatus("resolved").map((m) => (
              <div key={m.id} style={card}>
                <MarketRow m={m} />
              </div>
            ))}
            {byStatus("resolved").length === 0 && <Empty />}
          </Section>
        </>
      )}

      {tab === "withdrawals" && (
        <Section title="Kërkesat për tërheqje">
          {withdrawals.map((w) => (
            <div key={w.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{w.profiles?.display_name ?? "Përdorues"}</strong> — {w.coins_amount} 383C → {w.payout_method}
                  <div style={{ fontSize: 12, color: "#6B6B6B" }}>
                    {new Date(w.requested_at).toLocaleString("sq-AL")} · Status: <strong>{w.status}</strong>
                  </div>
                </div>
                {w.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => withdrawalAction(w.id, "approved")} style={btn}>
                      Mirato
                    </button>
                    <button onClick={() => withdrawalAction(w.id, "paid")} style={{ ...btn, background: "#22C55E", color: "#fff", border: "none" }}>
                      U pagua
                    </button>
                    <button onClick={() => withdrawalAction(w.id, "rejected")} style={{ ...btn, color: "#e53e3e" }}>
                      Refuzo
                    </button>
                  </div>
                )}
                {w.status === "approved" && (
                  <button onClick={() => withdrawalAction(w.id, "paid")} style={{ ...btn, background: "#22C55E", color: "#fff", border: "none" }}>
                    U pagua
                  </button>
                )}
              </div>
            </div>
          ))}
          {withdrawals.length === 0 && <Empty />}
        </Section>
      )}
    </main>
  );
}

function RefreshHealthPanel({ health, error }: { health: RefreshHealth | null; error: string | null }) {
  const colors: Record<string, string> = { active: "#047857", healthy: "#2563EB", stale: "#B45309", failed: "#DC2626" };
  const llm = health?.llm_refresh;
  const live = health?.tregu_live;
  const llmDetails = llm?.latest_run?.details ?? {};
  const providers = Array.isArray(llmDetails.provider_used) ? llmDetails.provider_used.map(String) : [];
  const providerState = (provider: string) => providers.includes(provider) ? "aktiv në run-in e fundit" : "pa përdorim në run-in e fundit";
  const runBlock = (label: string, source: RefreshSourceHealth | undefined, extras: React.ReactNode) => <div style={{ borderLeft: `4px solid ${colors[source?.status ?? "stale"]}`, paddingLeft: 12 }}>
    <strong>{label}: {source?.status?.toUpperCase() ?? "DUKE U NGARKUAR"}</strong>
    <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
      <span>Kadenca: çdo {source?.cadence_seconds ?? "—"} sekonda</span>
      <span>I fundit i suksesshëm: {source?.last_successful_refresh ? new Date(source.last_successful_refresh).toLocaleString("sq-AL") : "—"}</span>
      {extras}
      <span>Rezultati: {String(source?.latest_run?.details?.outcome ?? source?.latest_run?.status ?? "—")}</span>
    </div>
    {source?.latest_run?.error && <p style={{ color: "#B91C1C", margin: "8px 0 0", fontSize: 12 }}>Gabim i run-it: {source.latest_run.error}</p>}
  </div>;
  return <section style={{ ...card, borderLeft: `5px solid ${colors[live?.status ?? llm?.status ?? "stale"]}`, marginBottom: 20 }} aria-live="polite">
    <strong>Shëndeti i automatizimit Tregu</strong>
    {error && <p style={{ color: "#B91C1C", margin: "8px 0 0", fontSize: 13 }}>Nuk u lexua shëndeti i fundit; po shfaqet gjendja e ruajtur. Gabim: {error}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 18, marginTop: 12, fontSize: 13 }}>
      {runBlock("Rifreskimi LLM (2 min)", llm, <>
        <span>Groq: {providerState("groq")}</span><span>Google: {providerState("google")}</span>
        <span>Skanuar: {String(llmDetails.open_markets_scanned ?? "—")} · Përditësime: {String(llmDetails.updates_applied ?? "—")}</span>
      </>)}
      {runBlock("tregu-live heartbeat (5 min)", live, <>
        <span>Përditësime zyrtare: {String(live?.latest_run?.details?.official_updates ?? "—")}</span>
        <span>ESPN ngjarje: {String(live?.latest_run?.details?.official_espn_events ?? "—")} · Shlyerje: {String(live?.latest_run?.details?.settled_market_count ?? "—")}</span>
      </>)}
    </div>
  </section>;
}

function MarketRow({ m }: { m: Market }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase" }}>{m.category}</span>
        {m.ai_generated && <span style={{ fontSize: 10, fontWeight: 700, color: "#FF4422" }}>AI</span>}
        {m.outcome && <span style={{ fontSize: 11, fontWeight: 700, color: m.outcome === "PO" ? "#22C55E" : "#e53e3e" }}>→ {m.outcome}</span>}
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{m.question}</p>
      {m.description && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B6B6B" }}>{m.description}</p>}
      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#999" }}>Mbyllet: {new Date(m.closes_at).toLocaleDateString("sq-AL")}</p>
      {m.last_checked_at && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6B6B6B" }}>Kontrolli i fundit: {new Date(m.last_checked_at).toLocaleString("sq-AL")} · {m.last_scan_result?.status ?? "—"}{typeof m.last_scan_result?.evidence_count === "number" ? ` · evidencë ${m.last_scan_result.evidence_count}` : ""}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p style={{ color: "#999", fontSize: 13 }}>Asgjë këtu ende.</p>;
}
