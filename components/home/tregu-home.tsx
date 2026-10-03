"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import WithdrawalProgress from "@/components/tregu/withdrawal-progress";
import { createClient } from "@/lib/supabase/client";
import SectionLabel from "@/components/section-label";
import SpotlightTour, { openTour, type TourStep } from "@/components/spotlight-tour";
import MarketMiniCard, { type MiniMarket } from "@/components/tregu/market-mini-card";
import StructuredSportMarketCard, { type StructuredSportMarket } from "@/components/tregu/structured-sport-market-card";
import { isStructuredSportMarket, marketVolume } from "@/lib/tregu-hub-market.mjs";
import { kosovoDateKey, pickDailyMarkets } from "@/lib/home-tregu.mjs";
import { tradingClosesAt } from "@/lib/trading-close.mjs";

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
  live_event?: { league?: string; event_kind?: string; kickoff?: string; race_start?: string } | null;
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
    closesAt: tradingClosesAt(row) ?? row.closes_at,
    startsAt: row.live_event?.kickoff ?? row.live_event?.race_start ?? null,
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

/** The same id the homepage strip always used, so a reader who has seen it is not shown it again. */
const TOUR_ID = "tregu-home";
const CARD = "[data-tour='tregu-card']";

/**
 * The walkthrough over the first card, built for the card that is actually
 * there: a competition card has several outcomes and a live chart to show; the
 * standard card has PO and JO.
 */
function tourSteps(structured: boolean): TourStep[] {
  const outcomes = structured ? `${CARD} .tregu-native-outcomes` : `${CARD} .tregu-sides`;
  const choice = structured ? ".tregu-native-outcome" : ".tregu-side";
  const steps: TourStep[] = [
    {
      target: CARD,
      title: "Një pyetje për ditën",
      body: "Çdo kartë është një pyetje për një ndeshje ose një lajm të ditës. Ti thua si mendon se do të përfundojë.",
      padding: 12,
      radius: 20,
      zoom: 1.03,
      cursor: { loop: true, beats: [{ at: `${CARD} .tregu-market-top`, hold: 900 }, { at: outcomes, hold: 700 }] },
    },
  ];
  if (structured) {
    steps.push({
      target: `${CARD} .tregu-exact-chart`,
      title: "Mendimet ndryshojnë live",
      body: "Vijat tregojnë si ndryshon mendimi i njerëzve sa herë dikush zgjedh. Kalo mbi grafik për të parë çdo moment.",
      padding: 8,
      radius: 14,
      zoom: 1.05,
      cursor: {
        loop: true,
        beats: [{
          drag: {
            from: { sel: `${CARD} .tregu-exact-chart`, fx: 0.15, fy: 0.45 },
            to: { sel: `${CARD} .tregu-exact-chart`, fx: 0.88, fy: 0.45 },
            ms: 1600,
          },
        }],
      },
    });
  }
  steps.push(
    {
      target: outcomes,
      title: "Zgjidh anën tënde",
      body: "Përqindja tregon çfarë mendojnë të tjerët. Nëse zgjedh atë që pakkush e pret dhe ke të drejtë, fiton më shumë.",
      padding: 8,
      radius: 14,
      zoom: 1.06,
      cursor: {
        loop: true,
        beats: [
          { click: `${outcomes} > ${choice}:nth-child(1)`, hold: 760 },
          { click: `${outcomes} > ${choice}:nth-child(2)`, hold: 760 },
        ],
      },
    },
    {
      target: `${CARD} .tregu-market-open`,
      title: "Monedhat bëhen para",
      body: "Luan me 383 Monedha falas, pa asnjë rrezik. 10 000 Monedha i këmben për 10€ të vërteta te Portofoli.",
      padding: 8,
      radius: 12,
      zoom: 1.06,
      cursor: { loop: true, beats: [{ click: `${CARD} .tregu-market-open`, hold: 1100 }] },
    }
  );
  return steps;
}

/**
 * Tregu on the homepage, in Tregu's own cards: two of them, a new pair every
 * day, with the walkthrough that explains them. It opens itself the first time
 * the cards scroll into view (once per reader, across the whole site) and
 * replays from "Si funksionon".
 *
 * A competition Tregu has its own design for — Champions, Europa, Conference
 * and Nations League, F1, NBA, the Kosovo basketball league — leads whenever
 * one is open, in that competition's card with its live chart. Anything else
 * only fills an empty slot, in the floor's standard card.
 */
