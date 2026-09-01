"use client";

/**
 * Sports discovery cards on the hub floor: football leagues (the four big
 * ones, cups marked as coming later), the F1 race calendar, and basketball
 * as an honest locked state until its pricing algorithm exists. Brand edges
 * distinguish the live surfaces without implying that a locked league is
 * already trading. Selecting a league hands the filter back to the page,
 * which applies it to the floor grid and scrolls there.
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Trophy } from "lucide-react";
import type { CSSProperties } from "react";
import SportBrandMark from "@/components/tregu/sport-brand-mark";
import { sportBrandFor } from "@/lib/tregu-sport-branding";
import {
  FOOTBALL_LEAGUES,
  FOOTBALL_TOURNAMENTS_SOON,
  f1Calendar,
  footballLeagueCounts,
} from "@/lib/tregu-sport-sections.mjs";

export type SportMarketLike = {
  slug: string;
  question: string;
  market_prob?: number;
  status?: string;
  market_classification?: string;
  market_type?: string;
  closes_at: string;
  live_event?: { league?: string; sport?: string } | null;
};

const MONTHS_SQ = [
  "jan", "shk", "mar", "pri", "maj", "qer",
  "kor", "gus", "sht", "tet", "nën", "dhj",
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS_SQ[d.getUTCMonth()]}`;
}

function RaceCard({
  markets,
  active,
  onSelect,
}: {
  markets: SportMarketLike[];
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const races = useMemo(
    () =>
      f1Calendar(markets, { limit: 3 }) as {
        slug: string;
        name: string;
        closesAt: string;
        prob?: number;
      }[],
    [markets]
  );

  return (
    <article
      className="tregu-sport-card p-5 flex flex-col"
      data-sport="f1"
      style={{ "--sport-accent": "#E10600", "--sport-tint": "#FFF0EF" } as CSSProperties}
    >
      <header className="flex items-center gap-2.5 mb-4">
        <SportBrandMark brandKey="f1" size="md" />
        <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: "-0.01em" }}>
          Formula 1
        </h3>
        {active === "f1" && (
          <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.08em] text-orange">
            Aktiv
          </span>
        )}
      </header>

      {races.length === 0 ? (
        <p style={{ color: "#6B6B6B", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Kalendari mbushet automatikisht tre ditë para çdo gare.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {races.map((r) => (
            <Link
              key={r.slug}
              className="tregu-sport-league"
              href={`/tregu/${r.slug}`}
            >
              <span className="tregu-race-name min-w-0 truncate">
                <SportBrandMark brandKey="f1" size="sm" />
                {r.name}
              </span>
              <span className="tregu-sport-league-count">{shortDate(r.closesAt)}</span>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect("f1")}
        aria-pressed={active === "f1"}
        className="mt-4 inline-flex items-center gap-1.5 self-start text-[12.5px] font-bold text-orange hover:text-[#d63a1c] transition-colors"
      >
        Gjithë tregjet F1
        <ArrowRight size={13} strokeWidth={2.5} aria-hidden />
      </button>
    </article>
  );
}

export default function SportSections({
  markets,
  isOpen,
  activeLeague,
  onSelect,
}: {
  markets: SportMarketLike[];
  isOpen: (m: SportMarketLike) => boolean;
  activeLeague: string | null;
  onSelect: (key: string) => void;
}) {
  const counts = useMemo(() => footballLeagueCounts(markets ?? [], isOpen), [markets, isOpen]);
  const totalFootball = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <section aria-label="Sportet në Treg" data-tour="floor-sports" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <h2 style={{ fontSize: "clamp(19px, 2.4vw, 24px)", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
          Sportet në Treg
        </h2>
        <p style={{ margin: 0, fontSize: 12.5, color: "#6B6B6B", fontWeight: 600 }}>
          Zgjidh një ligë — lista më poshtë filtrohet.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {/* Football */}
        <article
          className="tregu-sport-card p-5 flex flex-col"
          data-sport="football"
          style={{ "--sport-accent": "#FF4422", "--sport-tint": "#FFF3EF" } as CSSProperties}
        >
          <header className="flex items-center gap-2.5 mb-4">
            <span className="tregu-sport-icon" aria-hidden><Trophy size={18} strokeWidth={2} /></span>
            <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: "-0.01em" }}>Futboll</h3>
            <span className="ml-auto text-[12px] font-extrabold tabular-nums" style={{ color: totalFootball > 0 ? "#ff4422" : "#9c9c9c" }}>
              {totalFootball} të hapura
            </span>
          </header>

          <div className="flex flex-col gap-2">
            {FOOTBALL_LEAGUES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => onSelect(l.key)}
                aria-pressed={activeLeague === l.key}
                className="tregu-sport-league"
                style={{
                  "--league-accent": sportBrandFor(l.key)?.accent ?? "#FF4422",
                  "--league-tint": sportBrandFor(l.key)?.tint ?? "#FFF3EF",
                } as CSSProperties}
              >
                <span className="tregu-league-identity">
                  <SportBrandMark brandKey={l.key} size="md" />
                  <span>
                    {l.label}
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#77716A", marginTop: 1 }}>{l.country}</span>
                  </span>
                </span>
                <span className="tregu-sport-league-count">{counts[l.key] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Cups exist in the pipeline — their sections come later. */}
          <div className="flex flex-wrap gap-1.5 mt-3.5">
            {FOOTBALL_TOURNAMENTS_SOON.map((t) => (
              <span key={t.key} className="tregu-sport-soon" title="Vjen më vonë">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.logo} alt="" width={13} height={13} loading="lazy" />
                {t.label}
              </span>
            ))}
          </div>
        </article>

        {/* Formula 1 */}
        <RaceCard markets={markets} active={activeLeague} onSelect={onSelect} />

        {/* Basketball — honest lock until the live automation prices it. */}
        <article
          className="tregu-sport-card p-5 flex flex-col"
          data-state="locked"
          data-sport="basketball"
          style={{ "--sport-accent": "#17408B", "--sport-tint": "#EEF4FF" } as CSSProperties}
          aria-disabled
        >
          <header className="flex items-center gap-2.5 mb-4">
            <Lock size={18} strokeWidth={2} className="text-[#9c9c9c]" aria-hidden />
            <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: "-0.01em", color: "#9c9c9c" }}>
              Basketboll
            </h3>
            <span className="ml-auto rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] bg-[#111]/[0.06] text-[#6b6b6b]">
              Së shpejti
            </span>
          </header>
          <p style={{ color: "#6B6B6B", fontSize: 13.5, lineHeight: 1.65, margin: 0 }}>
            Motori është gati — tregje me dy rezultate për NBA, FIBA dhe Superligën e Kosovës.
            Hapet sapo të lidhet burimi i parë zyrtar.
          </p>
          <div className="tregu-basketball-soon" aria-label="Ligat e planifikuara">
            {(["nba", "fbk"] as const).map((key) => (
              <span key={key}>
                <SportBrandMark brandKey={key} size="md" />
                <em>{sportBrandFor(key)?.label}</em>
                <Lock size={11} strokeWidth={2.3} aria-hidden />
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
