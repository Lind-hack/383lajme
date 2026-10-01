"use client";

import { notFound } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { DailyBonusButton, DailyBonusStrip, JackpotCelebration, type DailyBonusStatus } from "@/components/tregu/daily-bonus";
import DuelPin from "@/components/tregu/duel-pin";
import type { Duel } from "@/lib/tregu-leagues";

const HOUR = 3_600_000;
const BASE = Math.floor(Date.now() / HOUR) * HOUR;
const DUELS: Duel[] = [
  { id: "d1", league_id: "x", league_name: "Premier League me miqtë", status: "pending", stake: 25, i_am_challenger: false, rival: "Arta Krasniqi", created_at: new Date(BASE - HOUR).toISOString(), ends_at: null, my_net: 0, rival_net: 0, won: null },
  { id: "d2", league_id: "x", league_name: "Liga e Javës", status: "active", stake: 50, i_am_challenger: true, rival: "Blerim Gashi", created_at: new Date(BASE - 6 * HOUR).toISOString(), ends_at: new Date(BASE + 17 * HOUR).toISOString(), my_net: 124, rival_net: 98, won: null },
  { id: "d3", league_id: "x", league_name: "Liga e Javës", status: "settled", stake: 10, i_am_challenger: true, rival: "Dona", created_at: new Date(BASE - 30 * HOUR).toISOString(), ends_at: new Date(BASE - 6 * HOUR).toISOString(), my_net: 140, rival_net: 77, won: true },
];

const NOOP = () => {};
const STATES: { label: string; status: DailyBonusStatus }[] = [
  { label: "Pa tregtim sot (i kyçur)", status: { signed_in: true, traded_today: false, claimed_today: false, streak: 0, next_streak: 1 } },
  { label: "Pa tregtim, seri 4 ditë", status: { signed_in: true, traded_today: false, claimed_today: false, streak: 4, next_streak: 5 } },
  { label: "Gati për t'u marrë, seri 6", status: { signed_in: true, traded_today: true, claimed_today: false, streak: 6, next_streak: 7 } },
  { label: "Marrë sot, seri 7", status: { signed_in: true, traded_today: true, claimed_today: true, streak: 7, next_streak: 7 } },
];

const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid rgba(17,17,17,.08)" };

export default function BonusPreview() {
  const [jackpot, setJackpot] = useState(false);
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="tregu-scope" style={{ minHeight: "100vh", background: "#f8f5ef" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 64px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, letterSpacing: "-.04em" }}>Bonusi ditor</h1>
        <p style={{ margin: "0 0 20px", color: "#6b625a" }}>Pamje dizajni · gjendjet e butonit dhe xhekpoti.</p>
        {STATES.map((row) => (
          <div key={row.label} style={ROW}>
            <span style={{ width: 220, fontSize: 14, color: "#4f4a44" }}>{row.label}</span>
            <DailyBonusButton status={row.status} claiming={false} onClaim={NOOP} onLocked={NOOP} />
            <DailyBonusButton variant="bar" status={row.status} claiming={false} onClaim={NOOP} onLocked={NOOP} />
          </div>
        ))}
        <h2 style={{ margin: "32px 0 12px", fontSize: 20 }}>Duelet (në krye të Tregut)</h2>
        <DuelPin signedIn sample={DUELS} />
        <h2 style={{ margin: "32px 0 12px", fontSize: 20 }}>Shiriti në faqe</h2>
        {STATES.slice(1).map((row) => (
          <DailyBonusStrip key={row.label} status={row.status} claiming={false} onClaim={NOOP} onFindMarket={NOOP} pulse={0} />
        ))}
        <button type="button" className="tregu-btn-primary" style={{ marginTop: 24, padding: "10px 18px", borderRadius: 999 }} onClick={() => setJackpot(true)}>
          Shfaq xhekpotin
        </button>
        <JackpotCelebration open={jackpot} streak={6} onClose={() => setJackpot(false)} />
      </main>
    </div>
  );
}
