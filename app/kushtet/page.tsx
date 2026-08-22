import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Kushtet e përdorimit",
  description:
    "Rregullat e përdorimit të 383: llogaria, monedhat virtuale të Tregut, e drejta e autorit, përgjegjësia dhe ligji zbatues.",
};

const UPDATED = "22 gusht 2026";
const CONTACT = "info@383media.com";

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-10">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="text-[0.85rem] font-bold tabular-nums text-orange" aria-hidden>
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-[0.95rem] leading-[1.7] text-[#565656]">{children}</div>
    </section>
  );
}

export default function KushtetPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-32 sm:px-6 sm:pt-40">
          <p className="mb-5 flex items-center gap-3 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-muted">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-orange" aria-hidden />
            Përditësuar më {UPDATED}
          </p>
          <h1 className="max-w-[18ch] text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[4rem]">
            Kushtet e përdorimit
          </h1>
          <p className="mt-7 max-w-[62ch] text-[1.05rem] leading-[1.7] text-[#565656]">
            Këto kushte rregullojnë përdorimin e 383 (www.383ks.com). Duke përdorur faqen, i
            pranon. Pyetje?{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-orange underline underline-offset-4">
              {CONTACT}
            </a>
            .
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl space-y-12 px-5 pb-24 pt-14 sm:px-6">
        <Section index={1} title="Lajmet dhe përmbajtja">
          <p>
            Përmbajtja e 383 është për informim. Bëjmë përpjekje të mira që lajmet të jenë të
            sakta dhe të verifikuara, por faqen ofrojmë “as siç është” — nuk garantojmë që
            çdo informacion të jetë i plotë ose i përditësuar në çdo moment. Vendoset biznesi,
            udhëtimi ose shëndeti në bazë të një burimi të vetëm nuk duhet.
          </p>
          <p>
            Veglat e emergjencës te /visit të lidhin me numrat zyrtarë (112, 192, 193, 194). 383
            nuk është shërbim urgjence dhe nuk dërgon ndihmë.
          </p>
        </Section>

        <Section index={2} title="Llogaria">
          <p>
            Mund të lexosh pa llogari. Për të hyrë duhet të jesh të paktën 16 vjeç dhe të dhënat
            e regjistrimit t’i mbash të sakta. Je përgjegjës për ruajtjen e fjalëkalimit tënd.
          </p>
        </Section>

        <Section index={3} title="Monedhat virtuale dhe Tregu 383">
          <p>
            Monedhat 383C janë njësi virtuale për lojë dhe mësim brenda Tregut.{" "}
            <strong className="font-bold text-ink">
              Nuk kanë vlerë monetare jashtë platformës.
            </strong>{" "}
            Programi i shkëmbimit të monedhave në euro është një program opsional që administrohet
            manualisht nga 383, funksionon sipas rregullave të publikuara dhe mund të ndalet,
            kufizohet ose modifikohet në çdo kohë.
          </p>
          <p>
            Bastet, shitjet dhe pozicionet janë simulime. Ato nuk janë investim, këshillë
            financiare apo lojë me para reale.
          </p>
        </Section>

        <Section index={4} title="Sjellja">
          <p>
            Komentet dhe ndërveprimet publike duhet të jenë ligjore dhe me respekt. Ndalohen
            ngacmimi, përhapja e përmbajtjes false, tentativat për manipulim tregjesh dhe
            krijimi i llogarive të shumëfishta për abuzim. Shkelja mund të sjellë heqjen e
            përmbajtjes ose pezullimin e llogarisë.
          </p>
        </Section>

        <Section index={5} title="E drejta e autorit">
          <p>
            Tekstet, grafikat dhe kodin e faqes i zotëron 383 ose i ka licencuar. Citimet dhe
            ndarjet me lidhje janë mirëseardhur; riprodhimi i plotë pa leje jo. Imazhet
            përdoren sipas licencave të burimeve të tyre.
          </p>
        </Section>

        <Section index={6} title="Përgjegjësia">
          <p>
            Sa lejon ligji, 383 nuk mbart përgjegjësi për dëme të humbjeve të fitojve, të dhënave
            ose reputacionit që rrjedhin nga përdorimi i faqes. Nuk jemi përgjegjës për
            përmbajtjen e faqeve të jashtme ku lidhemi.
          </p>
        </Section>

        <Section index={7} title="Ligji zbatues">
          <p>
            Këto kushte rregullohen nga ligjet e Republikës së Kosovës. Si i trajtojmë të
            dhënat e tua lexoj te{" "}
            <Link href="/privatesia" className="font-semibold text-orange underline underline-offset-4">
              Politika e privatësisë
            </Link>
            .
          </p>
        </Section>

        <Section index={8} title="Ndryshimet">
          <p>
            Mund t’i përditësojmë këto kushte; datën lart e rifreskojmë kur ndodh. Vazhdimi i
            përdorimit pas një ndryshimi do të thotë pranim i tij.
          </p>
        </Section>
      </main>

      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <div className="border-t border-border pb-20 pt-8">
          <Link href="/" className="text-[0.9rem] font-semibold text-ink transition-colors hover:text-orange">
            ← Kthehu në ballinë
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
