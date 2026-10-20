import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import InfoContents from "@/components/info-contents";
import styles from "@/components/info-pages.module.css";

export const metadata: Metadata = {
  title: "Kushtet e përdorimit",
  description:
    "Rregullat e përdorimit të 383: llogaria, monedhat virtuale të Tregut, e drejta e autorit, përgjegjësia dhe ligji zbatues.",
};

const UPDATED = "20 tetor 2026";
const CONTACT = "info@383ks.com";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-border pt-10">
      <div className="mb-6 flex items-baseline gap-4">

        <h2 className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-[1rem] leading-[1.7] text-[#565656]">{children}</div>
    </section>
  );
}

export default function KushtetPage() {
  return (
    <div className={`min-h-screen ${styles.page}`}>
      <a href="#permbajtja" className={styles.skip}>Kalo te përmbajtja</a>
      <Navbar />
      <main id="permbajtja">

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
              383 është këtu për të të informuar dhe për të të përfshirë. Këto kushte shpjegojnë
              si funksionon platforma dhe çfarë presim nga njëri-tjetri. Duke e përdorur, i pranon këto kushte. Për çdo paqartësi, na shkruaj:{" "}
              <a href={`mailto:${CONTACT}`} className="font-semibold text-orange underline underline-offset-4">
                {CONTACT}
              </a>
              .
            </p>
          </div>
        </section>

        <InfoContents sections={[{"id": "lajmet", "title": "Lajmet dhe përmbajtja"}, {"id": "llogaria", "title": "Llogaria"}, {"id": "tregu", "title": "Monedhat virtuale dhe Tregu 383"}, {"id": "sjellja", "title": "Biseda me respekt"}, {"id": "autori", "title": "Ndarja e përmbajtjes"}, {"id": "pergjegjesia", "title": "Përdorimi me kujdes"}, {"id": "ligji", "title": "Ligji zbatues"}, {"id": "ndryshimet", "title": "Ndryshimet"}]} />

        <div className="mx-auto max-w-3xl space-y-12 px-5 pb-24 pt-14 sm:px-6">
          <Section id="lajmet" title="Lajmet dhe përmbajtja">
            <p>
              Lajmet dhe mjetet e 383 janë për informim. Punojmë që informacioni të jetë i saktë,
              por ngjarjet ndryshojnë dhe mund të ketë gabime ose vonesa në përditësim. Nëse vëren
              diçka të pasaktë, na ndihmo duke e raportuar te faqja e kontaktit. Për vendime që
              lidhen me shëndetin, financat ose udhëtimin, kontrollo edhe burimet zyrtare përkatëse.
            </p>
            <p>
              Te Kosova në xhep gjen numrat zyrtarë të emergjencës. Në rast urgjence, telefono
              drejtpërdrejt shërbimin përkatës; 383 nuk mund të dërgojë ndihmë.
            </p>
          </Section>

          <Section id="llogaria" title="Llogaria">
            <p>
              Lajmet mund t’i lexosh pa llogari. Për të hapur llogari duhet të jesh të paktën
              16 vjeç. Përdor të dhëna të sakta dhe ruaje fjalëkalimin tënd. Nëse ke vështirësi me
              hyrjen ose dyshon se dikush po përdor llogarinë tënde, na shkruaj që të të ndihmojmë.
            </p>
          </Section>

          <Section id="tregu" title="Monedhat virtuale dhe Tregu 383">
            <p>
              Monedhat 383C përdoren për parashikime dhe mësim brenda Tregut.{" "}
              <strong className="font-bold text-ink">
                Nuk kanë vlerë monetare jashtë platformës.
              </strong>{" "}
              Programi i shkëmbimit të monedhave në euro është një program opsional që administrohet
              manualisht nga 383, funksionon sipas rregullave të publikuara dhe mund të ndryshohet,
              kufizohet ose ndalet. Para se të marrësh pjesë, lexo rregullat e publikuara të programit.
            </p>
            <p>
              Blerjet, shitjet dhe pozicionet në Treg janë simulime. Ato nuk janë investim, këshillë
              financiare apo lojë me para reale.
            </p>
          </Section>

          <Section id="sjellja" title="Biseda me respekt">
            <p>
              Mendimet e ndryshme janë të mirëseardhura. Kërkojmë që bisedat të jenë me respekt
              dhe në përputhje me ligjin. Ngacmimi, përhapja e qëllimshme e informacionit të rremë
              dhe manipulimi i Tregut dëmtojnë pjesëmarrësit e tjerë. Për të mbrojtur komunitetin,
              mund të heqim përmbajtje ose të pezullojmë llogari që abuzojnë me platformën,
              përfshirë përdorimin e disa llogarive për të përfituar padrejtësisht.
            </p>
          </Section>

          <Section id="autori" title="Ndarja e përmbajtjes">
            <p>
              Je i mirëpritur të ndash lidhjet e artikujve dhe të citosh pjesë të shkurtra, duke
              përmendur burimin. Për ripublikim të plotë ose përdorim tjetër të materialeve tona,
              na shkruaj për leje. Tekstet, grafikat dhe kodi i përkasin 383 ose përdoren me
              licencë; materialet e burimeve të tjera ruajnë të drejtat përkatëse.
            </p>
          </Section>

          <Section id="pergjegjesia" title="Përdorimi me kujdes">
            <p>
              Përpiqemi ta mbajmë faqen të dobishme dhe të qëndrueshme. Megjithatë, mund të ketë
              ndërprerje ose pasaktësi. Brenda kufijve që lejon ligji, 383 nuk mban përgjegjësi
              për humbje fitimi, të dhënash ose reputacioni që rrjedhin nga përdorimi i faqes.
              Lidhjet e jashtme të ndihmojnë të gjesh burime të tjera, por përmbajtjen e atyre
              faqeve e menaxhojnë ofruesit e tyre.
            </p>
          </Section>

          <Section id="ligji" title="Ligji zbatues">
            <p>
              Këto kushte rregullohen nga ligjet e Republikës së Kosovës. Si i trajtojmë të
              dhënat e tua, lexo te{" "}
              <Link href="/privatesia" className="font-semibold text-orange underline underline-offset-4">
                Politika e privatësisë
              </Link>
              .
            </p>
          </Section>

          <Section id="ndryshimet" title="Ndryshimet">
            <p>
              Kur këto kushte ndryshojnë, përditësojmë datën në krye të faqes që të mund ta shohësh
              versionin e fundit. Vazhdimi i përdorimit pas ndryshimit do të thotë se i pranon
              kushtet e përditësuara. Nëse një pjesë të duket e paqartë, mund të na kërkosh shpjegim.
            </p>
          </Section>
        </div>

        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <div className="border-t border-border pb-20 pt-8">
            <Link href="/" className="text-[0.9rem] font-semibold text-ink transition-colors hover:text-orange">
              ← Kthehu në ballinë
            </Link>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
