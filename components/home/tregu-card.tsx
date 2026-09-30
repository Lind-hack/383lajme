"use client";

// The Tregu feature card — an actual working trading card, not a picture of one.
//
// A reader can pick a side, move the stake, and watch the shares and payout
// recompute against the real LMSR book before deciding whether any of this is
// for them. That is the whole argument for the feature: the mechanism is
// legible in ten seconds, and nothing has been risked to see it.
//
// The maths is `previewBet` from lib/tregu-client — the same function the trade
// panel on /tregu/[slug] uses. A homepage card that estimated payouts with its
// own simplified formula would eventually disagree with the real one, and the
// first time a reader noticed, the number would be worthless.
//
// Placing the bet still requires an account. Inspecting one never does.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CoinFace from "@/components/tregu/coin-face";
import { lmsrPriceYes, previewBet, type Market } from "@/lib/tregu-client";
import InlineError, { RetryButton } from "@/components/ui/inline-error";
import { SectionSkeleton } from "@/components/ui/skeleton";

type State = "loading" | "ready" | "empty" | "failed";

const STAKES = [10, 50, 100, 250];

function closesIn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `mbyllet për ${hours}h`;
  return `mbyllet për ${Math.round(hours / 24)}d`;
}

export default function TreguCard() {
  const [state, setState] = useState<State>("loading");
  const [market, setMarket] = useState<Market | null>(null);
  const [side, setSide] = useState<"PO" | "JO">("PO");
  const [stake, setStake] = useState(50);

  async function load() {
    setState("loading");
    try {
      const response = await fetch("/api/tregu/markets", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();

      // Binary markets only: a three-outcome football book needs three buttons
      // and a different explanation, which is more than this card can carry.
      const open: Market[] = (data.markets ?? []).filter(
        (m: Market) =>
          m.status === "open" &&
          (!m.market_type || m.market_type === "binary") &&
          typeof m.b === "number"
      );
      if (open.length === 0) {
        setState("empty");
        return;
      }
      setMarket(open[0]);
      setState("ready");
    } catch {
      setState("failed");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const preview = useMemo(() => {
    if (!market) return null;
    const priceYes = lmsrPriceYes(market.q_yes, market.q_no, market.b);
    const price = side === "PO" ? priceYes : 1 - priceYes;
    try {
      const { shares } = previewBet(market, side, stake);
      return { price, shares, payout: shares };
    } catch {
      return { price, shares: 0, payout: 0 };
    }
  }, [market, side, stake]);

  return (
    <article className="home-feature home-feature--dark">
      {/* Same anatomy as the other two: identity on one row, blurb, contained
          panel, action. The 383 coin takes the icon slot because it is the unit
          every price on this card is denominated in. */}
      <header className="home-feature-head">
        <span className="home-tregu-coin" aria-hidden="true">
          <CoinFace size={40} numeral="383" spinning />
        </span>
        <h3>Tregu</h3>
      </header>

      <p className="home-feature-blurb">
        Parashiko zhvillimet. Shiko çfarë beson komuniteti, me monedha 383 — pa
        para reale.
      </p>

      <div className="home-feature-panel home-feature-panel--tregu">
      {state === "loading" && <SectionSkeleton rows={2} height={52} />}

      {state === "failed" && (
        <InlineError
          title="Tregjet nuk u ngarkuan."
          detail="Nuk arritëm t'i marrim pyetjet aktive."
          action={<RetryButton onClick={load} label="Provo përsëri" />}
        />
      )}

      {state === "empty" && (
        <div className="home-tregu-empty">
          <p>Nuk ka pyetje aktive për momentin.</p>
          <span>Pyetjet e reja hapen kur ka një zhvillim për të parashikuar.</span>
        </div>
      )}

      {state === "ready" && market && preview && (
        <div className="home-tregu-live">
          <p className="home-tregu-q">{market.question}</p>

          <div className="home-tregu-sides" role="group" aria-label="Zgjidh anën">
            {(["PO", "JO"] as const).map((s) => {
              const p =
                s === "PO"
                  ? lmsrPriceYes(market.q_yes, market.q_no, market.b)
                  : 1 - lmsrPriceYes(market.q_yes, market.q_no, market.b);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                  className="home-tregu-side"
                  data-side={s.toLowerCase()}
                  data-active={side === s ? "true" : undefined}
                >
                  <b>{s}</b>
                  <em>{Math.round(p * 100)}%</em>
                </button>
              );
            })}
          </div>

          <div className="home-tregu-stake">
            <span className="home-tregu-stake-label">Provo me</span>
            {STAKES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStake(value)}
                aria-pressed={stake === value}
                className="home-tregu-chip"
                data-active={stake === value ? "true" : undefined}
              >
                {value}
              </button>
            ))}
          </div>

          <p className="home-tregu-payout">
            {stake} monedha → <b>{preview.payout.toFixed(0)}</b> nëse del{" "}
            <b>{side}</b>
            <span>{closesIn(market.closes_at) ?? "pa afat të caktuar"}</span>
          </p>
        </div>
      )}
      </div>

      <p className="home-feature-meta">
        Çmimi lëviz nga tregtimet reale dhe nga provat e lajmeve
      </p>

      <Link
        href={market ? `/tregu/${market.slug}` : "/tregu"}
        className="home-feature-cta"
      >
        {state === "ready" ? "Hap pyetjen" : "Shiko Tregun"}{" "}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
