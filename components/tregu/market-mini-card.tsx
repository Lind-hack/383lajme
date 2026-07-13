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
  spark?: number[]; // downsampled PO price tape, 0..1, oldest first
  delta7d?: number | null; // prob change vs 7 days ago, 0..1 scale
}

// Tiny trade-tape sparkline. Stretched SVG holds no text, so
// preserveAspectRatio="none" is safe here.
function Sparkline({ points, dir }: { points: number[]; dir: "up" | "down" | "flat" }) {
  const W = 100;
  const H = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 0.02); // floor so a flat tape stays a visible line
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const y = (p: number) => 3 + (H - 6) * (1 - (p - min) / span);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${y(p).toFixed(1)}`).join(" ");
  const color = dir === "up" ? "#00854A" : dir === "down" ? "#B91C1C" : "#6B6B6B";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: H, display: "block" }}
      aria-hidden
    >
      <path d={`${path} L${W} ${H} L0 ${H} Z`} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={y(points[points.length - 1])} r={2.5} fill={color} />
    </svg>
  );
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

  // Weekly movement — the "why now" signal. Hidden until the tape has a week
  // of history or the move rounds to at least 1pp.
  const deltaPp = market.delta7d != null ? Math.round(market.delta7d * 100) : null;
  const dir: "up" | "down" | "flat" =
    deltaPp != null && deltaPp > 0 ? "up" : deltaPp != null && deltaPp < 0 ? "down" : "flat";
  const spark = market.spark && market.spark.length >= 2 ? market.spark : null;

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

      {spark && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Sparkline points={spark} dir={dir} />
          </div>
          {deltaPp != null && deltaPp !== 0 && (
            <span
              className="tregu-delta-chip"
              data-dir={dir}
              style={{ fontSize: 11, padding: "2px 9px", flexShrink: 0 }}
            >
              {deltaPp > 0 ? "▲" : "▼"} {Math.abs(deltaPp)}pp / 7d
            </span>
          )}
        </div>
      )}

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
