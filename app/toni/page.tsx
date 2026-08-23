/**
 * Toni — the full analysis.
 *
 * This page had drifted into a worse copy of the homepage module: a 1000px
 * centred column, a line chart the homepage does not show, and no map at all —
 * so the one surface that exists to go deeper had less in it than the summary
 * that links to it, and everything sat in a narrow ribbon down the middle.
 *
 * It now runs the same dashboard the homepage does, so the map, the country
 * drill-down and the evidence spans are identical rather than a second
 * implementation that can drift. What makes it the *full* analysis is what
 * sits underneath, none of which the homepage carries:
 *
 *   1. Who watches Kosovo — the per-masthead ledger. The article cache keeps
 *      seven days; the ledger accumulates, so this can say how often an outlet
 *      has covered Kosovo at all and which way it leans across all of it.
 *   2. Why it moved — the article behind a sharp change, with the sentence
 *      that caused it.
 *   3. What was thrown away, and why. The number a journalist would attack
 *      first is the one the index does not rest on, so it is published.
 */

import type { Metadata } from "next";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import SectionLabel from "@/components/section-label";
import ToneDashboard from "@/components/tone-dashboard";
import ToniGaugeIcon from "@/components/toni-gauge-icon";
import {
  getToneArticleCache,
  getToneHistory,
  getToneOutletLedger,
  getToneOutlets,
  getToneTopics,
  getTopics,
  summarizeToneHistory,
  type CountryMovement,
} from "@/lib/tone-data";
import {
  TONE_INK,
  formatAge,
  toneLabel,
  verdictSentence,
} from "@/lib/tone-scale";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Toni i Mediave Botërore ndaj Kosovës",
  description:
    "Si e trajton shtypi i huaj Kosovën — indeks ditor, i mbledhur nga artikuj të vërtetë, me fjalët e sakta që e vendosin çdo vlerësim dhe me atë që është përjashtuar.",
};

/** How many mastheads the ledger table lists before it stops. */
const LEDGER_ROWS = 14;

const TREND_LABEL: Record<string, string> = {
  pozitiv: "pozitiv",
  kritik: "kritik",
  "i përzier": "i përzier",
  neutral: "neutral",
};

function leanOf(rec: { positive: number; negative: number; neutral: number }): string {
  const scored = rec.positive + rec.negative + rec.neutral;
  if (scored < 3) return "i pamjaftueshëm";
  if (rec.positive > rec.negative * 2 && rec.positive >= 2) return "pozitiv";
  if (rec.negative > rec.positive * 2 && rec.negative >= 2) return "kritik";
  if (rec.positive || rec.negative) return "i përzier";
  return "neutral";
}

