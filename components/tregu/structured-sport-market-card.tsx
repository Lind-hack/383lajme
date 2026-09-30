"use client";
import { courtArtFor, sportBrandFor } from "@/lib/tregu-sport-branding";
import { formatKosovoDate, formatKosovoTime } from "@/lib/tregu-local-time.mjs";
import { fmtNum } from "@/lib/format";

import Link from "next/link";
import type { CSSProperties } from "react";
import ExactMarketChart, { type ExactMarketSeries } from "./exact-market-chart";
import CompetitionArt from "./competition-art";
import CompetitionArtwork from "./competition-artwork";
import SportBrandMark from "./sport-brand-mark";
import { outcomeColor, separateOutcomeColors, toExactSeries } from "@/lib/tregu-hub-market.mjs";

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
  live_event?: { league?: string; sport?: string; kickoff?: string } | null;
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

/** "Sot", "Nesër" or the date, judged in Kosovo time. */
function dayLabel(iso: string) {
  const day = formatKosovoDate(iso);
  if (day === formatKosovoDate(Date.now())) return "Sot";
  if (day === formatKosovoDate(Date.now() + 86_400_000)) return "Nesër";
  return day;
}

function initials(name: string) {
  // Letters only: "Rahoveci 029" is RA, not R0.
  const words = name.replace(/[^\p{L} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}` : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** A team's mark: its crest when the feed has one, else its initials on its colour. */
function Crest({ outcome, color }: { outcome?: Outcome; color: string }) {
  if (!outcome) return null;
  return outcome.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="tregu-bb-crest" src={outcome.logo} alt="" aria-hidden loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <span className="tregu-bb-crest" aria-hidden style={{ "--crest": color } as CSSProperties}>
      {initials(outcome.label)}
    </span>
  );
}

export default function StructuredSportMarketCard({ market }: { market: StructuredSportMarket }) {
  const outcomes = market.sport_outcomes ?? [];
  const probabilities = market.outcome_probabilities ?? {};
  const colors = separateOutcomeColors(outcomes.map((outcome, index) => outcomeColor(outcome, index)));
  const chartSeries: ExactMarketSeries[] = outcomes.map((outcome, index) => ({
    key: outcome.key,
    label: outcome.label,
    color: colors[index],
    current: Math.max(0, Math.min(1, Number(probabilities[outcome.key] ?? 1 / outcomes.length))),
    points: toExactSeries(market.outcome_history?.[outcome.key]),
  }));
  const league = market.live_event?.league ?? null;
  const closing = closeLabel(market.closes_at);
  // Basketball competitions get the arena card: a matchup row with both teams
  // and the tip-off in Kosovo time takes the place of the question text.
  const arena = Boolean(courtArtFor(league)) && outcomes.length === 2;
  const home = outcomes.find((outcome) => outcome.key === "home") ?? outcomes[0];
  const away = outcomes.find((outcome) => outcome.key === "away") ?? outcomes[1];
  const colorOf = (outcome?: Outcome) => chartSeries[outcomes.indexOf(outcome as Outcome)]?.color ?? "#888";
  const tipOff = market.live_event?.kickoff ?? market.closes_at;
  const trades = Number(market.trade_count ?? 0);
  const volume = Number(market.trade_volume ?? 0);

  return (
    <article
      className="tregu-glass tregu-market tregu-native-market tregu-edge"
      data-competition={league}
      data-native-sport-market
      data-outcomes={outcomes.length}
    >
      <CompetitionArtwork league={league} />
      <CompetitionArt league={league} />
      <div className="tregu-market-top">
        <span className="tregu-native-brand">
          <SportBrandMark brandKey={league} size="sm" />
          <span>{sportBrandFor(league)?.label ?? "Sport"}</span>
        </span>
        {closing && <span className="tregu-market-close">{closing}</span>}
      </div>

      {arena ? (
        <Link href={`/tregu/${market.slug}`} className="tregu-bb-matchup" aria-label={market.question}>
          <span className="tregu-bb-team">
            <Crest outcome={home} color={colorOf(home)} />
            <b>{home?.label}</b>
            <small>Vendas</small>
          </span>
          <span className="tregu-bb-tip">
            {tipOff ? (
              <>
                <small>{dayLabel(tipOff)}</small>
                <strong>{formatKosovoTime(tipOff)}</strong>
              </>
            ) : (
              <strong>VS</strong>
            )}
          </span>
          <span className="tregu-bb-team" data-away>
            <Crest outcome={away} color={colorOf(away)} />
            <b>{away?.label}</b>
            <small>Mysafir</small>
          </span>
        </Link>
      ) : (
        <Link href={`/tregu/${market.slug}`} className="tregu-native-title">
          {market.question}
        </Link>
      )}

      <ExactMarketChart
        compact
        minimal
        curve="smooth"
        height={132}
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
          {arena && (trades > 0 || volume > 0)
            ? `${fmtNum(trades)} tregtime · ${fmtNum(Math.round(volume))} 383C`
            : "Të dhëna live"}
        </span>
        <Link href={`/tregu/${market.slug}`} className="tregu-market-open">
          Hap tregun →
        </Link>
      </footer>
    </article>
  );
}
