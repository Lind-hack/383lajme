"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import CoinFace from "@/components/tregu/coin-face";
import { treguHeroBehindChrome } from "@/components/tregu/video-hero";
import { fmtNum } from "@/lib/format";

// Mobile-only account bar for the Tregu floor. The collapsed mobile navbar is
// just a hamburger, so the coin balance chip (NavBalance) never shows there.
// This bar pins under the navbar once the floor scrolls into view and carries
// the balance, the flowing-coin earn animation, the daily bonus and a jump to
// the portfolio. Visibility is gated in CSS (.tregu-mbar) — desktop keeps the
// chip in the navbar instead.
export default function MobileAccountBar({
  balance,
  claiming,
  bonusMsg,
  coinSpin,
  flyCoins,
  onClaim,
}: {
  balance: number;
  claiming: boolean;
  bonusMsg: string | null;
  coinSpin: boolean;
  flyCoins: number[];
  onClaim: () => void;
}) {
  // Mirror the navbar: over the hero the bar wears dark glass that melts into
  // the image; once the hero scrolls past it crossfades to the cream
  // "surfaced" look in lockstep with the navbar. The threshold is the hero's
  // real bottom (treguHeroBehindChrome), not a fixed 80px — a bright cream bar
  // cutting across the video mid-hero read as a glitch.
  const pathname = usePathname();
  const [overlay, setOverlay] = useState(true);
  useEffect(() => {
    const onScroll = () =>
      setOverlay(pathname === "/tregu" && treguHeroBehindChrome(window.scrollY));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <div className="tregu-mbar" data-overlay={overlay ? "true" : undefined}>
      <div className="tregu-mbar-inner">
        {/* Balance chip doubles as the portfolio entry, mirroring the navbar chip. */}
        <Link
          href="/tregu/portofoli"
          className="tregu-mbar-chip"
          data-anim={flyCoins.length ? "true" : undefined}
          aria-label="Bilanci im — hap portofolin"
        >
          {flyCoins.map((id, i) => (
            <span
              key={id}
              className="nav-coin-fly"
              style={{ animationDelay: `${i * 55}ms` }}
              aria-hidden
            >
              <CoinFace size={16} shine={false} idle={false} />
            </span>
          ))}
          <CoinFace size={22} spinning={coinSpin} hoverTilt />
          <span className="tregu-mbar-bal">{fmtNum(balance)}</span>
          <span className="tregu-mbar-unit">383C</span>
          <span className="tregu-mbar-chev" aria-hidden>
            ›
          </span>
        </Link>

        <div className="tregu-mbar-actions">
          {bonusMsg && <span className="tregu-mbar-msg">{bonusMsg}</span>}
          <button
            onClick={onClaim}
            disabled={claiming}
            className="tregu-btn-primary tregu-mbar-bonus"
            type="button"
          >
            {claiming ? "..." : "Bonusi ditor"}
          </button>
        </div>
      </div>
    </div>
  );
}
