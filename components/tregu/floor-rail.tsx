"use client";

import Link from "next/link";
import { fmtNum } from "@/lib/format";
import type { MiniMarket } from "./market-mini-card";

// Small flame for the hottest books — drawn inline like the rest of the
// tregu glyphs (Sparkline, CoinFace); the project carries no icon library.
function Flame({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M6 0.6c.3 2-1 2.9-1.9 4C3.2 5.7 2.6 6.8 2.6 8a3.4 3.4 0 0 0 6.8 0c0-.6-.2-1.3-.5-1.9-.5.9-1.2 1.2-1.2 1.2.5-1.7-.2-4.6-1.7-6.7Z" />
    </svg>
  );
}

function hoursLeft(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

// The right-hand rail beside the flagship carousel: ranked hot topics
// (Polymarket-style), the nearest deadlines, and the floor's one loud
// surface — the orange promo tile (signup CTA logged out, daily bonus
// logged in).
export default function FloorRail({
  markets,
  loggedIn,
  claiming,
  bonusMsg,
  onClaim,
}: {
  markets: MiniMarket[];
  loggedIn: boolean;
  claiming?: boolean;
  bonusMsg?: string | null;
  onClaim?: () => void;
}) {
  const hot = [...markets]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 5);

  const closing = [...markets]
    .filter((m) => hoursLeft(m.closesAt) !== null)
    .sort((a, b) => new Date(a.closesAt!).getTime() - new Date(b.closesAt!).getTime())
    .slice(0, 3);

  return (
    <aside className="tregu-rail" aria-label="Paneli i tregut">
      {hot.length > 0 && (
        <section className="tregu-glass tregu-rail-panel tregu-edge">
          <h3 className="tregu-rail-title">
            <span className="tregu-rail-flame"><Flame /></span>
            Temat e nxehta
          </h3>
          {hot.map((m, i) => {
            const pct = Math.round(Math.max(0, Math.min(1, m.prob)) * 100);
            return (
              <Link key={m.slug} href={`/tregu/${m.slug}`} className="tregu-hot-row">
                <span className="tregu-hot-rank">{i + 1}</span>
                <span className="tregu-hot-q">{m.question}</span>
                <span className="tregu-hot-pct">{pct}%</span>
                <span className="tregu-hot-meta">
                  {fmtNum(m.volume ?? 0)} 383C
                  {i === 0 && (
                    <span className="tregu-rail-flame"><Flame size={10} /></span>
                  )}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {closing.length > 0 && (
        <section className="tregu-glass tregu-rail-panel tregu-edge">
          <h3 className="tregu-rail-title">Mbyllen së shpejti</h3>
          {closing.map((m) => {
            const pct = Math.round(Math.max(0, Math.min(1, m.prob)) * 100);
            return (
              <Link key={m.slug} href={`/tregu/${m.slug}`} className="tregu-hot-row">
                <span className="tregu-hot-rank" style={{ fontSize: 11, color: "#B45309" }}>
                  {hoursLeft(m.closesAt)}
                </span>
                <span className="tregu-hot-q">{m.question}</span>
                <span className="tregu-hot-pct">{pct}%</span>
              </Link>
            );
          })}
        </section>
      )}

      {loggedIn ? (
        <section className="tregu-rail-promo">
          <h3>Bonusi ditor të pret</h3>
          <p>Kthehu çdo ditë dhe shto 383 Coin pa rrezik. {bonusMsg && <strong>{bonusMsg}</strong>}</p>
          <button
            type="button"
            className="tregu-rail-promo-btn"
            onClick={onClaim}
            disabled={claiming}
          >
            {claiming ? "..." : "Merr bonusin"}
          </button>
        </section>
      ) : (
        <section className="tregu-rail-promo">
          <h3>Merr 100 383C falas</h3>
          <p>Krijo llogari, merr monedhat e para dhe vër mendimin tënd në provë.</p>
          <Link href="/hyr" className="tregu-rail-promo-btn">
            Hyr / Regjistrohu
          </Link>
        </section>
      )}
    </aside>
  );
}
