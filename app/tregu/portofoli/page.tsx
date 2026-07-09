"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import CoinIcon from "@/components/tregu/coin-icon";
import { createClient } from "@/lib/supabase/client";

interface Position {
  id: string;
  side: "PO" | "JO";
  shares: number;
  currentValue: number | null;
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

export default function PortofoliPage() {
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [payoutMethod, setPayoutMethod] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/tregu/portfolio").then((r) => r.json()),
      fetch("/api/tregu/withdraw").then((r) => r.json()),
    ]).then(([p, w]) => {
      setProfile(p.profile ?? null);
      setPositions(p.positions ?? []);
      setTransactions(p.transactions ?? []);
      setWithdrawals(w.withdrawals ?? []);
    });
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSignedIn(Boolean(user));
      setCheckedAuth(true);
      if (user) load();
    });
  }, []);

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

  const canWithdraw = (profile?.coins ?? 0) >= 10000;

  return (
    <div className="tregu-scope">
      <Navbar />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "104px 24px 80px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 24px" }}>Portofoli</h1>

        <div className="tregu-glass tregu-glass-hi" style={{ padding: 24, display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <CoinIcon size={44} />
          <div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{(profile?.coins ?? 0).toLocaleString("sq-AL")}</div>
            <div style={{ color: "#6B6B6B", fontSize: 12 }}>383 Coin · 10,000 = 10€</div>
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Pozicionet aktive</h2>
        {positions.length === 0 ? (
          <p style={{ color: "#6B6B6B", fontSize: 13, marginBottom: 28 }}>Ende pa pozicione — shko te Tregu dhe vër bastin e parë.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {positions.map((p) => (
              <Link
                key={p.id}
                href={`/tregu/${p.markets?.slug}`}
                className="tregu-glass"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, textDecoration: "none", color: "#111111" }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.markets?.question}</div>
                  <div style={{ fontSize: 12, color: p.side === "PO" ? "#00A651" : "#E41E20" }}>
                    {p.side} · {p.shares.toFixed(2)} aksione
                  </div>
                </div>
                <div style={{ fontWeight: 800 }}>{p.currentValue !== null ? p.currentValue.toFixed(1) : "—"} 383C</div>
              </Link>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Tërhiqe fitimin</h2>
        <div className="tregu-glass" style={{ padding: 20, marginBottom: 28 }}>
          {canWithdraw ? (
            <>
              <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 12 }}>
                Ke {profile?.coins.toLocaleString("sq-AL")} 383 Coin — mund të tërheqësh 10,000 për 10€.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  placeholder="PayPal email ose IBAN"
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(17,17,17,0.12)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#111111",
                    fontSize: 13,
                    transition: "border-color 160ms var(--ease-out), background-color 160ms var(--ease-out)",
                  }}
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
              {withdrawMsg && <p style={{ fontSize: 12, marginTop: 10, color: "#9C6B12" }}>{withdrawMsg}</p>}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#6B6B6B" }}>
              Duhen 10,000 383 Coin për të tërhequr (ke {profile?.coins.toLocaleString("sq-AL") ?? 0}).
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

        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Historiku</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {transactions.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6B6B", padding: "8px 4px", borderBottom: "1px solid rgba(17,17,17,0.08)" }}>
              <span>{t.type} · {new Date(t.created_at).toLocaleDateString("sq-AL")}</span>
              <span style={{ color: t.amount >= 0 ? "#00A651" : "#E41E20", fontWeight: 700 }}>
                {t.amount >= 0 ? "+" : ""}
                {t.amount}
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
  return "#9C6B12";
}