export default async function ToniPage() {
  const [history, outlets, cache, pipelineTopics, ledger] = await Promise.all([
    getToneHistory(),
    getToneOutlets(),
    getToneArticleCache(),
    getToneTopics(),
    getToneOutletLedger(),
  ]);
  const summary = summarizeToneHistory(history);
  const topics = pipelineTopics ?? getTopics(cache, { limit: 8 });

  const delta = summary.weekDelta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  // Every country that moved far enough today to be worth a sentence.
  const movements: Array<{ country: string; movement: CountryMovement }> = Object.entries(
    outlets?.countries ?? {},
  )
    .flatMap(([country, data]) =>
      data.summary.movement ? [{ country, movement: data.summary.movement }] : [],
    )
    .sort((a, b) => Math.abs(b.movement.delta) - Math.abs(a.movement.delta));

  const watchers = Object.entries(ledger?.outlets ?? {})
    .map(([name, rec]) => ({ name, ...rec }))
    .filter((o) => o.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, LEDGER_ROWS);

  const excluded = {
    unattributed: outlets?.unattributed ?? 0,
    nonEditorial: outlets?.nonEditorial ?? 0,
    wrongKosovo: outlets?.wrongKosovo ?? 0,
  };
  const totalExcluded = excluded.unattributed + excluded.nonEditorial + excluded.wrongKosovo;

  return (
    <>
      <TextureBg />
      <Navbar />

      <main className="toni-page">
        {/* ── Masthead ─────────────────────────────────────────────────────
            Left-weighted, not centred: the reading and the sentence it
            supports read as one statement, and the method sits beside them
            rather than under everything. */}
        <header className="toni-hero">
          <div className="toni-hero-main">
            <span className="toni-hero-eyebrow">
              <ToniGaugeIcon size={15} strokeWidth={2.2} />
              Indeksi ditor
            </span>
            <h1>{verdictSentence(summary.overallIndex)}</h1>
            <p className="toni-hero-sub">
              Çdo ditë 383 lexon shtypin e huaj për Kosovën, e klasifikon secilin artikull
              si pozitiv, neutral ose kritik, dhe e ruan fjalinë që e vendosi vlerësimin.
              Kjo faqe e tregon të plotë — bashkë me atë që nuk numërohet.
            </p>
          </div>

          <aside className="toni-hero-score" aria-label="Indeksi sot">
            <span className="toni-hero-value">{summary.overallIndex ?? "—"}</span>
            <span className="toni-hero-band">{toneLabel(summary.overallIndex)}</span>
            <span className="toni-hero-delta" data-dir={delta && delta > 0 ? "up" : delta && delta < 0 ? "down" : "flat"}>
              <DeltaIcon size={14} strokeWidth={2.4} aria-hidden="true" />
              {delta == null ? "metodë e re" : delta === 0 ? "pa ndryshim" : `${delta > 0 ? "+" : ""}${delta} këtë javë`}
            </span>
            <dl className="toni-hero-facts">
              <div>
                <dt>Artikuj</dt>
                <dd>{outlets?.totalArticles ?? summary.totalArticles}</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>{outlets?.sourceCount ?? summary.sourceCount}</dd>
              </div>
              <div>
                <dt>Përditësuar</dt>
                <dd>{formatAge(summary.ageHours)}</dd>
              </div>
            </dl>
          </aside>
        </header>

        {/* ── The map and the drill-down ───────────────────────────────────
            The same component the homepage runs, so the two cannot disagree
            about what a country's index is. */}
        <section className="toni-map-block">
          <ToneDashboard summary={summary} topics={topics} variant="page" />
        </section>

        {/* ── Why it moved ────────────────────────────────────────────────── */}
        {movements.length > 0 && (
          <section className="toni-section">
            <SectionLabel label="Pse lëvizi" marginBottom={10} />
            <p className="toni-lede">
              Një indeks që ndryshon pa shpjegim është vetëm një numër tjetër. Këtu është
              artikulli që e lëvizi, me fjalinë që e vendosi.
            </p>
            <div className="toni-moves">
              {movements.map(({ country, movement }) => (
                <a
                  key={country}
                  className="toni-move"
                  href={movement.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="toni-move-head">
                    <span className="toni-move-country">{country}</span>
                    <span
                      className="toni-move-delta"
                      data-dir={movement.delta > 0 ? "up" : "down"}
                    >
                      {movement.delta > 0 ? "+" : ""}
                      {movement.delta}
                    </span>
                    <span className="toni-move-from">nga {movement.from}</span>
                  </span>
                  <strong>{movement.title}</strong>
                  {movement.evidence && <em>“{movement.evidence}”</em>}
                  <span className="toni-move-outlet">
                    {movement.outlet}
                    <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Who watches ─────────────────────────────────────────────────── */}
        {watchers.length > 0 && (
          <section className="toni-section">
            <SectionLabel label="Kush e ndjek Kosovën" marginBottom={10} />
            <p className="toni-lede">
              Jo çdo redaksi shkruan për Kosovën njësoj shpesh. Kjo listë mbahet përtej
              dritares shtatëditore të arkivit, kështu që tregon sa herë një media e ka
              mbuluar Kosovën dhe nga anon në tërësi — jo vetëm sot.
            </p>
            <div className="toni-ledger" role="table" aria-label="Media që mbulojnë Kosovën">
              <div className="toni-ledger-head" role="row">
                <span role="columnheader">Media</span>
                <span role="columnheader">Shteti</span>
                <span role="columnheader">Artikuj</span>
                <span role="columnheader">Anon</span>
                <span role="columnheader">Që nga</span>
              </div>
              {watchers.map((o) => {
                const lean = leanOf(o);
                return (
                  <div className="toni-ledger-row" role="row" key={o.name}>
                    <span role="cell" className="toni-l-name">{o.name}</span>
                    <span role="cell" className="toni-l-country">{o.country}</span>
                    <span role="cell" className="toni-l-count">{o.total}</span>
                    <span role="cell" className="toni-l-lean" data-lean={lean}>
                      {TREND_LABEL[lean] ?? lean}
                    </span>
                    <span role="cell" className="toni-l-since">{o.firstSeen}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── What does not count ─────────────────────────────────────────── */}
        <section className="toni-section">
          <SectionLabel label="Çfarë nuk numërohet" marginBottom={10} />
          <p className="toni-lede">
            Një indeks vlen aq sa ajo që refuzon të numërojë. Këto artikuj u lexuan dhe u
            hodhën poshtë me arsye, dhe numri qëndron këtu në vend që të fshihet.
          </p>
          <div className="toni-excluded">
            <div className="toni-ex">
              <span className="toni-ex-n">{excluded.unattributed}</span>
              <strong>Pa shtet të identifikuar</strong>
              <p>
                Një redaksi që nuk e vendosim dot me siguri — një domen i përgjithshëm që
                nuk e njohim, ose një shtet jashtë të pesëmbëdhjetëve. Nuk e hamendësojmë:
                artikulli nuk numërohet askund.
              </p>
            </div>
            <div className="toni-ex">
              <span className="toni-ex-n">{excluded.nonEditorial}</span>
              <strong>Jo gazetari</strong>
              <p>
                Tabela rezultatesh, kalendarë ndeshjesh, programe televizive, federata
                sportive. Një rresht baze të dhënash nuk mban qëndrim — ta numëroje si
                “neutral” do të ishte një votë për 50 që s’e dha asnjë gazetar.
              </p>
            </div>
            <div className="toni-ex">
              <span className="toni-ex-n">{excluded.wrongKosovo}</span>
              <strong>Kosova e gabuar</strong>
              <p>
                Kosowo është fshat në Poloni, Kosova një lagje e zakonshme në Turqi, Kosovo
                një fushë pranë Kninit. Një zjarr shtëpie atje nuk është mbulim i vendit.
              </p>
            </div>
          </div>
          <p className="toni-method">
            Gjithsej <strong>{totalExcluded}</strong> artikuj të përjashtuar. Indeksi shkon
            nga 0 (kritik) te 100 (pozitiv), me 50 si raportim neutral — që është gjendja
            normale e lajmit, jo mungesë interesi. Një shtet me pak mbulim nuk merr numër
            fare; shkruhet “pak mbulim”, sepse një indeks mbi tre artikuj nuk është matje.
            Media kosovare, shqiptare dhe serbe nuk numërohen: janë palë në temë, jo
            vëzhgues të saj.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
