"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatOfficialLiveScore, officialMetricsForDisplay } from "@/lib/tregu-market-detail.mjs";

export interface MiniMarket {
  slug: string;
  question: string;
  category: string;
  prob: number; // 0..1 YES probability
  volume?: number; // cumulative shares outstanding (q_yes + q_no)
  delta7d?: number; // probability change over seven days, when available
  spark?: number[]; // recent probability points, when available
  closesAt?: string;
  lastCheckedAt?: string | null;
  threeOutcomePrices?: { england: number; draw: number; argentina: number } | null;
  referenceProbabilities?: { england: number; draw: number; argentina: number } | null;
  liveScoreState?: {
    status?: string;
    detail?: string;
    competitors?: { team: string; score: number }[];
    metrics?: Record<string, { shots?: number; shots_on_target?: number; possession?: number; xg?: number }>;
    metric_sources?: Record<string, Record<string, "espn" | "flashscore">>;
    supplemental?: { flashscore?: { availability?: "available" | "unavailable" } };
  } | null;
  refreshHealth?: { status?: "active" | "healthy" | "stale"; last_successful_scan_at?: string | null; lineup_status?: "confirmed" | "predicted_or_unknown" } | null;
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
  const health = market.refreshHealth;
  const healthLabel = health?.status === "stale" ? "Stale" : health?.status === "active" ? "Aktiv" : health?.status === "healthy" ? "Healthy" : null;
  const officialMetrics = officialMetricsForDisplay(market.liveScoreState?.metrics, market.liveScoreState?.metric_sources);
  const officialLiveScore = formatOfficialLiveScore(market.liveScoreState ?? undefined);
  const flashscoreAvailable = market.liveScoreState?.supplemental?.flashscore?.availability === "available";
  const lastCheckedLabel = market.lastCheckedAt && !Number.isNaN(new Date(market.lastCheckedAt).getTime())
    ? `Kontrolluar ${new Date(market.lastCheckedAt).toLocaleString("sq-AL", { hour: "2-digit", minute: "2-digit" })}`
    : null;

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
        {healthLabel && <span role="status" aria-label={`Groq/market scan ${healthLabel}${health?.last_successful_scan_at ? `; i fundit ${new Date(health.last_successful_scan_at).toLocaleString("sq-AL")}` : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: health?.status === "stale" ? "#B45309" : "#047857", fontSize: 11, fontWeight: 800 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />Groq {healthLabel}</span>}
        {health?.lineup_status && <span style={{ color: "#6B6B6B", fontSize: 11, fontWeight: 700 }}>{health.lineup_status === "confirmed" ? "Formacionet: të konfirmuara" : "Formacionet: të panjohura"}</span>}
        {remaining && (
          <span className="tregu-market-close">{closed ? remaining : `Mbyllet ${remaining}`}</span>
        )}
      </div>

      <p className="tregu-market-q">{market.question}</p>

      {market.liveScoreState && (
        <section aria-label="Gjendja zyrtare live ESPN" style={{ margin: "0 0 12px", padding: 10, borderRadius: 10, background: "rgba(17,17,17,.045)", fontSize: 12 }}>
          <strong>{officialLiveScore.sourceLabel} · {officialLiveScore.status}</strong>
          {officialLiveScore.score && <div style={{ marginTop: 4, fontWeight: 800 }}>{officialLiveScore.score}</div>}
          {officialMetrics.map((metrics) => <div key={metrics.team} style={{ marginTop: 5 }}>{metrics.team}: {metrics.possession !== undefined && `Posedim ${metrics.possession}%${flashscoreAvailable && metrics.sources.possession === "flashscore" ? " (Flashscore)" : ""}`} {metrics.shots !== undefined && `· Goditje ${metrics.shots}${flashscoreAvailable && metrics.sources.shots === "flashscore" ? " (Flashscore)" : ""}`} {metrics.shotsOnTarget !== undefined && `· në portë ${metrics.shotsOnTarget}${flashscoreAvailable && metrics.sources.shots_on_target === "flashscore" ? " (Flashscore)" : ""}`} {metrics.xg !== undefined && `· xG ${metrics.xg}${flashscoreAvailable && metrics.sources.xg === "flashscore" ? " (Flashscore)" : ""}`}</div>)}
          {market.referenceProbabilities && <div style={{ marginTop: 5, color: "#6B6B6B" }}>Referenca: England {(market.referenceProbabilities.england * 100).toFixed(1)}% · Draw {(market.referenceProbabilities.draw * 100).toFixed(1)}% · Argentina {(market.referenceProbabilities.argentina * 100).toFixed(1)}%</div>}
        </section>
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
        {lastCheckedLabel && <span style={{ color: "#6B6B6B", fontSize: 11 }}>{lastCheckedLabel}</span>}
        <span className="tregu-market-open">Hap tregun →</span>
      </div>
    </Link>
  );
}
