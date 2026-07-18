"use client";

// FotMob-style full-match stat comparison: centered label, values at the
// edges, mirrored bars growing out from the middle. The leading side gets
// the brand orange; the trailing side stays cream so dominance reads at a
// glance without a legend.
import type { MatchStatRow } from "@/lib/tregu-demo";

export default function MatchStats({
  home,
  away,
  score,
  note,
  goals,
  rows,
}: {
  home: string;
  away: string;
  score: string;
  note?: string;
  goals?: string;
  rows: MatchStatRow[];
}) {
  return (
    <section className="tregu-panel tregu-mstats" style={{ padding: 24 }} aria-label={`Statistikat: ${home} ${score} ${away}`}>
      <div className="tregu-mstats-head">
        <h3>Statistikat e ndeshjes</h3>
        <span className="tregu-mstats-score">
          {home} <strong>{score}</strong> {away}
          {note ? <em>{note}</em> : null}
        </span>
      </div>
      {goals && <p className="tregu-mstats-goals">{goals}</p>}
      <div className="tregu-mstats-rows">
        {rows.map((r) => {
          const total = r.home + r.away;
          const homePct = total > 0 ? (r.home / total) * 100 : 50;
          const homeLeads = r.home > r.away;
          const awayLeads = r.away > r.home;
          return (
            <div className="tregu-mstat" key={r.label}>
              <div className="tregu-mstat-line">
                <span className={`tregu-mstat-val${homeLeads ? " tregu-mstat-val--lead" : ""}`}>
                  {r.homeText ?? r.home}
                </span>
                <span className="tregu-mstat-label">{r.label}</span>
                <span className={`tregu-mstat-val tregu-mstat-val--r${awayLeads ? " tregu-mstat-val--lead" : ""}`}>
                  {r.awayText ?? r.away}
                </span>
              </div>
              <div className="tregu-mstat-bars" aria-hidden="true">
                <div className="tregu-mstat-half tregu-mstat-half--l">
                  <span
                    className={`tregu-mstat-bar tregu-mstat-bar--l${homeLeads ? " tregu-mstat-bar--lead" : ""}`}
                    style={{ width: `${homePct}%` }}
                  />
                </div>
                <div className="tregu-mstat-half">
                  <span
                    className={`tregu-mstat-bar${awayLeads ? " tregu-mstat-bar--lead" : ""}`}
                    style={{ width: `${100 - homePct}%` }}
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
