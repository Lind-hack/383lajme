"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export interface MiniMarket {
  slug: string;
  question: string;
  category: string;
  prob: number; // 0..1 YES probability
  volume?: number; // cumulative shares outstanding (q_yes + q_no)
  closesAt?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

export default function MarketMiniCard({ market, compact = false }: { market: MiniMarket; compact?: boolean }) {
  const router = useRouter();
  const pct = Math.round(Math.max(0, Math.min(1, market.prob)) * 100);
  const leading = pct >= 50;
  const color = leading ? "#00A651" : "#E41E20";

  const goToSide = (e: React.MouseEvent, side: "PO" | "JO") => {
    // The whole card is a link to the market; PO/JO jump straight to that side.
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${market.slug}?ana=${side.toLowerCase()}`);
  };

  return (
    <Link
      href={`/tregu/${market.slug}`}
      className="tregu-glass"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: compact ? "16px" : "18px",
        textDecoration: "none",
        color: "#111111",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
        <span
          style={{
            fontSize: compact ? 20 : 22,
            fontWeight: 800,
            color,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {pct}%
        </span>
      </div>

      <p
        style={{
          fontSize: compact ? 14 : 15,
          fontWeight: 700,
          lineHeight: 1.4,
          margin: "0 0 12px",
          color: "#111111",
          flex: 1,
        }}
      >
        {market.question}
      </p>

      <div className="tregu-prob-track" style={{ marginBottom: 12 }}>
        <div className="tregu-prob-fill" style={{ width: `${pct}%`, background: color }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: market.volume || market.closesAt ? 12 : 0 }}>
        <button
          onClick={(e) => goToSide(e, "PO")}
          className="tregu-btn-yes"
          style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          Po {pct}%
        </button>
        <button
          onClick={(e) => goToSide(e, "JO")}
          className="tregu-btn-no"
          style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          Jo {100 - pct}%
        </button>
      </div>

      {(market.volume !== undefined || market.closesAt) && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "#6B6B6B" }}>
          <span>
            {market.volume !== undefined && market.volume > 0
              ? `${Math.round(market.volume).toLocaleString("sq-AL")} 383C vëllim`
              : "Treg i ri"}
          </span>
          {market.closesAt && (
            <span>
              Mbyllet {new Date(market.closesAt).toLocaleDateString("sq-AL", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
