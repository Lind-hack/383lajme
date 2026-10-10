// Bota për Kosovën on the homepage: today's index, how it compares with
// yesterday, and the three biggest stories — in the order the full page lists
// them, so this is a true preview of /bota-per-kosoven.
//
// It replaces two modules that sat here: the full-bleed Bota Flet strip and
// the Toni dashboard (map, rows, topic chips). One reading, one link.

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import SectionLabel from "@/components/section-label";
import ToneScaleBar from "@/components/tone/tone-scale-bar";
import { ToneTag } from "@/app/bota-per-kosoven/stories";
import type { DailyStory, ToneToday } from "@/lib/tone-data";
import { dayVerdict, toneFill, toneLabel } from "@/lib/tone-scale";
import s from "./bota-home.module.css";
import DardaniImage from "@/components/dardani/dardani-image";
import WorldDateline from "@/components/tone/world-dateline";

export default function BotaHome({ today, stories }: { today: ToneToday; stories: DailyStory[] }) {
  const { positive, negative, neutral } = today.counts;
  const delta = today.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const top = stories.slice(0, 3);

  return (
    <section className={s.module} aria-labelledby="home-bota-title">
      <SectionLabel
        label={<span id="home-bota-title">BOTA PËR KOSOVËN</span>}
        marginBottom={16}
        right={
          <Link href="/bota-per-kosoven" className={s.all}>
            Shiko të gjitha <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
          </Link>
        }
      />

      <div className={s.opening}>
      <div>
      <h2 className={s.heading}>Si flet bota për Kosovën?</h2>
      <p className={s.intro}>
        Çdo ditë lexojmë shtypin e huaj dhe vlerësojmë nëse Kosova portretizohet pozitivisht,
        negativisht apo në mënyrë neutrale. Indeksi tregon nga anon mbulimi.
      </p>
      </div>
      <DardaniImage name="toni" className={s.mascot} sizes="(max-width: 760px) 84px, 150px" />
      </div>

      <div className={s.dateline}>
        <WorldDateline tone="light" />
      </div>

      <div className={s.panel}>
        <div className={s.reading}>
          <p className={s.verdict}>{dayVerdict(today.index)}</p>

          <div className={s.scoreRow}>
            <span className={s.score}>
              {today.index ?? "—"}
              <small>/100</small>
            </span>
            <span className={s.scoreMeta}>
              <span className={s.band}>
                <span className={s.swatch} style={{ background: toneFill(today.index) }} aria-hidden />
                {toneLabel(today.index)}
              </span>
              {delta != null && (
                <span className={s.delta} data-dir={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
                  <DeltaIcon size={14} strokeWidth={2.6} aria-hidden />
                  {delta === 0 ? "njësoj si dje" : `${delta > 0 ? "+" : ""}${delta} nga dje`}
                </span>
              )}
            </span>
          </div>

          <div className={s.scale}>
            <ToneScaleBar index={today.index} previous={today.previous?.index ?? null} size="sm" />
          </div>

          <p className={s.counts}>
            {positive + negative + neutral > 0
              ? `${positive} pozitive · ${negative} negative · ${neutral} neutrale sot`
              : "Çdo ditë lexojmë shtypin e huaj për Kosovën."}
          </p>
        </div>

        {top.length > 0 ? (
          <ol className={s.list}>
            {top.map((x) => (
              <li key={x.id}>
                <Link href={x.url} className={s.story}>
                  <ToneTag tone={x.sentiment} />
                  <span className={s.title}>{x.title}</span>
                  <span className={s.outlet}>
                    {x.flag} {x.country} · {x.outlet}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.empty}>Lajmet e sotme ende po vlerësohen. Kthehu pas pak.</p>
        )}
      </div>
    </section>
  );
}
