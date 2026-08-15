// The full analysis. The homepage module links here as "Analiza e plotë", so
// this page has to be the deeper version of the same thing — not an older one.
//
// It had drifted: its own red/green pair (the one measured at ΔE 5.0 under
// deuteranopia and replaced for exactly that reason), "5 vende" hard-coded in
// four places against fifteen countries of data, a bare number where the
// homepage leads with a sentence, and no access to the evidence spans at all
// because it never read tone-outlets.json. All of that is now shared code.

import type { Metadata } from "next";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import SectionLabel from "@/components/section-label";
import ToneLineChart from "@/components/tone/tone-line-chart";
import ToneArticleCard from "@/components/tone/tone-article-card";
import type { ToneCardArticle } from "@/components/tone/tone-article-card";
import {
  getToneHistory,
  getToneOutlets,
  getToneArticleCache,
  summarizeToneHistory,
  getTopics,
} from "@/lib/tone-data";
import {
  TONE_COLOR,
  TONE_INK,
  BAND,
  toneFill,
  toneLabel,
  verdictSentence,
  coverageOf,
  formatAge,
  NEUTRAL_IS_NORMAL,
} from "@/lib/tone-scale";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Toni i Mediave Botërore ndaj Kosovës",
  description:
    "Si e trajton shtypi i huaj Kosovën — indeks ditor, i mbledhur dhe llogaritur nga artikuj të vërtetë, me fjalët e sakta që e vendosin çdo vlerësim.",
};