export default function TreguHome() {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Signed in: the wallet for the 10€ bar. Signed out (null): the bar at 0,
  // and a tap on a side goes through sign-up to that pick.
  const [balance, setBalance] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [guestPick, setGuestPick] = useState<{ label: string; href: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      setSignedIn(Boolean(user));
      if (!user) return;
      const { data } = await supabase.from("profiles").select("coins").eq("id", user.id).single();
      if (typeof data?.coins === "number") setBalance(Number(data.coins));
    });
  }, []);

  // Signed out, a tap on Po/Jo (or a team) would land on a login wall. Ask
  // for the sign-up here instead, and come back to that pick already chosen.
  // Nothing is placed: the reader still sets the stake and confirms.
  const interceptGuest = (event: MouseEvent<HTMLDivElement>) => {
    if (signedIn !== false || !markets) return;
    const target = event.target as HTMLElement;
    const side = target.closest<HTMLElement>(".tregu-side");
    const outcome = target.closest<HTMLAnchorElement>("a.tregu-native-outcome");
    if (!side && !outcome) return;
    const card = target.closest<HTMLElement>(".home-tregu-card");
    const index = card ? [...(card.parentElement?.children ?? [])].indexOf(card) : -1;
    const market = markets[index];
    if (!market) return;
    event.preventDefault();
    event.stopPropagation();
    if (outcome) {
      const url = new URL(outcome.href, window.location.origin);
      setGuestPick({ label: outcome.querySelector("em")?.textContent ?? "kjo zgjedhje", href: `${url.pathname}${url.search}` });
    } else {
      const name = side?.querySelector(".tregu-side-name")?.textContent?.trim().toUpperCase() === "JO" ? "jo" : "po";
      setGuestPick({ label: name === "po" ? "Po" : "Jo", href: `/tregu/${market.slug}?ana=${name}` });
    }
  };

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

  const steps = useMemo(
    () => (markets?.length ? tourSteps(isStructuredSportMarket(markets[0])) : null),
    [markets]
  );

  // A band with nothing to trade says nothing at all rather than an error.
  if (failed || (markets && markets.length === 0)) return null;

  return (
    <section className="home-tregu" aria-labelledby="home-tregu-title">
      <SectionLabel
        label={<span id="home-tregu-title">Tregu · Parashiko</span>}
        marginBottom={10}
        right={
          <span className="tregu-home-head-actions">
            <button
              type="button"
              className="tregu-home-help"
              aria-label="Si funksionon Tregu"
              onClick={() => openTour(TOUR_ID)}
              disabled={!steps}
            >
              <span aria-hidden>?</span>
              <em className="tregu-home-help-label">Si funksionon</em>
            </button>
            <Link href="/tregu" className="section-more">
              Hap Tregun<span aria-hidden> →</span>
            </Link>
          </span>
        }
      />
      {/* One sentence and three steps: enough to get the idea at a glance. */}
      <p className="tregu-home-intro">
        Parashiko si përfundon ndeshja ose lajmi i ditës. Luan me <strong>383 Monedha</strong> falas, dhe{" "}
        <strong>10 000 Monedha i këmben për 10€ të vërteta</strong>.
      </p>
      <ol className="tregu-home-steps">
        <li>Zgjidh pyetjen</li>
        <li>Lexo gjasat</li>
        <li>Vër parashikimin</li>
      </ol>
      <div className="tregu-scope home-tregu-scope">
        <div className="tregu-grid home-tregu-grid" aria-busy={markets === null} onClickCapture={interceptGuest}>
          {markets === null
            ? Array.from({ length: 2 }, (_, i) => <div key={i} className="tregu-glass home-tregu-skeleton" aria-hidden />)
            : markets.map((row, index) => (
                // The first card carries the walkthrough's anchor.
                <div key={row.slug} className="home-tregu-card" data-tour={index === 0 ? "tregu-card" : undefined}>
                  {isStructuredSportMarket(row) ? (
                    <StructuredSportMarketCard market={row as StructuredSportMarket} still />
                  ) : (
                    <MarketMiniCard market={toMini(row)} still />
                  )}
                </div>
              ))}
        </div>
      </div>

      {/* The road to 10€, the same bar as on the Tregu floor. */}
      <div className="tregu-scope home-tregu-goal">
        <WithdrawalProgress balance={balance} />
      </div>

      {/* On <body>: a parent here confines position: fixed, and the sheet
          must sit where the thumb tapped, above the tab bar. */}
      {guestPick && createPortal(
        <div className="home-guest-pick" role="dialog" aria-modal="false" aria-labelledby="home-guest-title">
          <p id="home-guest-title">
            Parashikimi yt: <strong>{guestPick.label}</strong>
          </p>
          <p>Regjistrohu dhe merr <strong>100 Monedha falas</strong> për ta vënë. Të kthejmë te kjo zgjedhje.</p>
          <div>
            <Link className="home-guest-go" href={`/hyr?tab=regjistrohu&next=${encodeURIComponent(guestPick.href)}`}>
              Regjistrohu · 100 Monedha falas
            </Link>
            <button type="button" className="home-guest-later" onClick={() => setGuestPick(null)}>Më vonë</button>
          </div>
        </div>,
        document.body
      )}

      {steps && (
        <SpotlightTour tourId={TOUR_ID} anchor={CARD} steps={steps} eyebrow="Si funksionon Tregu" />
      )}
    </section>
  );
}
