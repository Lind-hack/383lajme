/**
 * Bota për Kosovën — one daily reading.
 *
 * This page used to stack seven things: an index hero, the translated
 * headlines (Bota Flet), a map dashboard with rows and drill-downs, topic
 * chips, "why it moved", an outlet ledger and an exclusions ledger. Two
 * features on one pipeline, and a newcomer had to work out how they related.
 *
 * It is now one answer to one daily question — how did the world write about
 * Kosovo today? — in reading order:
 *
 *   1. Today's index, the sentence it stands for, how it compares with
 *      yesterday, and the last seven days.
 *   2. The stories behind it, good and bad first, filterable.
 *   3. The map, for "which country's press".
 *   4. One paragraph on how it is counted.
 *
 * The index is stance v4: good or bad news for Kosovo's image abroad, counted
 * per day (see tools/tone_scraper.py and tools/tone_rebuild.py).
 */

import type { Metadata } from "next";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import {
  getDailyStories,
  getMapHighlights,
  getToneHistory,
  getToneOutlets,
  summarizeToday,
  summarizeToneHistory,
} from "@/lib/tone-data";
import { dayVerdict, formatAge, toneFill, toneLabel } from "@/lib/tone-scale";
import ToneScaleBar from "@/components/tone/tone-scale-bar";
import WeekChart from "./week-chart";
import HowItWorks from "./how-it-works";
import Stories from "./stories";
import BotaMap from "./bota-map";
import s from "./bota.module.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Bota për Kosovën — si shkruan shtypi i huaj sot",
  description:
    "Çdo ditë: a shkroi bota mirë apo keq për Kosovën, lajmet e huaja të përkthyera në shqip, dhe harta sipas vendit.",
};

function longDate(dayKey: string | null): string {
  if (!dayKey) return "";
  try {
    return new Intl.DateTimeFormat("sq", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${dayKey}T00:00:00Z`));
  } catch {
    return dayKey;
  }
}

export default async function BotaPerKosovenPage() {
  const [history, outlets] = await Promise.all([
    getToneHistory(),
    getToneOutlets().catch(() => null),
  ]);

  const today = summarizeToday(history);
  const stories = getDailyStories(outlets, today.date, false);
  const highlights = getMapHighlights(outlets);
  const countries = summarizeToneHistory(history).countries.map((c) => ({
    country: c.country,
    flag: c.flag,
    index: c.index,
    n: c.n,
    confident: c.confident,
  }));

  const { positive, negative, neutral } = today.counts;
  const delta = today.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const includesYesterday = stories.some((x) => x.day !== today.date);

  // Days before the first v4 reading are gaps, and the chart says why once.
  const firstReading = today.week.find((d) => d.index != null)?.date ?? null;
  const hasGapBeforeMethod = firstReading != null && today.week[0]?.date !== firstReading;

  return (
    <>
      <TextureBg />
      <Navbar />

      <main className={s.page}>
        <header className={s.head}>
          <h1 className={s.title}>Bota për Kosovën</h1>
          <p className={s.lede}>
            Çdo ditë lexojmë çfarë shkruan shtypi i huaj për Kosovën dhe shënojmë nëse
            artikulli e portretizon Kosovën pozitivisht, negativisht apo në mënyrë neutrale.
          </p>
        </header>

        <HowItWorks articles={today.articles} sources={today.sources} />

        {today.isStale && (
          <p role="status" className={s.stale}>
            <AlertTriangle size={15} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Nuk është përditësuar prej {formatAge(today.ageHours)}. Numrat më poshtë janë të
              {today.date ? ` ${longDate(today.date)}` : " mbledhjes së fundit"}.
            </span>
          </p>
        )}

        <section className={`${s.panel} ${s.today}`} aria-labelledby="bota-sot">
          <div>
            <h2 id="bota-sot" className={s.verdict}>{dayVerdict(today.index)}</h2>
            <p className={s.why}>
              {positive + negative + neutral > 0 ? (
                <>
                  <b className={s.good}>{positive} {positive === 1 ? "artikull pozitiv" : "artikuj pozitivë"}</b>,{" "}
                  <b className={s.bad}>{negative} {negative === 1 ? "negativ" : "negativë"}</b> dhe {neutral}{" "}
                  {neutral === 1 ? "neutral" : "neutrale"} deri tani sot.
                </>
              ) : today.previous ? (
                <>Lajmet e sotme sapo kanë nisur të vijnë. Dje indeksi ishte <b>{today.previous.index}</b>.</>
              ) : (
                <>Lajmet e sotme sapo kanë nisur të vijnë.</>
              )}
            </p>
            {today.date && (
              <p className={s.date}>
                {longDate(today.date)} · përditësohet nëntë herë në ditë
              </p>
            )}
          </div>

          <div className={s.score} aria-label={`Indeksi sot: ${today.index ?? "pa të dhëna"}`}>
            <span className={s.scoreValue}>
              {today.index ?? "—"}
              <small>/100</small>
            </span>
            <span className={s.scoreBand}>
              <span className={s.swatch} style={{ background: toneFill(today.index) }} aria-hidden />
              {toneLabel(today.index)}
            </span>
            {delta != null && (
              <span className={s.delta} data-dir={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
                <DeltaIcon size={15} strokeWidth={2.6} aria-hidden />
                {delta === 0 ? "njësoj si dje" : `${delta > 0 ? "+" : ""}${delta} nga dje`}
              </span>
            )}
          </div>

          <div className={s.scaleRow}>
            <ToneScaleBar index={today.index} previous={today.previous?.index ?? null} />
          </div>

          <div className={s.week}>
            <p className={s.weekLabel}>7 ditët e fundit</p>
            <WeekChart week={today.week} today={today.date} />
            {hasGapBeforeMethod && (
              <p className={s.weekNote}>
                Mënyra e re e vlerësimit nisi më {longDate(firstReading)}; ditët para saj nuk krahasohen.
              </p>
            )}
          </div>
        </section>

        <section id="lajmet" className={s.section} aria-labelledby="bota-lajmet">
          <div className={s.sectionHead}>
            <div>
              <h2 id="bota-lajmet" className={s.h2}>
                {includesYesterday ? "Lajmet e sotme dhe të djeshme" : "Lajmet e sotme"}
              </h2>
              <p className={s.sectionNote}>
                Lexo artikujt e përkthyer në shqip dhe shpjegimin e vlerësimit të secilit.
              </p>
            </div>
          </div>
          <Stories stories={stories} today={today.date} />
        </section>

        <section id="harta" className={s.section} aria-labelledby="bota-harta">
          <div className={s.sectionHead}>
            <div>
              <h2 id="bota-harta" className={s.h2}>Sipas vendit</h2>
              <p className={s.sectionNote}>
                7 ditët e fundit. Prek një vend për të parë çfarë shkroi shtypi i tij.
              </p>
            </div>
          </div>
          <div className={`${s.panel} ${s.mapPanel}`}>
            <BotaMap countries={countries} highlights={highlights} />
          </div>
        </section>

        <p id="metodologjia" className={s.method}>
          <b>Si e llogarisim.</b> Vlerësojmë mënyrën si artikulli e portretizon Kosovën,
          jo nëse ngjarja është e mirë apo e keqe. Dallojmë opinionet e personave të cituar
          nga zëri i gazetarit. Indeksi shkon nga 0 (portretizim negativ) te 100
          (portretizim pozitiv); 50 është neutral ose i baraspeshuar. Çdo artikull ka
          shpjegimin e vlerësimit, përkthimin në shqip dhe lidhjen te burimi origjinal.
        </p>
      </main>

      <Footer />
    </>
  );
}