export default async function ToniPage() {
  const [history, outlets, cache] = await Promise.all([
    getToneHistory(),
    getToneOutlets(),
    getToneArticleCache(),
  ]);
  const summary = summarizeToneHistory(history);
  // The deep-dive page gets the long list, not the homepage's five chips.
  const topics = getTopics(cache, { limit: 8 });

  const delta = summary.weekDelta;
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delta == null || delta === 0 ? TONE_INK.faint : delta > 0 ? TONE_COLOR.positive : TONE_COLOR.critical;

  // Same rule as the homepage: countries the scraper has actually resolved,
  // most critical first. An alphabetical list including empty rows answers
  // no question anyone came with.
  const withData = summary.countries
    .filter((c) => c.index != null)
    .sort((a, b) => (a.index ?? 50) - (b.index ?? 50));
  const pending = summary.countries.length - withData.length;

  // Everything the countries wrote, keyed for the per-country article lists.
  const articlesFor = (country: string): ToneCardArticle[] => {
    const data = outlets?.countries?.[country];
    if (!data) return [];
    const rank: Record<string, number> = { negative: 0, positive: 1, neutral: 2, unknown: 3 };
    return data.outlets
      .flatMap((o) => o.articles.map((a) => ({ ...a, outlet: o.name })))
      .sort((a, b) => (rank[a.sentiment] ?? 3) - (rank[b.sentiment] ?? 3));
  };

  return (
    <>
      <TextureBg />
      <Navbar />

      <main style={{ position: "relative", zIndex: 1, paddingTop: "calc(var(--nav-h) + 48px)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FF4422" }}>
            Ekskluzive 383
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: TONE_INK.strong, lineHeight: 1.15 }}>
            Toni i Mediave Botërore ndaj Kosovës
          </h1>
          <p style={{ margin: "0 0 32px", maxWidth: "62ch", fontSize: "15px", color: "#5F5B56", lineHeight: 1.6 }}>
            Çdo ditë mbledhim artikuj rreth Kosovës nga shtypi i huaj dhe llogarisim se sa
            pozitivisht, neutralisht apo kritikisht e trajtojnë vendin. Ky është indeksi i
            vetëm i këtij lloji për Kosovën në rajon.
          </p>

          {!summary.hasData ? (
            <div style={{ background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "16px", padding: "40px", fontSize: "14px", color: TONE_INK.muted }}>
              Analiza po ndërtohet — të dhënat e para do të shfaqen pas mbledhjes ditore të parë.
            </div>
          ) : (
            <>
              {summary.isStale && (
                <p
                  role="status"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "9px",
                    margin: "0 0 24px", padding: "12px 15px", borderRadius: "12px",
                    background: "#FFF6E8", border: "1px solid #F0D9AE",
                    fontSize: "13.5px", lineHeight: 1.55, color: "#7A5310",
                  }}
                >
                  <AlertTriangle size={16} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden />
                  <span>
                    Të dhënat nuk janë përditësuar prej {formatAge(summary.ageHours)}. Gjithçka më
                    poshtë i përket mbledhjes së fundit të suksesshme
                    {summary.lastUpdated ? ` (${summary.lastUpdated})` : ""}, jo ditës së sotme.
                  </span>
                </p>
              )}

              {/* The sentence leads, the number supports — same order as the
                  homepage. A reader who arrives at a bare "51" has to be told
                  what 51 means before it is worth anything to them. */}
              <h2 style={{ margin: "0 0 14px", maxWidth: "26ch", fontSize: "clamp(24px, 3.6vw, 36px)", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em", color: TONE_INK.strong, textWrap: "balance" }}>
                {verdictSentence(summary.overallIndex)}
              </h2>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-end", marginBottom: "10px" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TONE_INK.faint }}>
                    Indeksi {summary.isStale ? "i fundit" : "sot"}
                  </p>
                  <span style={{ fontSize: "clamp(52px, 8vw, 76px)", fontWeight: 800, color: TONE_INK.strong, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {summary.overallIndex ?? "—"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700, color: deltaColor, paddingBottom: "12px" }}>
                  <DeltaIcon size={18} strokeWidth={2.5} />
                  {delta == null
                    ? "indeks i ri — pa krahasim ende"
                    : `${delta > 0 ? "+" : ""}${delta} pikë krahasuar me 7 ditë më parë`}
                </div>
              </div>

              {/* The "as of" line the page never had. Numbers with no date on
                  them are the reason the staleness banner above exists. */}
              <p style={{ margin: "0 0 6px", fontSize: "13px", color: TONE_INK.muted, lineHeight: 1.6 }}>
                Nga <strong style={{ color: TONE_INK.strong }}>{summary.totalArticles}</strong> artikuj në{" "}
                <strong style={{ color: TONE_INK.strong }}>{withData.length}</strong> vende dhe{" "}
                <strong style={{ color: TONE_INK.strong }}>{summary.sourceCount}</strong> media
                {summary.lastUpdated && `, gjendja më ${summary.lastUpdated}`}
                {summary.daysTracked > 1 && ` · ${summary.daysTracked} ditë të ndjekura`}
                {pending > 0 && ` · ${pending} vende ende në pritje`}
              </p>
              <p style={{ margin: "0 0 32px", fontSize: "12.5px", color: TONE_INK.faint, lineHeight: 1.55, maxWidth: "70ch" }}>
                {NEUTRAL_IS_NORMAL}
              </p>

              {/* Chart card */}
              <div style={{ background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "16px", padding: "clamp(16px, 3vw, 28px)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: "40px" }}>
                <ToneLineChart history={history} />
              </div>

              {/* ── Topics ─────────────────────────────────────────────── */}
              {topics.length > 0 && (
                <div style={{ marginBottom: "48px" }}>
                  <SectionLabel label="Për Çfarë Po Shkruajnë" marginBottom={8} />
                  <p style={{ margin: "0 0 18px", maxWidth: "62ch", fontSize: "13.5px", color: TONE_INK.muted, lineHeight: 1.6 }}>
                    Temat janë grupuar automatikisht nga vetë titujt — jo kategori redaksie. Emri
                    i një teme është thjesht fjala më e shpeshtë brenda saj.
                  </p>
                  <div style={{ display: "grid", gap: "26px" }}>
                    {topics.map((t) => {
                      const countries = [...new Set(t.articles.map((a) => a.country))];
                      return (
                        <div key={t.label}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                            <span aria-hidden style={{ width: "14px", height: "14px", borderRadius: "4px", background: toneFill(t.index), flexShrink: 0 }} />
                            <h3 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: TONE_INK.strong, letterSpacing: "-0.01em" }}>
                              {t.label}
                            </h3>
                            <span style={{ fontSize: "13px", color: TONE_INK.muted }}>
                              {t.count} artikuj në {countries.length} {countries.length === 1 ? "vend" : "vende"} · toni{" "}
                              <strong style={{ color: TONE_INK.strong }}>{toneLabel(t.index).toLowerCase()}</strong>
                            </span>
                          </div>
                          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
                            {t.articles.slice(0, 4).map((a, i) => (
                              <ToneArticleCard key={`${a.url}-${i}`} a={a} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Per country ────────────────────────────────────────── */}
              <SectionLabel
                label={summary.isStale ? "Sipas Vendit" : "Sipas Vendit, Sot"}
                marginBottom={16}
              />
              <div style={{ display: "grid", gap: "10px", marginBottom: "48px" }}>
                {withData.map((c) => {
                  const coverage = coverageOf(c);
                  const excluded = c.excluded ?? 0;
                  const articles = articlesFor(c.country);
                  return (
                    <details
                      key={c.country}
                      className="toni-country"
                      style={{ background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "14px", padding: "14px 16px" }}
                    >
                      <summary style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 16px)", cursor: "pointer", listStyle: "none" }}>
                        <span style={{ fontSize: "17px", flexShrink: 0 }} aria-hidden>{c.flag}</span>
                        <span style={{ width: "clamp(88px, 20vw, 130px)", fontSize: "clamp(13px, 2.4vw, 15.5px)", fontWeight: 700, color: TONE_INK.strong, flexShrink: 0 }}>
                          {c.country}
                        </span>
                        {/* What the number rests on, next to the number. */}
                        <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: c.confident ? TONE_INK.faint : "#B8860B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {excluded > 0 ? `${c.n} nga ${c.n + excluded} artikuj` : `${c.n} artikuj`}
                          {!c.confident && ` · mbulim ${Math.round(coverage * 100)}%`}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "9px", flexShrink: 0 }}>
                          <span style={{ fontSize: "18px", fontWeight: 800, color: TONE_INK.strong, fontVariantNumeric: "tabular-nums" }}>
                            {c.index ?? "—"}
                          </span>
                          <span style={{ fontSize: "12.5px", color: TONE_INK.muted, whiteSpace: "nowrap", width: "clamp(60px, 17vw, 92px)" }}>
                            {toneLabel(c.index)}
                          </span>
                          <span aria-hidden style={{ width: "14px", height: "14px", borderRadius: "4px", background: toneFill(c.index), flexShrink: 0 }} />
                        </span>
                      </summary>

                      {/* Palette from the shared scale, not this page's old
                          red/green — those two were indistinguishable under
                          deuteranopia, which is why the scale exists. */}
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "12px 0", fontSize: "11.5px", fontWeight: 700 }}>
                        <span style={{ color: TONE_COLOR.positive }}>{c.positive}% pozitiv</span>
                        <span style={{ color: TONE_INK.muted }}>{c.neutral}% neutral</span>
                        <span style={{ color: TONE_COLOR.critical }}>{c.negative}% kritik</span>
                      </div>

                      {articles.length === 0 ? (
                        <p style={{ margin: 0, fontSize: "13px", color: TONE_INK.muted }}>
                          Ende nuk ka artikuj të ruajtur për këtë vend.
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {articles.slice(0, 8).map((a, i) => (
                            <ToneArticleCard key={`${a.url}-${i}`} a={a} />
                          ))}
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            </>
          )}

          {/* Methodology */}
          <div id="metodologjia" style={{ scrollMarginTop: "100px", marginBottom: "64px" }}>
            <SectionLabel label="Si e Llogarisim" marginBottom={16} />
            <div style={{ background: "#FAFAF8", border: "1px solid #E8E3DB", borderRadius: "16px", padding: "clamp(18px, 3vw, 28px)", fontSize: "13.5px", color: "#4A463F", lineHeight: 1.75 }}>
              <p style={{ margin: "0 0 14px", fontWeight: 700, color: TONE_INK.strong }}>
                Çfarë mat ky indeks — dhe çfarë jo:
              </p>
              <p style={{ margin: "0 0 16px" }}>
                Ky indeks mat <strong>qëndrimin e vetë mediumit ndaj Kosovës</strong>, jo nëse
                lajmi është i mirë apo i keq. Një raportim i thatë për një varrezë masive
                është <strong style={{ color: TONE_COLOR.neutral }}>neutral</strong>: lajmi është i rëndë,
                por mediumi thjesht po raporton. Po ashtu, kur një medium citon dikë që flet
                keq për Kosovën, ajo llogaritet te <em>folësi</em>, jo te mediumi — raportimi
                i një deklarate armiqësore është gazetari, jo armiqësi.
              </p>
              <ol style={{ margin: "0 0 16px", paddingLeft: "20px" }}>
                <li>Çdo dy orë, nga ora 07:00 deri në 23:00, mbledhim automatikisht artikuj rreth Kosovës nga Google News, në gjuhën lokale të {summary.countries.length} vendeve që ndjekim.</li>
                <li>Artikujt e përsëritur (p.sh. e njëjta lajme e agjencive AP/AFP/Reuters e ribotuar nga disa media) hiqen — llogariten vetëm një herë, që një lajm i vetëm të mos e shtrembërojë rezultatin.</li>
                <li>Mediat kosovare dhe shqiptare, si dhe burimet që nuk janë media (p.sh. faqe ushtarake apo sportive), nuk llogariten — ky është indeks i <em>shtypit të huaj</em>.</li>
                <li>Titulli dhe përmbledhja klasifikohen si <strong style={{ color: TONE_COLOR.positive }}>pozitiv</strong>, <strong style={{ color: TONE_COLOR.neutral }}>neutral</strong>, ose <strong style={{ color: TONE_COLOR.critical }}>kritik</strong> nga një model gjuhësor (Groq / Llama 3.3), jo nga një person. Modeli duhet të citojë fjalët e sakta të mediumit që e vendosin klasifikimin; pa ato fjalë, artikulli mbetet neutral. Ato fjalë i shihni te çdo artikull më lart.</li>
                <li>Artikujt që modeli nuk arrin t&apos;i lexojë me siguri shënohen si të pazgjidhur dhe <strong>përjashtohen</strong> nga llogaritja — nuk hamendësohen.</li>
                <li>Indeksi i një vendi = 50 + 50 × (pozitivë − kritikë) / totali. 50 do të thotë e balancuar; mbi 50 anon nga pozitivja, nën 50 nga kritika.</li>
                <li>Indeksi i përgjithshëm është mesatarja e vendeve, peshuar sipas numrit të artikujve të secilit — një vend me shumë mbulim ndikon më shumë se një me pak.</li>
                <li>Temat te &quot;Për çfarë po shkruajnë&quot; grupohen automatikisht nga fjalët e përsëritura në tituj. Janë përmbledhje, jo kategori redaksie.</li>
              </ol>
              <p style={{ margin: "0 0 8px", fontWeight: 700, color: TONE_INK.strong }}>Kufizimet — thënë hapur:</p>
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                <li>Shumica e artikujve janë neutralë, dhe kjo është normale — gazetaria raporton, nuk mban anë. Prandaj indeksi qëndron afër 50 dhe lëviz ngadalë.</li>
                <li>Harta e ngjyros vendet në shkallën {BAND.lo}–{BAND.hi}, jo 0–100. Pa këtë ngushtim të gjitha vendet do të dilnin me të njëjtën ngjyrë gri.</li>
                <li>Klasifikimi bazohet te titulli dhe përmbledhja e RSS-së, jo gjithmonë artikulli i plotë.</li>
                <li>Google News RSS nuk mbulon çdo botim (p.sh. artikuj pas paywall-i mund të mungojnë).</li>
                <li>
                  Një vend shënohet me <strong>&quot;mbulim i pjesshëm&quot;</strong> — dhe vizatohet
                  me vija të pjerrëta në hartë — kur ka nën 8 artikuj të klasifikuar, ose kur
                  ata përbëjnë më pak se 40% të gjithçkaje që u mblodh për të. Pa këtë, një
                  indeks i ndërtuar mbi 5 nga 75 artikuj dukej njësoj i sigurt sa një i
                  ndërtuar mbi 77 nga 77.
                </li>
                <li>Më 2026-08-10 ndryshuam mënyrën e llogaritjes: më parë indeksi matte nëse lajmi ishte i mirë apo i keq. Ditët para kësaj date janë llogaritur me metodën e vjetër dhe nuk krahasohen drejtpërdrejt me ditët pas saj.</li>
              </ul>
              <p style={{ margin: "16px 0 0", fontSize: "12px", color: TONE_INK.faint }}>
                Të dhënat e papërpunuara janë publike:{" "}
                <a href="/tone-outlets.json" style={{ color: TONE_INK.muted, textDecoration: "underline" }}>
                  tone-outlets.json
                </a>{" "}
                ·{" "}
                <a href="/tone-history.json" style={{ color: TONE_INK.muted, textDecoration: "underline" }}>
                  tone-history.json
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
