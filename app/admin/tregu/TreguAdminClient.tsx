"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Market {
  id: string;
  slug: string;
  question: string;
  description: string | null;
  category: string;
  status: "draft" | "open" | "closed" | "resolved";
  outcome: "PO" | "JO" | null;
  closes_at: string;
  ai_generated: boolean;
}

interface Withdrawal {
  id: string;
  status: string;
  coins_amount: number;
  payout_method: string;
  requested_at: string;
  profiles?: { display_name: string | null } | null;
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#F9F6F1", fontFamily: "inherit", padding: "40px 32px" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8E3DB", borderRadius: 16, padding: 20, marginBottom: 14 };
const btn: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, border: "1px solid #E8E3DB", background: "#F3F4F6", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

export default function TreguAdminClient() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [tab, setTab] = useState<"markets" | "withdrawals">("markets");

  const loadMarkets = () => fetch("/api/admin/tregu/markets").then((r) => r.json()).then((d) => setMarkets(d.markets ?? []));
  const loadWithdrawals = () => fetch("/api/admin/tregu/withdrawals").then((r) => r.json()).then((d) => setWithdrawals(d.withdrawals ?? []));

  useEffect(() => {
    loadMarkets();
    loadWithdrawals();
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
