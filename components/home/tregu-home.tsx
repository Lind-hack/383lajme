"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SectionLabel from "@/components/section-label";
import MarketMiniCard, { type MiniMarket } from "@/components/tregu/market-mini-card";
import StructuredSportMarketCard, { type StructuredSportMarket } from "@/components/tregu/structured-sport-market-card";
import { isStructuredSportMarket, marketVolume } from "@/lib/tregu-hub-market.mjs";
import { kosovoDateKey, pickDailyMarkets } from "@/lib/home-tregu.mjs";

/** The subset of /api/tregu/markets rows this band reads. */
interface MarketRow {
  slug: string;
  question: string;
  category: string;
  status: string;
  market_prob: number;
  market_type?: string;
  closes_at: string;
  q_yes: number;
  q_no: number;
  spark?: number[];
  delta7d?: number | null;
  trade_count?: number;
  trade_volume?: number;
  history?: { created_at: string; probability: number }[];
  last_data_at?: string;
  live_event?: { league?: string; event_kind?: string } | null;
  sport_outcomes?: MiniMarket["sportOutcomes"];
  outcome_probabilities?: Record<string, number> | null;
  outcome_history?: MiniMarket["outcomeHistory"];
  market_media?: MiniMarket["marketMedia"];
}

/** The same fields /tregu hands its own cards, so a card reads identically in both places. */
function toMini(row: MarketRow): MiniMarket {
  return {
    slug: row.slug,
    question: row.question,
    category: row.category,
    status: row.status,
    prob: row.market_prob,
    volume: marketVolume(row),
    closesAt: row.closes_at,
    spark: row.spark,
    delta7d: row.delta7d,
    history: row.history,
    tradeCount: row.trade_count,
    lastDataAt: row.last_data_at,
    marketType: row.market_type,
    league: row.live_event?.league ?? null,
    eventKind: row.live_event?.event_kind ?? null,
    sportOutcomes: row.sport_outcomes,
    outcomeProbabilities: row.outcome_probabilities,
    outcomeHistory: row.outcome_history,
    marketMedia: row.market_media,
  };
}

/**
 * Tregu on the homepage, in Tregu's own cards: two of them, a new pair every
 * day.
 *
 * A competition Tregu has its own design for — Champions, Europa, Conference
 * and Nations League, F1, NBA, the Kosovo basketball league — leads whenever
 * one is open, in that competition's card with its live chart. Anything else
 * only fills an empty slot, in the floor's standard card.
 */
export default function TreguHome() {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tregu/markets", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`markets ${response.status}`);
        return response.json();
      })
      .then((data: { markets?: MarketRow[] }) => {
        setMarkets(pickDailyMarkets(data?.markets ?? [], { dateKey: kosovoDateKey(), count: 2 }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  // A band with nothing to trade says nothing at all rather than an error.
  if (failed || (markets && markets.length === 0)) return null;

  return (
    <section className="home-tregu" aria-labelledby="home-tregu-title">
      <SectionLabel
        label={<span id="home-tregu-title">Tregu · Parashiko</span>}
        marginBottom={10}
        right={
          <Link href="/tregu" className="section-more">
            Hap Tregun<span aria-hidden> →</span>
          </Link>
        }
      />
      <p className="home-tregu-lede">
        Parashiko si përfundojnë ndeshjet dhe lajmet e ditës me 383 Monedha, falas. Dy tregje të reja çdo ditë.
      </p>
      <div className="tregu-scope home-tregu-scope">
        <div className="tregu-grid home-tregu-grid" aria-busy={markets === null}>
          {markets === null
            ? Array.from({ length: 2 }, (_, i) => <div key={i} className="tregu-glass home-tregu-skeleton" aria-hidden />)
            : markets.map((row) =>
                isStructuredSportMarket(row) ? (
                  <StructuredSportMarketCard key={row.slug} market={row as StructuredSportMarket} />
                ) : (
                  <MarketMiniCard key={row.slug} market={toMini(row)} />
                )
              )}
        </div>
      </div>
    </section>
  );
}
