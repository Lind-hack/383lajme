"use client";

import Link from "next/link";
import { fmtNum } from "@/lib/format";

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
 */
export default function WithdrawalProgress({ balance }: { balance: number | null }) {
  const coins = Math.max(0, Number(balance) || 0);
  const pct = Math.min(100, (coins / THRESHOLD) * 100);
  const remaining = Math.max(0, THRESHOLD - coins);
  const reached = coins >= THRESHOLD;

  return (
    <section className="tregu-goal" aria-label="Përparimi drejt tërheqjes">
      <div className="tregu-goal-head">
        <h3>
          {reached ? "Pragu u arrit" : `Drejt ${fmtNum(THRESHOLD)} Monedhave`}
          <span>
            {`${fmtNum(THRESHOLD)} Monedha = ${REWARD_EUR} euro`}
            {!reached && ` · edhe ${fmtNum(remaining)} Monedha`}
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
          <strong>{fmtNum(coins)}</strong> nga {fmtNum(THRESHOLD)} Monedha
        </span>
        <span>{Math.floor(pct)}%</span>
      </p>
    </section>
  );
}
