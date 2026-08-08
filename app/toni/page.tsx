import type { Metadata } from "next";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import SectionLabel from "@/components/section-label";
import ToneLineChart from "@/components/tone/tone-line-chart";
import { getToneHistory, summarizeToneHistory } from "@/lib/tone-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Toni i Mediave Botërore ndaj Kosovës",
  description:
    "Si e trajtojnë Kosovën mediat në Gjermani, SHBA, Britani, Francë dhe Itali — indeks ditor, i mbledhur dhe llogaritur nga artikuj të vërtetë, jo vlerësim subjektiv.",
};

function flagToCode(flag: string): string {
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return "";
  const a = cps[0] - 0x1f1e6 + 65;
  const b = cps[1] - 0x1f1e6 + 65;
  return String.fromCharCode(a, b);
}

export default async function ToniPage() {
  const history = await getToneHistory();
  const summary = summarizeToneHistory(history);

  const DeltaIcon =
    summary.weekDelta == null ? Minus : summary.weekDelta > 0 ? TrendingUp : summary.weekDelta < 0 ? TrendingDown : Minus;
  const deltaColor =
    summary.weekDelta == null || summary.weekDelta === 0 ? "#9CA3AF" : summary.weekDelta > 0 ? "#16A34A" : "#E41E20";

  return (
    <>
      <TextureBg />
      <Navbar />

      <main style={{ position: "relative", zIndex: 1, paddingTop: "calc(var(--nav-h) + 48px)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FF4422" }}>
            Ekskluzive 383
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "#111111", lineHeight: 1.15 }}>
            Toni i Mediave Botërore ndaj Kosovës
          </h1>
          <p style={{ margin: "0 0 40px", maxWidth: "62ch", fontSize: "15px", color: "#5F5B56", lineHeight: 1.6 }}>
            Çdo ditë mbledhim artikuj rreth Kosovës nga media në Gjermani, SHBA, Britani, Francë
            dhe Itali, dhe llogarisim se sa pozitivisht, neutralisht apo kritikisht e trajtojnë vendin.
            Ky është indeksi i vetëm i këtij lloji për Kosovën në rajon.
          </p>

          {!summary.hasData ? (
            <div style={{ background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "16px", padding: "40px", fontSize: "14px", color: "#6B6B6B" }}>
              Analiza po ndërtohet — te dhënat e para do të shfaqen pas mbledhjes ditore të parë.
            </div>
          ) : (
            <>
              {/* Hero stat row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-end", marginBottom: "28px" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>
                    Indeksi Sotëm
                  </p>
                  <span style={{ fontSize: "clamp(52px, 8vw, 76px)", fontWeight: 800, color: "#111111", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {summary.overallIndex}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700, color: deltaColor, paddingBottom: "12px" }}>
                  <DeltaIcon size={18} strokeWidth={2.5} />
                  {summary.weekDelta == null
                    ? "indeks i ri — pa krahasim ende"
                    : `${summary.weekDelta > 0 ? "+" : ""}${summary.weekDelta} pikë krahasuar me 7 ditë më parë`}
                </div>
              </div>

              {/* Chart card */}
              <div style={{ background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "16px", padding: "clamp(16px, 3vw, 28px)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", marginBottom: "40px" }}>
                <ToneLineChart history={history} />
              </div>

              {/* Country cards */}
              <SectionLabel label="Sipas Vendit, Sot" marginBottom={16} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "48px" }}>
                {summary.countries.map((c) => (
                  <div key={c.country} style={{ background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "16px" }}>{c.flag}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#111111" }}>{c.country}</span>
                      <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, color: "#B4B0A6" }}>
                        {flagToCode(c.flag)}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: 800, color: "#111111", fontVariantNumeric: "tabular-nums" }}>
                      {c.index ?? "—"}
                    </p>
                    <div style={{ display: "flex", gap: "6px", fontSize: "10.5px", fontWeight: 700 }}>
                      <span style={{ color: "#16A34A" }}>{c.positive}%</span>
                      <span style={{ color: "#9CA3AF" }}>{c.neutral}%</span>
                      <span style={{ color: "#E41E20" }}>{c.negative}%</span>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: "10px", color: c.confident ? "#B4B0A6" : "#B8860B" }}>
                      {c.n} artikuj{!c.confident && " · pak të dhëna"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Methodology */}
          <div id="metodologjia" style={{ scrollMarginTop: "100px", marginBottom: "64px" }}>
            <SectionLabel label="Si e Llogarisim" marginBottom={16} />
            <div style={{ background: "#FAFAF8", border: "1px solid #E8E3DB", borderRadius: "16px", padding: "clamp(18px, 3vw, 28px)", fontSize: "13.5px", color: "#4A463F", lineHeight: 1.75 }}>
              <ol style={{ margin: "0 0 16px", paddingLeft: "20px" }}>
                <li>Çdo ditë mbledhim automatikisht artikuj rreth Kosovës nga Google News, në gjuhën lokale të 5 vendeve: Gjermani, SHBA, Britani, Francë, Itali.</li>
                <li>Artikujt e përsëritur (p.sh. e njëjta lajme e agjencive AP/AFP/Reuters e ribotuar nga disa media) hiqen — llogariten vetëm një herë, që një lajm i vetëm të mos e shtrembërojë rezultatin.</li>
                <li>Titulli dhe përmbledhja e çdo artikulli klasifikohen si <strong style={{ color: "#16A34A" }}>pozitiv</strong>, <strong style={{ color: "#9CA3AF" }}>neutral</strong>, ose <strong style={{ color: "#E41E20" }}>kritik</strong> nga një model gjuhësor (Groq / Llama), jo nga një person.</li>
                <li>Indeksi i një vendi = 50 + 50 × (pozitivë − kritikë) / totali. 50 do të thotë e balancuar; mbi 50 anon nga pozitivja, nën 50 nga kritika.</li>
                <li>Indeksi i përgjithshëm është mesatarja e 5 vendeve, peshuar sipas numrit të artikujve të secilit — një vend me shumë mbulim ndikon më shumë se një me pak.</li>
              </ol>
              <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#111111" }}>Kufizimet — thënë hapur:</p>
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                <li>Klasifikimi bazohet te titulli dhe përmbledhja e RSS-së, jo gjithmonë artikulli i plotë.</li>
                <li>Google News RSS nuk mbulon çdo botim (p.sh. artikuj pas paywall-i mund të mungojnë).</li>
                <li>Ditët me pak artikuj për një vend (nën 8) shënohen si &quot;pak të dhëna&quot; — merrini me rezervë.</li>
                <li>Mbledhja bëhet një herë në ditë, jo në kohë reale.</li>
              </ul>
              <p style={{ margin: "16px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                Të dhënat e papërpunuara janë publike:{" "}
                <a href="/tone-outlets.json" style={{ color: "#6B6B6B", textDecoration: "underline" }}>
                  tone-outlets.json
                </a>{" "}
                ·{" "}
                <a href="/tone-history.json" style={{ color: "#6B6B6B", textDecoration: "underline" }}>
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
