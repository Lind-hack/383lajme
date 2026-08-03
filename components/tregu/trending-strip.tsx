"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionLabel from "@/components/section-label";
import SpotlightTour, { openTour, type TourStep } from "@/components/spotlight-tour";
import GroupChart, { type EventSeries } from "./group-chart";

const TOUR_ID = "tregu-home";

/**
 * Module-level so the tour's effects keep a stable dependency. Each step pushes
 * in on its target and lets the ghost cursor act the interaction out, so the
 * band reads as a demo rather than four captions.
 */
const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='tregu-card']",
    title: "Çdo kartë është një pyetje",
    body: "Tregu i kthen lajmet e ditës në pyetje me dy përgjigje: PO ose JO. Kjo është njëra nga dy pyetjet më aktive tani.",
    padding: 12,
    radius: 20,
    zoom: 1.03,
    cursor: {
      loop: true,
      beats: [
        { at: ".tregu-home-title", hold: 900 },
        { at: "[data-tour='tregu-outcomes']", hold: 700 },
      ],
    },
  },
  {
    target: "[data-tour='tregu-chart']",
    title: "Grafiku tregon gjasat live",
    body: "Vija ndjek shansin që përgjigjja të dalë PO. Ngjitet kur lajmi forcohet, bie kur dobësohet — përditësohet çdo pak sekonda.",
    padding: 8,
    radius: 14,
    zoom: 1.06,
    cursor: {
      loop: true,
      beats: [
        { at: { sel: "[data-tour='tregu-chart']", fx: 0.08, fy: 0.6 }, hold: 420 },
        {
          drag: {
            from: { sel: "[data-tour='tregu-chart']", fx: 0.08, fy: 0.6 },
            to: { sel: "[data-tour='tregu-chart']", fx: 0.92, fy: 0.35 },
            ms: 1500,
          },
        },
      ],
    },
  },
  {
    target: "[data-tour='tregu-outcomes']",
    title: "Zgjidh anën tënde",
    body: "Përqindja është gjasa e tanishme. Numri me shenjën × tregon sa herë shumëzohen monedhat e tua nëse del drejt.",
    padding: 8,
    radius: 14,
    zoom: 1.08,
    cursor: {
      loop: true,
      beats: [
        { click: "[data-tour='tregu-outcomes'] > *:nth-child(1)", hold: 760 },
        { click: "[data-tour='tregu-outcomes'] > *:nth-child(2)", hold: 760 },
      ],
    },
  },
  {
    target: "[data-tour='tregu-cta']",
    title: "Vë 383 Coin, jo para",
    body: "Hap tregun, shkruaj sa Coin do të vësh dhe konfirmo. 383 Coin është monedha falas e faqes — asnjë para reale nuk hyn në lojë.",
    padding: 8,
    radius: 12,
    zoom: 1.1,
    cursor: {
      loop: true,
      beats: [{ click: "[data-tour='tregu-cta']", hold: 1100 }],
    },
  },
];

interface HistoryPoint {
  created_at: string;
  probability: number;
}

interface MarketOutcome {
  key: string;
  label: string;
  team?: string;
  color?: string;
}

interface MarketRow {
  slug: string;
  question: string;
  category: string;
  market_prob: number;
  market_type?: string;
  market_classification?: string;
  closes_at: string;
  q_yes: number;
  q_no: number;
  trade_count?: number;
  history?: HistoryPoint[];
  spark?: number[];
  sport_outcomes?: MarketOutcome[] | null;
  outcome_probabilities?: Record<string, number> | null;
  outcome_history?: Record<string, HistoryPoint[]> | null;
}

interface PreviewOutcome {
  key: string;
  label: string;
  color: string;
  probability: number;
  series: { t: number; p: number }[];
}

interface PreviewMarket {
  slug: string;
  question: string;
  category: string;
  closesAt: string;
  tradeCount: number;
  outcomes: PreviewOutcome[];
}

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

const FOOTBALL_COLORS = ["#C92F2F", "#7A7A78", "#2E70C9"];
const BINARY_COLORS = ["#00854A", "#C92F2F"];
const REFRESH_MS = 12_000;

