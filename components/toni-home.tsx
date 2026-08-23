import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import ToniGaugeIcon from "./toni-gauge-icon";
import {
  getToneHistory,
  getToneOutlets,
  summarizeToneHistory,
  type ToneOutlet,
} from "@/lib/tone-data";

/** Countries shown on the homepage. The rest are a click away on /toni. */
const CARD_LIMIT = 6;
/** Mastheads named in the outlet strip. */
const OUTLET_LIMIT = 4;

const FLAGS: Record<string, string> = {
  Gjermani: "🇩🇪", SHBA: "🇺🇸", Britani: "🇬🇧", Francë: "🇫🇷", Itali: "🇮🇹",
  Austri: "🇦🇹", Zvicër: "🇨🇭", Holandë: "🇳🇱", Belgjikë: "🇧🇪", Spanjë: "🇪🇸",
  Greqi: "🇬🇷", Suedi: "🇸🇪", Poloni: "🇵🇱", Turqi: "🇹🇷", Kroaci: "🇭🇷",
};

function toneOf(index: number | null): "kritik" | "neutral" | "pozitiv" {
  if (index == null) return "neutral";
  if (index >= 55) return "pozitiv";
  if (index <= 45) return "kritik";
  return "neutral";
}

/**
 * Toni, on the front page.
 *
 * The index answers a question a Kosovo reader actually has — what is the
 * world saying about us today — and it was buried on a page nobody navigates
 * to by accident. This is the entry point, placed directly above the archive
 * tail so it is the last thing read before the day's list.
 *
 * What it shows is deliberately hedged. A country with too little coverage
 * prints "pak mbulim" instead of a number, because printing 50 next to a flag
 * on the strength of three articles is exactly the claim a journalist would
 * take apart. The same reason the unattributed count is on screen rather than
 * quietly absorbed: the index says what it rests on.
 */
export default async function ToniHome() {
  const [history, outlets] = await Promise.all([getToneHistory(), getToneOutlets()]);
  const summary = summarizeToneHistory(history);
  if (!summary.hasData || !outlets) return null;

  // Countries, totals and the overall reading all come from tone-outlets.json,
  // which tools/tone_rebuild.py regenerates. tone-history.json is the daily
  // ledger and is only ever appended to by the scraper, so reading per-country
  // numbers from it would show yesterday's attribution under today's rules —
  // it published Gjermani 53 while the corrected file had Gjermani at n=1.
  // History is used for one thing here: how far the index has moved in a week.
  const countries = Object.entries(outlets.countries)
    .map(([country, data]) => ({ country, ...data.summary }))
    .filter((c) => c.n > 0)
    .sort((a, b) => Number(b.confident) - Number(a.confident) || b.n - a.n)
    .slice(0, CARD_LIMIT);
  if (countries.length === 0) return null;

  // The sharpest movement anywhere today, with the article behind it.
  const moved = Object.entries(outlets.countries)
    .map(([country, data]) => ({ country, movement: data.summary.movement }))
    .filter((row) => row.movement)
    .sort((a, b) => Math.abs(b.movement!.delta) - Math.abs(a.movement!.delta))[0];

  // The mastheads that watch Kosovo most, across every country.
  const watchers: Array<ToneOutlet & { country: string }> = Object.entries(outlets.countries)
    .flatMap(([country, data]) => data.outlets.map((o) => ({ ...o, country })))
    .filter((o) => (o.totalArticles ?? 0) > 0)
    .sort((a, b) => (b.totalArticles ?? 0) - (a.totalArticles ?? 0))
    .slice(0, OUTLET_LIMIT);

  const delta = summary.weekDelta;

  return (
    <section className="toni-home" aria-labelledby="toni-home-heading">
      <div className="toni-home-inner">
        <div className="toni-home-head">
          <ToniGaugeIcon size={19} strokeWidth={2.1} />
          <h2 id="toni-home-heading">Toni i mediave botërore ndaj Kosovës</h2>
          <Link href="/toni" className="toni-home-all">
            Indeksi i plotë
            <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
          </Link>
        </div>

        <div className="toni-home-grid">
          {/* The reading itself. */}
          <div className="toni-home-score" data-tone={toneOf(outlets.overallIndex)}>
            <span className="toni-home-score-value">{outlets.overallIndex ?? "—"}</span>
            <span className="toni-home-score-scale">nga 100</span>
            {delta != null && delta !== 0 && (
              <span className="toni-home-delta" data-dir={delta > 0 ? "up" : "down"}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} këtë javë
              </span>
            )}
            <p className="toni-home-basis">
              {outlets.totalArticles} artikuj nga {outlets.sourceCount} media
              {typeof outlets.unattributed === "number" && outlets.unattributed > 0 && (
                <>
                  {" · "}
                  {outlets.unattributed} pa shtet të identifikuar
                </>
              )}
            </p>
          </div>

          {/* Per country. */}
          <ul className="toni-home-countries">
            {countries.map((c) => (
              <li key={c.country}>
                <Link href="/toni" data-tone={toneOf(c.index)} data-thin={!c.confident || undefined}>
                  <span className="toni-flag" aria-hidden="true">
                    {FLAGS[c.country] ?? "🏳️"}
                  </span>
                  <span className="toni-cname">{c.country}</span>
                  {c.confident && c.index != null ? (
                    <span className="toni-cvalue">{c.index}</span>
                  ) : (
                    <span className="toni-cthin">pak mbulim</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Why it moved — only ever with the article that moved it. */}
        {moved?.movement && (
          <Link className="toni-home-move" href={moved.movement.url} target="_blank" rel="noopener noreferrer">
            <span className="toni-move-tag" data-dir={moved.movement.delta > 0 ? "up" : "down"}>
              {moved.country} {moved.movement.delta > 0 ? "+" : ""}
              {moved.movement.delta}
            </span>
            <span className="toni-move-body">
              <strong>{moved.movement.title}</strong>
              {moved.movement.evidence && <em>“{moved.movement.evidence}”</em>}
              <span className="toni-move-outlet">{moved.movement.outlet}</span>
            </span>
            <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        )}

        {/* Who is actually watching, and how they lean over time. */}
        {watchers.length > 0 && (
          <div className="toni-home-watchers">
            <h3>KUSH E NDJEK KOSOVËN</h3>
            <ul>
              {watchers.map((o) => (
                <li key={`${o.country}-${o.name}`}>
                  <span className="toni-w-name">{o.name}</span>
                  <span className="toni-w-count">
                    {o.totalArticles} {o.totalArticles === 1 ? "artikull" : "artikuj"}
                  </span>
                  <span className="toni-w-trend" data-trend={o.trend}>
                    {o.trend}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
