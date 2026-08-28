"use client";

// FotMob-style full-match stat comparison: centered label, values at the
// edges, mirrored bars growing out from the middle. The leading side gets
// the brand orange; the trailing side stays cream so dominance reads at a
// glance without a legend.
import { useMemo, useState, type CSSProperties } from "react";
import type { MatchStatRow } from "@/lib/tregu-demo";

export default function MatchStats({
  home,
  away,
  score,
  note,
  goals,
  rows,
  heading = "Statistikat e ndeshjes",
}: {
  home: string;
  away: string;
  score: string;
  note?: string;
  goals?: string;
  rows: MatchStatRow[];
  /** Panel title — races say "Statistikat e garës", football keeps the default. */
  heading?: string;
}) {
  const [view, setView] = useState<"key" | "all">("key");
  const visibleRows = useMemo(() => view === "key" ? rows.slice(0, 4) : rows, [rows, view]);
  const live = Boolean(note?.toLocaleUpperCase("sq-AL").includes("LIVE"));

  return (
    <section className="tregu-panel tregu-mstats" aria-label={`Statistikat: ${home} ${score} ${away}`}>
      <div className="tregu-mstats-head">
        <div>
          <h3>{heading}</h3>
          <span className="tregu-mstats-refresh" data-live={live || undefined}>
            {live ? "Përditësohet drejtpërdrejt" : "Aktivizohet me të dhënat e ndeshjes"}
          </span>
        </div>
        {rows.length > 4 && (
          <div className="tregu-mstats-tabs" role="group" aria-label="Shfaqja e statistikave">
            <button type="button" aria-pressed={view === "key"} onClick={() => setView("key")}>Kryesore</button>
            <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>Të gjitha</button>
          </div>
        )}
      </div>

      <div className="tregu-mstats-scoreboard">
        <strong title={home}>{home}</strong>
        <span className="tregu-mstats-score">
          <b><span key={score} className="tregu-stat-value-change">{score}</span></b>
          {note ? <em>{note}</em> : null}
        </span>
        <strong title={away}>{away}</strong>
      </div>
      {goals && <p className="tregu-mstats-goals">{goals}</p>}
      <div className="tregu-mstats-rows">
        {visibleRows.map((r, index) => {
          const total = r.home + r.away;
          const homePct = total > 0 ? (r.home / total) * 100 : 50;
          const homeLeads = r.home > r.away;
          const awayLeads = r.away > r.home;
          const empty = total <= 0;
          return (
            <div
              className="tregu-mstat"
              key={`${view}-${r.label}`}
              data-stat-row={r.label}
              data-home-value={r.home}
              data-away-value={r.away}
              data-empty={empty || undefined}
              style={{ "--stat-delay": `${Math.min(index, 5) * 28}ms` } as CSSProperties}
            >
              <div className="tregu-mstat-line">
                <span className={`tregu-mstat-val${homeLeads ? " tregu-mstat-val--lead" : ""}`}>
                  <span key={`${r.homeText ?? r.home}`} className="tregu-stat-value-change">
                    {r.homeText ?? r.home}
                  </span>
                </span>
                <span className="tregu-mstat-label">{r.label}</span>
                <span className={`tregu-mstat-val tregu-mstat-val--r${awayLeads ? " tregu-mstat-val--lead" : ""}`}>
                  <span key={`${r.awayText ?? r.away}`} className="tregu-stat-value-change">
                    {r.awayText ?? r.away}
                  </span>
                </span>
              </div>
              <div className="tregu-mstat-bars" aria-hidden="true">
                <div className="tregu-mstat-half tregu-mstat-half--l">
                  <span
                    className={`tregu-mstat-bar tregu-mstat-bar--l${homeLeads ? " tregu-mstat-bar--lead" : ""}`}
                    style={{ transform: `scaleX(${empty ? 0 : homePct / 100})` }}
                  />
                </div>
                <div className="tregu-mstat-half">
                  <span
                    className={`tregu-mstat-bar${awayLeads ? " tregu-mstat-bar--lead" : ""}`}
                    style={{ transform: `scaleX(${empty ? 0 : (100 - homePct) / 100})` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
