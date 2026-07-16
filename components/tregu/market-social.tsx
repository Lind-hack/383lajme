"use client";

import { useState } from "react";
import Link from "next/link";
import type { MarketTrade, Side } from "@/lib/tregu-client";

// Below-the-fold social layer for the market detail page — the Polymarket
// pattern: Komentet | Mbajtësit | Pozicionet | Aktiviteti. Holder data comes
// from the public market_top_holders RPC (board-safe columns only), comments
// from market_comments. Everything degrades to friendly empty states when the
// market is young or the 0004 migration hasn't run yet.

export interface HolderRow {
  name: string;
  side: Side | string;
  shares: number;
  coinsStaked: number;
}

export interface CommentItem {
  id: string;
  name: string;
  body: string;
  createdAt: string;
}

const TABS = ["Komentet", "Mbajtësit", "Pozicionet", "Aktiviteti"] as const;
type Tab = (typeof TABS)[number];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  if (ms < 60_000) return "tani";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `para ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `para ${h} orësh`;
  return `para ${Math.floor(h / 24)} ditësh`;
}

// Deterministic avatar hue per name — stable across renders and sessions.
function avatarHue(name: string): number {
  let acc = 0;
  for (let i = 0; i < name.length; i++) acc = (acc * 31 + name.charCodeAt(i)) % 360;
  return acc;
}

function Avatar({ name }: { name: string }) {
  const hue = avatarHue(name);
  return (
    <span
      className="tregu-avatar"
      style={{ background: `oklch(0.88 0.06 ${hue})`, color: `oklch(0.35 0.09 ${hue})` }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export default function MarketSocial({
  marketId,
  holders,
  comments: initialComments,
  activity,
  priceYes,
  sideLabel,
  loggedIn,
  demo,
}: {
  marketId: string;
  holders: HolderRow[];
  comments: CommentItem[];
  activity: MarketTrade[];
  priceYes: number;
  sideLabel: (s: Side) => string;
  loggedIn: boolean;
  demo: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Komentet");
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);

  const postComment = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    if (demo) {
      setComments((c) => [
        { id: `demo-${Date.now()}`, name: "Ti", body, createdAt: new Date().toISOString() },
        ...c,
      ]);
      setDraft("");
      return;
    }
    setPosting(true);
    setPostErr(null);
    const res = await fetch("/api/tregu/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId, body }),
    });
    const data = await res.json();
    if (res.ok && data.comment) {
      setComments((c) => [data.comment, ...c]);
      setDraft("");
    } else {
      setPostErr(data.error ?? "Komenti nuk u dërgua");
    }
    setPosting(false);
  };

  const yesHolders = holders.filter((h) => h.side === "PO").sort((a, b) => b.shares - a.shares);
  const noHolders = holders.filter((h) => h.side === "JO").sort((a, b) => b.shares - a.shares);

  const positionRows = [...holders]
    .map((h) => {
      const price = h.side === "PO" ? priceYes : 1 - priceYes;
      const value = h.shares * price;
      const pnl = value - h.coinsStaked;
      const avgEntry = h.shares > 0 ? h.coinsStaked / h.shares : 0;
      return { ...h, value, pnl, avgEntry };
    })
    .sort((a, b) => b.value - a.value);

  const counts: Record<Tab, number> = {
    Komentet: comments.length,
    Mbajtësit: holders.length,
    Pozicionet: holders.length,
    Aktiviteti: activity.length,
  };

  return (
    <div className="tregu-panel" style={{ padding: 0 }}>
      <div className="tregu-tabs" role="tablist" aria-label="Diskutimi dhe pozicionet">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="tregu-tab"
            data-active={tab === t}
            onClick={() => setTab(t)}
            type="button"
          >
            {t}
            {counts[t] > 0 && <span className="tregu-tab-count">{counts[t]}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px 24px" }}>
        {tab === "Komentet" && (
          <div>
            {loggedIn || demo ? (
              <div className="tregu-comment-box">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  placeholder="Shkruaj mendimin tënd për këtë treg..."
                  rows={2}
                  maxLength={500}
                  aria-label="Komenti yt"
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "#6B6B6B", fontVariantNumeric: "tabular-nums" }}>
                    {draft.length}/500
                  </span>
                  <button
                    className="tregu-btn-primary"
                    style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
                    disabled={posting || draft.trim().length === 0}
                    onClick={postComment}
                    type="button"
                  >
                    {posting ? "Duke dërguar..." : "Komento"}
                  </button>
                </div>
                {postErr && <p style={{ color: "#E41E20", fontSize: 12, margin: "6px 0 0" }}>{postErr}</p>}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#6B6B6B", margin: "0 0 18px" }}>
                <Link href="/hyr" style={{ color: "#00854A", fontWeight: 700 }}>
                  Kyçu
                </Link>{" "}
                për të komentuar.
              </p>
            )}

            {comments.length === 0 ? (
              <p className="tregu-social-empty">Ende pa komente — bëhu i pari që jep mendimin.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {comments.map((c) => (
                  <div key={c.id} className="tregu-comment">
                    <Avatar name={c.name} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{c.name}</span>
                        <span style={{ fontSize: 11, color: "#6B6B6B" }}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p style={{ margin: "3px 0 0", fontSize: 13.5, lineHeight: 1.55, overflowWrap: "break-word" }}>{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Mbajtësit" && (
          <div className="tregu-holders-grid">
            {(
              [
                { label: sideLabel("PO"), rows: yesHolders, color: "#00854A" },
                { label: sideLabel("JO"), rows: noHolders, color: "#C51518" },
              ] as const
            ).map((col) => (
              <div key={col.label}>
                <div className="tregu-holders-head" style={{ color: col.color }}>
                  Mbajtësit {col.label}
                </div>
                {col.rows.length === 0 ? (
                  <p className="tregu-social-empty">Ende askush në këtë anë.</p>
                ) : (
                  col.rows.slice(0, 10).map((h, i) => (
                    <div key={`${h.name}-${i}`} className="tregu-holder-row">
                      <span className="tregu-holder-rank">{i + 1}</span>
                      <Avatar name={h.name} />
                      <span className="tregu-holder-name">{h.name}</span>
                      <span className="tregu-holder-shares">{h.shares.toFixed(0)} aksione</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "Pozicionet" && (
          <div>
            {positionRows.length === 0 ? (
              <p className="tregu-social-empty">Ende pa pozicione të hapura në këtë treg.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tregu-positions-table">
                  <thead>
                    <tr>
                      <th>Tregtari</th>
                      <th>Ana</th>
                      <th>Aksione</th>
                      <th>Hyrja mes.</th>
                      <th>Vlera</th>
                      <th>P/F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionRows.slice(0, 20).map((p, i) => (
                      <tr key={`${p.name}-${p.side}-${i}`}>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <Avatar name={p.name} />
                            <span className="tregu-holder-name">{p.name}</span>
                          </span>
                        </td>
                        <td>
                          <span className="tregu-side-chip" data-side={p.side}>
                            {sideLabel(p.side as Side)}
                          </span>
                        </td>
                        <td>{p.shares.toFixed(1)}</td>
                        <td>{(p.avgEntry * 100).toFixed(0)}%</td>
                        <td>{p.value.toFixed(1)} 383C</td>
                        <td>
                          <span className={p.pnl >= 0 ? "tregu-pnl-pos" : "tregu-pnl-neg"}>
                            {p.pnl >= 0 ? "+" : ""}
                            {p.pnl.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "Aktiviteti" && (
          <div>
            {activity.length === 0 ? (
              <p className="tregu-social-empty">Ende pa tregtime.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {activity.map((t) => (
                  <div key={t.id} className="tregu-activity-row">
                    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={t.profiles?.display_name || "Anonim"} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 700 }}>{t.profiles?.display_name || "Anonim"}</span>{" "}
                        <span style={{ color: "#6B6B6B" }}>{t.action === "buy" ? "bleu" : "shiti"}</span>{" "}
                        <span style={{ fontWeight: 800, color: t.side === "PO" ? "#00854A" : "#C51518" }}>
                          {sideLabel(t.side as Side)}
                        </span>{" "}
                        <span style={{ color: "#6B6B6B", fontVariantNumeric: "tabular-nums" }}>
                          {Number(t.coins).toFixed(0)} 383C · {Math.round(t.price_yes * 100)}%
                        </span>
                      </span>
                    </div>
                    <span style={{ color: "#6B6B6B", fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(t.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
