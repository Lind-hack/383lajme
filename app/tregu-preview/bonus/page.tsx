"use client";

import { notFound } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { DailyBonusButton, DailyBonusStrip, JackpotCelebration, type DailyBonusStatus } from "@/components/tregu/daily-bonus";

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
