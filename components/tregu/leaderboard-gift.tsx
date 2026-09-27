"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CoinFace from "@/components/tregu/coin-face";
import { fmtNum } from "@/lib/format";
import { LEADERBOARD_KIND_LABEL, leaderboardPeriodLabel, type LeaderboardKind } from "@/lib/tregu-leaderboard";

type Gift = {
  id: string;
  period_kind: LeaderboardKind;
  period_start: string;
  period_end: string;
  place: number;
  profit: number;
  prize: number;
};

const PLACE_WORD: Record<number, string> = { 1: "i parë", 2: "i dytë", 3: "i tretë" };

/**
 * A leaderboard prize, delivered as a gift the winner opens.
 *
 * Prizes reach this component only after the admin has confirmed them
 * (migration 0083 keeps pending rows invisible), so every gift shown here is
 * real and collectable. It asks once per floor visit: "Më vonë" closes it and
 * the same gift is waiting next time, because nothing is claimed until the
 * winner presses collect.
 *
 * A modal is the right container here and nowhere else on the floor: it is a
 * one-off reward moment that needs the winner's attention, and the collect
 * action moves coins.
 */
export default function LeaderboardGift({ loggedIn }: { loggedIn: boolean }) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [stage, setStage] = useState<"sealed" | "open">("sealed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetch("/api/tregu/rewards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !Array.isArray(d?.rewards)) return;
        setGifts(d.rewards as Gift[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  const gift = hidden ? null : gifts[0] ?? null;

  const close = useCallback(() => {
    setHidden(true);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!gift) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      // Keep Tab inside the dialog: it is modal, the page behind is inert.
      if (event.key === "Tab" && dialog.current) {
        const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!dialog.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [gift, busy, close]);

  useEffect(() => {
    primary.current?.focus();
  }, [stage]);

  if (!gift) return null;

  const periodLabel = leaderboardPeriodLabel(gift.period_kind, gift.period_start, gift.period_end);
  const period = `${LEADERBOARD_KIND_LABEL[gift.period_kind] ?? "Java"} · ${periodLabel}`;
  const periodPhrase = gift.period_kind === "monthly" ? `në muajin ${periodLabel}` : `në javën ${periodLabel}`;
  const prize = Number(gift.prize) || 0;

  const collect = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tregu/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gift.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Mbledhja dështoi. Provo përsëri.");
      if (typeof data.balance === "number") {
        window.dispatchEvent(new CustomEvent("tregu:balance", { detail: data.balance }));
      }
      window.dispatchEvent(new CustomEvent("383:coins-earned", { detail: prize }));
      setGifts((current) => current.filter((item) => item.id !== gift.id));
      setStage("sealed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mbledhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tregu-gift-scrim" onClick={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <div
        ref={dialog}
        className="tregu-gift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tregu-gift-title"
        aria-describedby="tregu-gift-desc"
        data-stage={stage}
        data-place={gift.place}
      >
        <div className="tregu-gift-stage" aria-hidden>
          <span className="tregu-gift-rays" />
          <span className="tregu-gift-coin">
            <CoinFace size={112} numeral={fmtNum(prize)} spinning={stage === "open"} shine />
          </span>
          <svg className="tregu-gift-box" viewBox="0 0 160 150" role="presentation">
            <g className="tregu-gift-lid">
              <path d="M62 30c-14-18-34-14-32-2 2 10 22 12 40 12M98 30c14-18 34-14 32-2-2 10-22 12-40 12" fill="none" stroke="#FF4422" strokeWidth="8" strokeLinecap="round" />
              <rect x="14" y="36" width="132" height="30" rx="7" fill="#1A1714" />
              <rect x="14" y="36" width="132" height="8" rx="4" fill="#fff" opacity=".08" />
              <rect x="70" y="36" width="20" height="30" fill="#FF4422" />
            </g>
            <rect x="22" y="66" width="116" height="78" rx="6" fill="#231F1B" />
            <rect x="22" y="66" width="116" height="12" fill="#000" opacity=".28" />
            <rect x="70" y="66" width="20" height="78" fill="#E63A1A" />
          </svg>
        </div>

        {stage === "sealed" ? (
          <>
            <h2 id="tregu-gift-title">Ke një dhuratë nga renditja</h2>
            <p id="tregu-gift-desc">
              Përfundove <b>{PLACE_WORD[gift.place] ?? `#${gift.place}`}</b> {periodPhrase}.
            </p>
            <div className="tregu-gift-actions">
              <button ref={primary} type="button" className="tregu-gift-primary" onClick={() => setStage("open")}>
                Hape dhuratën
              </button>
              <button type="button" className="tregu-gift-later" onClick={close}>
                Më vonë
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="tregu-gift-title">
              <span className="tregu-gift-amount">+{fmtNum(prize)}</span> Monedha
            </h2>
            <p id="tregu-gift-desc">
              Vendi #{gift.place} · {period} · fitim +{fmtNum(Math.round(Number(gift.profit) || 0))}
            </p>
            {error && <p className="tregu-gift-error" role="alert">{error}</p>}
            <div className="tregu-gift-actions">
              <button ref={primary} type="button" className="tregu-gift-primary" onClick={() => void collect()} disabled={busy}>
                {busy ? "Duke i mbledhur…" : "Mblidhi në bilanc"}
              </button>
            </div>
            {gifts.length > 1 && (
              <p className="tregu-gift-more">
                {gifts.length === 2 ? "Të pret edhe një dhuratë tjetër." : `Të presin edhe ${gifts.length - 1} dhurata të tjera.`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
