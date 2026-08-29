"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import ExactMarketChart, { type ExactMarketSeries } from "./exact-market-chart";
import SportBrandMark from "./sport-brand-mark";
import { outcomeColor, toExactSeries } from "@/lib/tregu-hub-market.mjs";

type Outcome = {
  key: string;
  label: string;
  team?: string;
  color?: string;
  team_color?: string;
  team_colour?: string;
  logo?: string;
};

export type StructuredSportMarket = {
  slug: string;
  question: string;
  category: string;
  market_type?: string;
  closes_at?: string;
  trade_count?: number;
  trade_volume?: number;
  q_yes?: number;
  q_no?: number;
  last_data_at?: string;
  live_event?: { league?: string; sport?: string } | null;
  sport_outcomes?: Outcome[] | null;
  outcome_probabilities?: Record<string, number> | null;
  outcome_history?: Record<string, { created_at: string; probability: number }[]> | null;
};

function closeLabel(iso?: string) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `Mbyllet ${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `Mbyllet ${hours}h`;
  return `Mbyllet ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export default function StructuredSportMarketCard({ market }: { market: StructuredSportMarket }) {
  const outcomes = market.sport_outcomes ?? [];
  const probabilities = market.outcome_probabilities ?? {};
  const chartSeries: ExactMarketSeries[] = outcomes.map((outcome, index) => ({
    key: outcome.key,
    label: outcome.label,
    color: outcomeColor(outcome, index),
    current: Math.max(0, Math.min(1, Number(probabilities[outcome.key] ?? 1 / outcomes.length))),
    points: toExactSeries(market.outcome_history?.[outcome.key]),
  }));
  const league = market.live_event?.league ?? null;
  const closing = closeLabel(market.closes_at);

  return (
    <article
      className="tregu-glass tregu-market tregu-native-market tregu-edge"
      data-native-sport-market
      data-outcomes={outcomes.length}
    >
      <div className="tregu-market-top">
        <span className="tregu-native-brand">
          <SportBrandMark brandKey={league} size="sm" />
          <span>{league ? "Treg sportiv" : "Sport"}</span>
        </span>
        {closing && <span className="tregu-market-close">{closing}</span>}
      </div>

      <Link href={`/tregu/${market.slug}`} className="tregu-native-title">
        {market.question}
      </Link>

      <ExactMarketChart
        compact
        minimal
        curve="smooth"
        height={104}
        series={chartSeries}
        tone="sport"
        ariaLabel={`Lëvizjet reale për ${market.question}`}
      />

      <div
        className="tregu-native-outcomes"
        style={{ gridTemplateColumns: `repeat(${Math.max(2, outcomes.length)}, minmax(0, 1fr))` }}
      >
        {outcomes.map((outcome, index) => {
          const probability = chartSeries[index]?.current ?? 0;
          const color = chartSeries[index]?.color ?? outcomeColor(outcome, index);
          return (
            <Link
              key={outcome.key}
              href={`/tregu/${market.slug}?rezultati=${encodeURIComponent(outcome.key)}`}
              className="tregu-native-outcome"
              style={{ "--outcome-color": color } as CSSProperties}
              aria-label={`${outcome.label}, ${Math.round(probability * 100)} për qind`}
            >
              <span className="tregu-native-outcome-name">
                {outcome.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={outcome.logo} alt="" aria-hidden loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <i aria-hidden style={{ background: color }} />
                )}
                <em>{outcome.label}</em>
              </span>
              <strong>{(probability * 100).toFixed(1)}%</strong>
            </Link>
          );
        })}
      </div>

      <footer className="tregu-market-foot">
        <span>
          Të dhëna live
        </span>
        <Link href={`/tregu/${market.slug}`} className="tregu-market-open">
          Hap tregun →
        </Link>
      </footer>
    </article>
  );
}