function toSeries(points: HistoryPoint[] | undefined): { t: number; p: number }[] {
  return (points ?? [])
    .map((point) => ({
      t: new Date(point.created_at).getTime(),
      p: Number(point.probability),
    }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
    .sort((a, b) => a.t - b.t);
}

function sparkSeries(points: number[] | undefined, fallback: number): { t: number; p: number }[] {
  const values = points && points.length > 1 ? points : [fallback];
  const now = Date.now();
  const span = 24 * 60 * 60 * 1000;
  return values.map((p, index) => ({
    t: values.length === 1 ? now - span : now - span + (span * index) / (values.length - 1),
    p,
  }));
}

function outcomeColor(outcome: MarketOutcome, index: number): string {
  const draw = outcome.key.toLowerCase() === "draw" || /baraz|draw/i.test(outcome.label);
  if (draw) return "#7A7A78";
  return outcome.color ?? FOOTBALL_COLORS[index % FOOTBALL_COLORS.length];
}

function toPreviewMarket(market: MarketRow): PreviewMarket | null {
  if (market.market_type === "f1_race_winner") return null;

  const configured = market.sport_outcomes ?? [];
  const structured =
    configured.length >= 2 &&
    configured.length <= 3 &&
    market.outcome_probabilities &&
    typeof market.outcome_probabilities === "object";

  if (structured) {
    return {
      slug: market.slug,
      question: market.question,
      category: market.category,
      closesAt: market.closes_at,
      tradeCount: Number(market.trade_count ?? 0),
      outcomes: configured.map((outcome, index) => {
        const probability = Number(
          market.outcome_probabilities?.[outcome.key] ?? 1 / configured.length
        );
        const exact = toSeries(market.outcome_history?.[outcome.key]);
        return {
          key: outcome.key,
          label: outcome.label,
          color: outcomeColor(outcome, index),
          probability,
          series: exact.length > 0
            ? exact
            : [{ t: Date.now() - 86_400_000, p: probability }],
        };
      }),
    };
  }

  const yes = Math.max(0.01, Math.min(0.99, Number(market.market_prob)));
  const exactYes = toSeries(market.history);
  const yesSeries = exactYes.length > 0
    ? exactYes
    : sparkSeries(market.spark, yes);

  return {
    slug: market.slug,
    question: market.question,
    category: market.category,
    closesAt: market.closes_at,
    tradeCount: Number(market.trade_count ?? 0),
    outcomes: [
      {
        key: "po",
        label: "PO",
        color: BINARY_COLORS[0],
        probability: yes,
        series: yesSeries,
      },
      {
        key: "jo",
        label: "JO",
        color: BINARY_COLORS[1],
        probability: 1 - yes,
        series: yesSeries.map((point) => ({ t: point.t, p: 1 - point.p })),
      },
    ],
  };
}

function closeLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `Mbyllet për ${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `Mbyllet për ${hours}h`;
  return `Mbyllet për ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

function MarketPreviewCard({ market, index }: { market: PreviewMarket; index: number }) {
  const binaryYes = market.outcomes.find((outcome) => outcome.key === "po");
  const binaryNo = market.outcomes.find((outcome) => outcome.key === "jo");
  const isBinary = Boolean(binaryYes && binaryNo);
  const chartSeries: EventSeries[] = binaryYes && binaryNo
    ? [{
        label: "Mundësia",
        color: "#FF4422",
        prob: binaryYes.probability,
        series: binaryYes.series,
      }]
    : market.outcomes.map((outcome) => ({
        label: outcome.label,
        color: outcome.color,
        prob: outcome.probability,
        series: outcome.series,
      }));

  return (
    <article
      className="tregu-home-card tregu-glass"
      data-home-market-preview
      data-tour={index === 0 ? "tregu-card" : undefined}
      data-outcome-count={market.outcomes.length}
      data-chart-line-count={chartSeries.length}
      style={{ ["--preview-index" as string]: index }}
    >
      <header className="tregu-home-card-head">
        <div className="tregu-home-card-meta">
          <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
          <span className="tregu-home-live">
            <span aria-hidden />
            Grafik live
          </span>
        </div>
        <span className="tregu-home-close">{closeLabel(market.closesAt)}</span>
      </header>

      <Link href={`/tregu/${market.slug}`} className="tregu-home-title">
        {market.question}
      </Link>

      <div className="tregu-home-chart" data-tour={index === 0 ? "tregu-chart" : undefined}>
        <GroupChart
          height={220}
          cadenceMs={REFRESH_MS}
          compactControls
          normalize={!isBinary}
          series={chartSeries}
        />
      </div>

      <div
        className="tregu-home-outcomes"
        data-tour={index === 0 ? "tregu-outcomes" : undefined}
        style={{ gridTemplateColumns: `repeat(${market.outcomes.length}, minmax(0, 1fr))` }}
        aria-label="Rezultatet e tregut"
      >
        {market.outcomes.map((outcome) => {
          const pct = Math.max(0.1, outcome.probability * 100);
          const payout = outcome.probability > 0 ? 1 / outcome.probability : 0;
          return (
            <Link
              key={outcome.key}
              href={`/tregu/${market.slug}`}
              className="tregu-home-outcome"
              style={{ ["--outcome-color" as string]: outcome.color }}
              aria-label={`Hap tregun për ${outcome.label}, ${pct.toFixed(1)} për qind`}
            >
              <span className="tregu-home-outcome-name">{outcome.label}</span>
              <strong>{pct.toFixed(1)}%</strong>
              <span>×{payout.toFixed(2)}</span>
            </Link>
          );
        })}
      </div>

      <footer className="tregu-home-card-foot">
        <span>{market.tradeCount} ndryshime reale në linjë</span>
        <Link href={`/tregu/${market.slug}`} data-tour={index === 0 ? "tregu-cta" : undefined}>
          Hap tregun <span aria-hidden>→</span>
        </Link>
      </footer>
    </article>
  );
}

function LoadingCards() {
  return (
    <div className="tregu-home-grid" aria-label="Tregjet po ngarkohen">
      {[0, 1].map((index) => (
        <div key={index} className="tregu-home-card tregu-home-card--loading" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export default function TrendingStrip() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/tregu/markets", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Market feed unavailable");
        const data = await response.json();
        if (!active) return;
        setMarkets(data.markets ?? []);
        setFailed(false);
        setLoaded(true);
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setFailed(true);
        setLoaded(true);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const previews = useMemo(
    () =>
      markets
        .map(toPreviewMarket)
        .filter((market): market is PreviewMarket => market !== null)
        .sort((a, b) => b.tradeCount - a.tradeCount)
        .slice(0, 2),
    [markets]
  );

  return (
    <section className="tregu-scope tregu-home-preview" aria-labelledby="tregu-home-heading">
      <SectionLabel
        label="Tregu - Parashiko"
        marginBottom={14}
        right={
          <span className="tregu-home-head-actions">
            <button
              type="button"
              className="tregu-home-help"
              aria-label="Si funksionon Tregu"
              onClick={() => openTour(TOUR_ID)}
            >
              <span aria-hidden>?</span>
              {/* Collapses to the bare disc on phones, where the row also
                  carries "Shiko të gjitha" and both labels will not fit. */}
              <em className="tregu-home-help-label">Si funksionon</em>
            </button>
            <Link href="/tregu" className="tregu-home-all">
              Shiko të gjitha <span aria-hidden>→</span>
            </Link>
          </span>
        }
      />
      <span id="tregu-home-heading" className="sr-only">Dy tregjet më aktive</span>

      {/* One sentence and three steps — enough to get the feature at a glance. */}
      <p className="tregu-home-intro">
        Parashiko si përfundon lajmi. Zgjidh <strong>PO</strong> ose <strong>JO</strong> dhe vër{" "}
        <strong>383 Coin</strong> — monedha falas e faqes, jo para reale.
      </p>
      <ol className="tregu-home-steps">
        <li>Zgjidh pyetjen</li>
        <li>Lexo gjasat</li>
        <li>Vër PO ose JO</li>
      </ol>

      {!loaded ? (
        <LoadingCards />
      ) : previews.length > 0 ? (
        <div className="tregu-home-grid">
          {previews.map((market, index) => (
            <MarketPreviewCard key={market.slug} market={market} index={index} />
          ))}
        </div>
      ) : (
        <div className="tregu-home-empty" role="status">
          <strong>{failed ? "Tregjet nuk u ngarkuan." : "Ende nuk ka tregje aktive."}</strong>
          <Link href="/tregu">Hap Tregun</Link>
        </div>
      )}

      {/* First scroll onto the cards explains them; afterwards it's on demand. */}
      <SpotlightTour
        tourId={TOUR_ID}
        anchor="[data-tour='tregu-card']"
        steps={TOUR_STEPS}
        eyebrow="Si funksionon Tregu"
      />
    </section>
  );
}
