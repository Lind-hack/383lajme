"use client";

// Live timing board for race-style events (F1 grids) — replaces the
// per-outcome mini-chart grid when every outcome has a registry photo.
// One row per driver, ranked by live odds: position, headshot, name, then
// on the right the interval to the leader and the live probability. There is
// no telemetry feed, so the live market odds ARE the standings — Hermes'
// 5-minute snapshots reshuffle the order as money moves.
import Link from "next/link";
import TeamFlag from "@/components/tregu/team-flag";
import type { GroupOutcome } from "@/lib/tregu-groups";

export default function RaceStandings({
  outcomes,
  currentSlug,
}: {
  outcomes: GroupOutcome[];
  currentSlug?: string;
}) {
  const leader = outcomes[0];
  return (
    <div className="tregu-standings">
      <div className="tregu-standings-head" aria-hidden>
        <span />
        <span />
        <span>Piloti</span>
        <span>Interval</span>
        <span>Gjasa</span>
      </div>
      {outcomes.map((o, i) => {
        const gapPp = (leader.prob - o.prob) * 100;
        return (
          <Link
            key={o.slug}
            href={`/tregu/${o.slug}`}
            className="tregu-standing-row"
            data-active={o.slug === currentSlug}
          >
            <span className="tregu-standing-pos">{i + 1}</span>
            <TeamFlag team={o.label} label={o.label} size={34} radius={10} />
            <span className="tregu-standing-name">{o.label}</span>
            <span className="tregu-standing-gap">{i === 0 ? "Lider" : `+${gapPp.toFixed(1)} pp`}</span>
            <span className="tregu-standing-pct" style={{ color: o.color }}>
              {(o.prob * 100).toFixed(1)}%
            </span>
          </Link>
        );
      })}
    </div>
  );
}
