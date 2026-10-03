"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtNum } from "@/lib/format";
import { milestone } from "@/lib/tregu-points.mjs";

/** The last milestone this browser celebrated, so each one bursts once. */
const MILESTONE_KEY = "tregu:goal-milestone";

/** The withdrawal threshold, and what it is worth. Mirrors the portfolio page. */
const THRESHOLD = 10_000;
const REWARD_EUR = 10;

/**
 * How close you are to turning Monedha into money.
 *
 * The floor's whole proposition ends at this number, and until now it was only
 * visible on the portfolio page — a page you reach by already knowing the
 * payoff exists. On the floor it is the answer to "why am I doing this", so it
 * sits under the flagship card where the eye lands after the headline market.
 *
 * Logged out it still shows, at zero, because the offer is most persuasive to
 * the person who has not taken it yet.
 *
 * Progress is net worth — the wallet plus what open trades would sell for now.
 * Counting the wallet alone dropped the bar to zero the moment someone put
 * their whole balance into trades, which read as having lost everything.
 * Withdrawing still needs the coins in the wallet, so "reached" stays a wallet
 * test and the split under the bar says where the rest is.
 */
export default function WithdrawalProgress({ balance, openValue = 0 }: { balance: number | null; openValue?: number }) {
  const coins = Math.max(0, Number(balance) || 0);
  const invested = Math.max(0, Number(openValue) || 0);
  const total = coins + invested;
  const pct = Math.min(100, (total / THRESHOLD) * 100);
  const remaining = Math.max(0, THRESHOLD - total);
  const reached = coins >= THRESHOLD;
  const reachedInTrades = !reached && total >= THRESHOLD;
  // The last step ("10€ janë të tuat") is a wallet test like the button: with
  // part of it still in trades, the road stops one short of it.
  const road = milestone(reached ? total : Math.min(total, THRESHOLD - 1));
  // A milestone crossed since this browser last saw the bar: one burst, once.
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const reachedAt = road.reached?.at ?? 0;
  useEffect(() => {
    if (balance == null) return;
    try {
      const stored = window.localStorage.getItem(MILESTONE_KEY);
      // No key yet = this browser's first look: note where the reader is
      // (0 included, so the first 1 000 still bursts), celebrate nothing.
      if (stored === null) {
        window.localStorage.setItem(MILESTONE_KEY, String(reachedAt));
        return;
      }
      if (reachedAt > Number(stored)) {
        window.localStorage.setItem(MILESTONE_KEY, String(reachedAt));
        setCelebrate(road.reached?.line ?? null);
      }
    } catch {
      /* storage unavailable: no celebration, nothing breaks */
    }
  }, [balance, reachedAt, road.reached?.line]);

  return (
    <section className="tregu-goal" aria-label="Përparimi drejt tërheqjes" data-celebrate={celebrate ? "" : undefined}>
      <div className="tregu-goal-head">
        <h3>
          {reached ? "Pragu u arrit" : `Drejt ${fmtNum(THRESHOLD)} Monedhave`}
          <span>
            {`${fmtNum(THRESHOLD)} Monedha = ${REWARD_EUR} euro`}
            {!reached && !reachedInTrades && ` · edhe ${fmtNum(remaining)} Monedha`}
            {reachedInTrades && " · mbyll tregtitë për ta tërhequr"}
          </span>
        </h3>
        <Link href="/tregu/portofoli" className="tregu-goal-link">
          {reached ? "Kërko tërheqjen →" : "Portofoli →"}
        </Link>
      </div>

      <div className="tregu-goal-track">
        {/* aria-hidden: the figures either side of the bar already state the
            same thing in words, and a second announcement of the same number
            is noise on a screen reader. */}
        <div
          className="tregu-goal-fill"
          /* Revealed by clip rather than sized by width — see .tregu-goal-fill.
             Floored at a sliver so a balance of zero still shows where the run
             starts instead of an empty groove. */
          style={{ clipPath: `inset(0 ${(100 - Math.max(pct, 1.4)).toFixed(2)}% 0 0 round 100px)` }}
          data-reached={reached || undefined}
          aria-hidden
        />
        {/* The prize, sitting at the end of the track where it is earned.
            A coin rather than a note: the same object the balance is counted
            in, struck once and stamped with what it converts to. */}
        <span className="tregu-goal-prize" data-reached={reached || undefined} aria-hidden>
          <i>{REWARD_EUR}€</i>
        </span>
      </div>

      <p className="tregu-goal-foot">
        <span>
          <strong>{fmtNum(Math.round(total))}</strong> nga {fmtNum(THRESHOLD)} Monedha
          {invested > 0 && (
            <em className="tregu-goal-split">
              {fmtNum(Math.round(coins))} në portofol · {fmtNum(Math.round(invested))} në tregje
            </em>
          )}
        </span>
        <span>{Math.floor(pct)}%</span>
      </p>
      {celebrate ? (
        <p className="tregu-goal-milestone" role="status">🎉 {celebrate}</p>
      ) : road.next && !reached ? (
        <p className="tregu-goal-next">
          Edhe <strong>{fmtNum(Math.round(road.toNext))}</strong> Monedha për {road.next.goal}
        </p>
      ) : null}
    </section>
  );
}
