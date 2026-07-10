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

// Compact time-to-close: "3d", "7h", "12m", or "Mbyllur" once past.
function closeLabel(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export default function MarketMiniCard({ market }: { market: MiniMarket; compact?: boolean }) {
  const router = useRouter();
  const pct = Math.round(Math.max(0, Math.min(1, market.prob)) * 100);
  const noPct = 100 - pct;
  // Payout multiple: buying a side at p% returns 100/p per coin if it resolves
  // that way. This is the number a trader is actually weighing.
  const yesMult = pct >= 1 ? (100 / pct).toFixed(2) : null;
  const noMult = noPct >= 1 ? (100 / noPct).toFixed(2) : null;
  const remaining = closeLabel(market.closesAt);
  const closed = remaining === "Mbyllur";

  const goToSide = (e: React.MouseEvent, side: "PO" | "JO") => {
    // The whole card links to the market; PO/JO jump straight to that side.
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${market.slug}?ana=${side.toLowerCase()}`);
  };

  return (
    <Link
      href={`/tregu/${market.slug}`}
      className="tregu-glass tregu-market"
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#111111" }}
    >
      <div className="tregu-market-top">
        <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
        {remaining && (
          <span className="tregu-market-close">{closed ? remaining : `Mbyllet ${remaining}`}</span>
        )}
      </div>

      <p className="tregu-market-q">{market.question}</p>

      <div className="tregu-depth" aria-hidden>
        <div className="tregu-depth-yes" style={{ width: `${pct}%` }} />
        <div className="tregu-depth-no" style={{ width: `${noPct}%` }} />
      </div>

      <div className="tregu-sides">
        <button onClick={(e) => goToSide(e, "PO")} className="tregu-side tregu-btn-yes" type="button">
          <div className="tregu-side-row">
            <span className="tregu-side-name">PO</span>
            <span className="tregu-side-pct">{pct}%</span>
          </div>
          <span className="tregu-side-mult">{yesMult ? `×${yesMult}` : "—"}</span>
        </button>
        <button onClick={(e) => goToSide(e, "JO")} className="tregu-side tregu-btn-no" type="button">
          <div className="tregu-side-row">
            <span className="tregu-side-name">JO</span>
            <span className="tregu-side-pct">{noPct}%</span>
          </div>
          <span className="tregu-side-mult">{noMult ? `×${noMult}` : "—"}</span>
        </button>
      </div>

      <div className="tregu-market-foot">
        <span>
          {market.volume !== undefined && market.volume > 0
            ? `Vëllimi ${Math.round(market.volume).toLocaleString("sq-AL")} 383C`
            : "Treg i ri"}
        </span>
        <span className="tregu-market-open">Hap tregun →</span>
      </div>
    </Link>
  );
}
