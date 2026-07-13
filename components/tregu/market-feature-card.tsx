"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MiniMarket } from "./market-mini-card";
import { fmtNum } from "@/lib/format";

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

function closeLabel(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Mbyllet për ${days} ditë`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Mbyllet për ${hours} orë`;
  return `Mbyllet për ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

// Feature-sized price tape: same trade data as the mini sparkline, drawn at
// chart scale with a gradient floor so the flagship market reads as a live
// instrument, not a bigger card. Geometry-only SVG; labels live in HTML.
function FeatureTape({ points, dir }: { points: number[]; dir: "up" | "down" | "flat" }) {
  const W = 480;
  const H = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 0.04);
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const y = (p: number) => 8 + (H - 16) * (1 - (p - min) / span);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${y(p).toFixed(1)}`)
    .join(" ");
  const color = dir === "up" ? "#00854A" : dir === "down" ? "#B91C1C" : "#6B6B6B";
  const gid = `tg-feat-${dir}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="0"
          y1={8 + (H - 16) * g}
          x2={W}
          y2={8 + (H - 16) * g}
          stroke="rgba(17,17,17,0.06)"
          strokeDasharray={g === 0.5 ? "4 4" : undefined}
        />
      ))}
      <path d={`${path} L${W} ${H} L0 ${H} Z`} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={y(points[points.length - 1])} r={4} fill={color} stroke="#FFFFFF" strokeWidth={2} />
    </svg>
  );
}

// Flagship market card — the top market of the active sort, spanning the full
// grid row. Left: the trade proposition (question, depth, PO/JO). Right: the
// live tape at chart scale with the headline probability. Same Two-Color
// discipline as the mini card: green/red only in depth, sides, delta, tape.
export default function MarketFeatureCard({ market }: { market: MiniMarket }) {
  const router = useRouter();
  const pct = Math.round(Math.max(0, Math.min(1, market.prob)) * 100);
  const noPct = 100 - pct;
  const yesMult = pct >= 1 ? (100 / pct).toFixed(2) : null;
  const noMult = noPct >= 1 ? (100 / noPct).toFixed(2) : null;
  const remaining = closeLabel(market.closesAt);

  const deltaPp = market.delta7d != null ? Math.round(market.delta7d * 100) : null;
  const dir: "up" | "down" | "flat" =
    deltaPp != null && deltaPp > 0 ? "up" : deltaPp != null && deltaPp < 0 ? "down" : "flat";
  const spark = market.spark && market.spark.length >= 2 ? market.spark : null;

  const goToSide = (e: React.MouseEvent, side: "PO" | "JO") => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${market.slug}?ana=${side.toLowerCase()}`);
  };

  return (
    <Link
      href={`/tregu/${market.slug}`}
      className="tregu-glass tregu-feature"
      style={{ textDecoration: "none", color: "#111111" }}
    >
      <div className="tregu-feature-grid">
        {/* ── The proposition ── */}
        <div className="tregu-feature-main">
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
            {remaining && <span className="tregu-market-close">{remaining}</span>}
          </div>

          <p className="tregu-feature-q">{market.question}</p>

          <div className="tregu-depth" aria-hidden style={{ marginTop: "auto" }}>
            <div className="tregu-depth-yes" style={{ width: `${pct}%` }} />
            <div className="tregu-depth-no" style={{ width: `${noPct}%` }} />
          </div>

          <div className="tregu-sides">
            <button onClick={(e) => goToSide(e, "PO")} className="tregu-side tregu-btn-yes tregu-feature-side" type="button">
              <div className="tregu-side-row">
                <span className="tregu-side-name">PO</span>
                <span className="tregu-side-pct">{pct}%</span>
              </div>
              <span className="tregu-side-mult">{yesMult ? `×${yesMult}` : "—"}</span>
            </button>
            <button onClick={(e) => goToSide(e, "JO")} className="tregu-side tregu-btn-no tregu-feature-side" type="button">
              <div className="tregu-side-row">
                <span className="tregu-side-name">JO</span>
                <span className="tregu-side-pct">{noPct}%</span>
              </div>
              <span className="tregu-side-mult">{noMult ? `×${noMult}` : "—"}</span>
            </button>
          </div>

          <div className="tregu-market-foot" style={{ border: "none", paddingTop: 0 }}>
            <span>
              {market.volume !== undefined && market.volume > 0
                ? `Vëllimi ${fmtNum(market.volume)} 383C`
                : "Treg i ri"}
            </span>
            <span className="tregu-market-open">Hap tregun →</span>
          </div>
        </div>

        {/* ── The instrument ── */}
        <div className="tregu-feature-chart">
          <div className="tregu-feature-price">
            <div>
              <span className="tregu-feature-price-label">Gjasa PO</span>
              <span className="tregu-feature-price-value">{pct}%</span>
            </div>
            {deltaPp != null && deltaPp !== 0 && (
              <span className="tregu-delta-chip" data-dir={dir}>
                {deltaPp > 0 ? "▲" : "▼"} {Math.abs(deltaPp)}pp / 7d
              </span>
            )}
          </div>
          <div className="tregu-feature-tape">
            {spark ? (
              <FeatureTape points={spark} dir={dir} />
            ) : (
              <div className="tregu-feature-empty">
                <span style={{ fontWeight: 800, fontSize: 13, color: "#111111" }}>Tape e re</span>
                <span>Grafiku ndërtohet nga tregtimet e para. Bëhu i pari.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
