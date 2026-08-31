"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { toExactSeries } from "@/lib/tregu-hub-market.mjs";
import type { MarketMedia } from "@/lib/tregu-market-media.mjs";
import ExactMarketChart, { type ExactMarketSeries } from "./exact-market-chart";
import MarketContextMedia from "./market-context-media";
import SportBrandMark from "./sport-brand-mark";

export interface MiniMarket {
  slug: string;
  question: string;
  category: string;
  prob: number; // 0..1 YES probability
  volume?: number; // cumulative shares outstanding (q_yes + q_no)
  closesAt?: string;
  spark?: number[]; // downsampled PO price tape, 0..1, oldest first
  delta7d?: number | null; // prob change vs 7 days ago, 0..1 scale
  history?: { created_at: string; probability: number }[];
  tradeCount?: number;
  lastDataAt?: string;
  marketMedia?: MarketMedia | null;
  marketType?: string;
  league?: string | null;
  eventKind?: string | null;
  sportOutcomes?: {
    key: string;
    label: string;
    team?: string;
    color?: string;
    team_color?: string;
    team_colour?: string;
    logo?: string;
    championship_position?: number;
    championship_points?: number;
    latest_race_position?: number | null;
    weekend_points?: number;
    gap_to_leader?: number;
    gap_change?: number;
  }[] | null;
  outcomeProbabilities?: Record<string, number> | null;
  outcomeHistory?: Record<string, { created_at: string; probability: number }[]> | null;
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

function msToClose(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isNaN(ms) ? null : ms;
}

// Every market wears the face its data earns — the grid is not one
// repeated template:
//   new     — no volume yet: an invitation to set the first price
//   closing — under 48h left: the countdown leads
//   mover   — ≥3pp weekly move with a tape: the chart leads
//   default — question + book, the plain instrument
type Variant = "new" | "closing" | "mover" | "default";

export default function MarketMiniCard({ market }: { market: MiniMarket; compact?: boolean }) {
  const router = useRouter();
  const pct = Math.round(Math.max(0, Math.min(1, market.prob)) * 100);
  const noPct = 100 - pct;
  const remaining = closeLabel(market.closesAt);
  const closed = remaining === "Mbyllur";

  // Weekly movement — the "why now" signal. Hidden until the tape has a week
  // of history or the move rounds to at least 1pp.
  const deltaPp = market.delta7d != null ? Math.round(market.delta7d * 100) : null;
  const dir: "up" | "down" | "flat" =
    deltaPp != null && deltaPp > 0 ? "up" : deltaPp != null && deltaPp < 0 ? "down" : "flat";
  const exactPoints = toExactSeries(market.history);
  const chartSeries: ExactMarketSeries[] = [{
    key: "po",
    label: "PO",
    color: "#00854A",
    current: market.prob,
    points: exactPoints,
  }];

  const ms = msToClose(market.closesAt);
  const isNew = !market.volume;
  const isClosingSoon = !closed && ms !== null && ms > 0 && ms < 48 * 3_600_000;
  const isMover = exactPoints.length >= 2 && deltaPp !== null && Math.abs(deltaPp) >= 3;
  const variant: Variant = isNew ? "new" : isClosingSoon ? "closing" : isMover ? "mover" : "default";
  const isChampionship = market.marketType === "f1_race_winner" && market.eventKind === "championship";
  const championshipLeaders = isChampionship
    ? (market.sportOutcomes ?? [])
        .map((driver) => ({ ...driver, probability: Number(market.outcomeProbabilities?.[driver.key] ?? 0) }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)
    : [];

  const goToSide = (e: React.MouseEvent, side: "PO" | "JO") => {
    // The whole card links to the market; PO/JO jump straight to that side.
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${market.slug}?ana=${side.toLowerCase()}`);
  };

  if (isChampionship) {
    return (
      <Link
        href={`/tregu/${market.slug}`}
        className="tregu-glass tregu-market tregu-edge tregu-championship-card"
        data-cat={market.category}
        data-championship=""
      >
        <div className="tregu-championship-card-head">
          <span className="tregu-championship-mark" aria-hidden><Trophy size={20} strokeWidth={2.2} /></span>
          <span>Formula 1 · Kampionati</span>
          {remaining ? <span className="tregu-market-close">{closed ? remaining : `Mbyllet ${remaining}`}</span> : null}
        </div>
        <p className="tregu-market-q">{market.question}</p>
        <div className="tregu-championship-leaders" aria-label="Favoritët për titull">
          {championshipLeaders.map((driver, index) => (
            <div className="tregu-championship-leader" key={driver.key}>
              <span className="tregu-championship-rank">{index + 1}</span>
              <span className="tregu-championship-driver">
                <strong>{driver.label}</strong>
                <small>{driver.championship_points ?? 0} pikë · {driver.gap_to_leader ? `−${driver.gap_to_leader} nga kreu` : "kryeson"}</small>
              </span>
              <strong className="tregu-championship-odd">{Math.round(driver.probability * 100)}%</strong>
            </div>
          ))}
        </div>
        <div className="tregu-market-foot">
          <span>OpenF1 · 22 pilotë</span>
          <span className="tregu-market-open">Hap tregun e titullit →</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/tregu/${market.slug}`}
      className="tregu-glass tregu-market tregu-edge"
      data-simple
      data-cat={market.category}
      data-variant={variant}
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#111111" }}
    >
      <div className="tregu-market-top">
        <span className="tregu-market-kind">
          {market.category === "sport" && market.league ? <SportBrandMark brandKey={market.league} size="sm" /> : null}
          <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
        </span>
        {remaining && <span className="tregu-market-close">{closed ? remaining : `Mbyllet ${remaining}`}</span>}
      </div>

      {market.category !== "sport" && market.marketMedia ? (
        <div className="tregu-market-story">
          <p className="tregu-market-q">{market.question}</p>
          <MarketContextMedia media={market.marketMedia} variant="card" />
        </div>
      ) : (
        <p className="tregu-market-q">{market.question}</p>
      )}

      <div className="tregu-market-chart-mini">
        <div className="tregu-market-readout">
          <span>Gjasa për PO</span>
          <strong>{pct}%</strong>
          {variant === "mover" && deltaPp !== null && deltaPp !== 0 ? (
            <em data-dir={dir}>Këtë javë: {Math.max(0, Math.min(100, pct - deltaPp))}% → {pct}%</em>
          ) : null}
        </div>
        <ExactMarketChart
          compact
          minimal
          curve="smooth"
          height={76}
          series={chartSeries}
          tone={market.category === "sport" ? "sport" : "serious"}
          ariaLabel={`Historia e regjistruar për ${market.question}`}
        />
      </div>

      <div className="tregu-sides">
        <button onClick={(e) => goToSide(e, "PO")} className="tregu-side tregu-btn-yes" type="button">
          <div className="tregu-side-row">
            <span className="tregu-side-name">PO</span>
            <span className="tregu-side-pct">{pct}%</span>
          </div>
        </button>
        <button onClick={(e) => goToSide(e, "JO")} className="tregu-side tregu-btn-no" type="button">
          <div className="tregu-side-row">
            <span className="tregu-side-name">JO</span>
            <span className="tregu-side-pct">{noPct}%</span>
          </div>
        </button>
      </div>

      <div className="tregu-market-foot">
        <span>
          Të dhëna live
        </span>
        <span className="tregu-market-open">Hap tregun →</span>
      </div>
    </Link>
  );
}
