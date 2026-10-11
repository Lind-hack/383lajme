import type { Metadata } from "next";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, Minus } from "lucide-react";
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
import DailyBrief, { briefOf } from "./daily-brief";
import WorldDesk from "./world-desk";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Bota për Kosovën — si shkruan shtypi i huaj sot",
  description:
    "Çdo ditë: a shkroi bota mirë apo keq për Kosovën, lajmet e huaja të përkthyera në shqip, dhe harta sipas vendit.",
};

/** "14:05", Kosovo time, from the ISO time 383 last added an article. */
function clockTime(iso: string | null | undefined): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Belgrade",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

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
  // Grouped: one entry per event, with every outlet that ran it underneath.
  const stories = getDailyStories(outlets, today.date);
  const highlights = getMapHighlights(outlets);
  const countries = summarizeToneHistory(history).countries.map((c) => ({
    country: c.country,
    flag: c.flag,
    index: c.index,
    n: c.n,
    confident: c.confident,
  }));

  const { positive, negative, neutral } = today.counts;
  const scored = positive + negative + neutral;
  const countryCount = outlets?.countryCount ?? null;
  const collectedAt = clockTime(outlets?.collectedAt);
  const delta = today.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const includesYesterday = stories.some((x) => x.day !== today.date);

  // Days before the first comparable reading are gaps, and the chart says why once.
  const firstReading = today.week.find((d) => d.index != null)?.date ?? null;
  const hasGapBeforeMethod = firstReading != null && today.week[0]?.date !== firstReading;

  return (
    <>
      <TextureBg />
      <Navbar />

      <main className={s.page}>
        {/* The masthead and the day's index are one object: the index rises into
            the desk as the globe's horizon, rather than a card laid on top. */}
        <div className={s.deskShell}>
        <WorldDesk />

        <section className={s.today} aria-labelledby="bota-sot">
          {today.articles > 0 && (
            <p className={s.proof}>
              <BadgeCheck size={17} strokeWidth={2.3} aria-hidden />
              <span>
                Sot lexuam <b>{today.articles} {today.articles === 1 ? "artikull" : "artikuj"}</b> të plotë nga{" "}
                <b>{today.sources} {today.sources === 1 ? "gazetë" : "gazeta"}</b>
                {countryCount ? <> në <b>{countryCount} {countryCount === 1 ? "vend" : "vende"}</b></> : null}
                {collectedAt ? <> · shtuar së fundi në <b>{collectedAt}</b></> : null}
              </span>
              <a href="#metodologjia">Si e bëjmë</a>
            </p>
          )}
          <div className={s.todayMain}>
            <h2 id="bota-sot" tabIndex={-1} className={s.verdict}>{dayVerdict(today.index)}</h2>
            <div className={s.score} aria-label={`Indeksi sot: ${today.index ?? "pa të dhëna"}`}>
              <span className={s.scoreValue}>
                {today.index ?? "—"}
                <small>/100</small>
              </span>
              <span className={s.scoreMeta}>
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
              </span>
            </div>
            <div className={s.scaleRow}>
              <ToneScaleBar index={today.index} previous={today.previous?.index ?? null} />
            </div>
            <p className={s.why}>
              {scored > 0 ? (
                <>
                  <b className={s.good}>{positive} {positive === 1 ? "pozitiv" : "pozitivë"}</b> ×100,{" "}
                  <b>{neutral} {neutral === 1 ? "neutral" : "neutralë"}</b> ×50,{" "}
                  <b className={s.bad}>{negative} {negative === 1 ? "negativ" : "negativë"}</b> ×0
                  {" "}÷ {scored} {scored === 1 ? "artikull" : "artikuj"} = <b>{today.index}</b>
                </>
              ) : today.previous ? (
                <>Lajmet e sotme sapo kanë nisur të vijnë. Dje indeksi ishte <b>{today.previous.index}</b>.</>
              ) : (
                <>Lajmet e sotme sapo kanë nisur të vijnë.</>
              )}
            </p>
          </div>

          <div className={s.week}>
            <p className={s.weekLabel}>7 ditët e fundit</p>
            <WeekChart week={today.week} today={today.date} />
            {hasGapBeforeMethod && (
              <p className={s.weekNote}>
                Mënyra e re e vlerësimit nisi më {longDate(firstReading)}; ditët para saj nuk krahasohen.
              </p>
            )}
            <p className={s.date}>
              {today.date ? `${longDate(today.date)} · përditësohet nëntë herë në ditë. ` : ""}
              Mat mënyrën si shkruajnë artikujt, jo qëndrimin e një vendi ndaj Kosovës.
            </p>
          </div>
        </section>
        </div>

        <div className={s.reading}>

        {today.isStale && (
          <p role="status" className={s.stale}>
            <AlertTriangle size={15} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Nuk është përditësuar prej {formatAge(today.ageHours)}. Numrat më poshtë janë të
              {today.date ? ` ${longDate(today.date)}` : " mbledhjes së fundit"}.
            </span>
          </p>
        )}

        <DailyBrief stories={stories} date={longDate(stories[0]?.day ?? today.date)} />

        <section id="lajmet" className={s.section} aria-labelledby="bota-lajmet">
          <div className={s.sectionHead}>
            <div>
              <h2 id="bota-lajmet" className={s.h2}>
                {today.isStale ? "Lajmet e mbledhjes së fundit" : includesYesterday ? "Lajmet e sotme dhe të djeshme" : "Lajmet e sotme"}
              </h2>
              <p className={s.sectionNote}>
                Një lajm i shkruar nga disa gazeta shfaqet një herë, me të gjitha gazetat poshtë tij. Te secili: titulli origjinal, data dhe pse e vlerësuam ashtu.
              </p>
            </div>
          </div>
          <Stories stories={stories} today={today.date} featured={briefOf(stories).map((story) => story.id)} />
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

        <details className={s.explanation}>
          <summary>Si e mbledhim dhe e vlerësojmë lajmin?</summary>
          <HowItWorks articles={today.articles} sources={today.sources} />
        </details>
        {/* Outside the <details>: /bota-per-kosoven#metodologjia links must land on
            text the reader can see, and not every browser opens <details> for a fragment. */}
        <p id="metodologjia" className={s.method}>
          <b>Si e llogarisim.</b> Gjejmë artikujt për Kosovën në shtypin e huaj, i lexojmë
          të plotë nga faqja e gazetës dhe i përkthejmë në shqip. Secilin e vlerësojmë sipas
          mënyrës si e portretizon Kosovën, jo nëse ngjarja është e mirë apo e keqe, dhe
          dallojmë fjalët e personave të cituar nga zëri i gazetarit. Pozitiv vlen 100,
          neutral 50, negativ 0; indeksi i ditës është mesatarja e të gjithë artikujve, nga
          0 te 100. Çdo artikull ka titullin origjinal, arsyen e vlerësimit dhe lidhjen te
          burimi. Nëse mendon se një vlerësim është gabim, na shkruaj nga vetë artikulli.
        </p>
        </div>
      </main>

      <Footer />
    </>
  );
}
