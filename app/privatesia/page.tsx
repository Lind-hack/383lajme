import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import InfoContents from "@/components/info-contents";
import styles from "@/components/info-pages.module.css";

// Public and unauthenticated on purpose: Meta's crawler has to fetch this URL
// before the Facebook app can go Live, and the footer links it from every page.
export const metadata: Metadata = {
  title: "Politika e privatësisë",
  description:
    "Si i mbledh, përdor dhe ruan 383 të dhënat e tua personale. Llogaria, Tregu, tërheqjet, cookies dhe të drejtat e tua.",
};

const UPDATED = "20 tetor 2026";
const CONTACT = "info@383ks.com";

const SECTIONS = [
  { id: "kush-jemi", title: "Kush jemi" },
  { id: "cfare-mbledhim", title: "Çfarë të dhënash mbledhim" },
  { id: "pse", title: "Pse i përdorim" },
  { id: "ndarja", title: "Me kë i ndajmë" },
  { id: "cookies", title: "Cookies" },
  { id: "ruajtja", title: "Sa gjatë i ruajmë" },
  { id: "te-drejtat", title: "Të drejtat e tua" },
  { id: "fshirja", title: "Fshirja e llogarisë" },
  { id: "femijet", title: "Mosha" },
  { id: "ndryshimet", title: "Ndryshimet" },
  { id: "kontakt", title: "Kontakt" },
];

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
      <div className="space-y-4 text-[1rem] leading-[1.75] text-[#565656]">{children}</div>
    </section>
  );
}

/** Label + value row for the data inventory. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-4 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <div className="text-[0.9rem] font-bold tracking-[-0.01em] text-ink">{label}</div>
      <div className="text-[1rem] leading-[1.7] text-[#565656]">{children}</div>
    </div>
  );
}

function MailLink() {
  return (
    <a href={`mailto:${CONTACT}`} className="font-semibold text-orange underline underline-offset-4">
      {CONTACT}
    </a>
  );
}

export default function PrivatesiaPage() {
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
            <h1 className="max-w-[16ch] text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[4rem]">
              Politika e privatësisë
            </h1>
            <p className="mt-7 max-w-[62ch] text-[1.05rem] leading-[1.7] text-[#565656]">
              Këtu gjen si i përdorim të dhënat e tua dhe çfarë zgjedhjesh ke.
              Për pyetje ose ndihmë, na shkruaj te{" "}
              <MailLink />.
            </p>
          </div>
        </section>

        <div className={styles.summary}>
          <p><strong>Ti zgjedh si e përdor 383.</strong> Lexo pa llogari, abono emailin vetëm nëse dëshiron dhe vendos vetë nëse lejon statistikat. Më poshtë shpjegojmë çfarë ruajmë dhe si mund të na kërkosh ndihmë.</p>
        </div>
        <InfoContents sections={SECTIONS} />

        <div className="mx-auto max-w-3xl space-y-12 px-5 pb-24 pt-14 sm:px-6">
          <Section id="kush-jemi" title="Kush jemi">
            <p>
              383 është një platformë lajmesh nga Kosova, me seli në Prishtinë. Ne jemi kontrolluesi
              i të dhënave për gjithçka që mbledhim përmes kësaj faqeje, sipas Ligjit Nr. 06/L-082
              për Mbrojtjen e të Dhënave Personale.
            </p>
            <p>
              Mund të lexosh lajmet pa llogari. Kur zgjedh të regjistrohesh,
              të përdorësh Tregun ose të marrësh përmbledhjen javore, ruajmë të dhënat që duhen
              për këto shërbime. Regjistrat teknikë dhe statistikat me pëlqim shpjegohen më poshtë.
            </p>
          </Section>

          <Section id="cfare-mbledhim" title="Çfarë të dhënash mbledhim">
            <div className="mt-1">
              <Row label="Përmbledhja javore">
                Kur klikon «Abonohu»: emailin, kohën e abonimit dhe
                çregjistrimit, versionin e pëlqimit dhe statusin teknik të dërgesave. Për të kufizuar
                abuzimin mbajmë përkohësisht një shenjë të koduar të adresës IP, jo IP-në e plotë.
                Abonimi është i veçantë nga llogaria dhe nga zgjedhja e interesave.
              </Row>
              <Row label="Llogaria">
                Adresën e emailit, emrin e shfaqur dhe fjalëkalimin. Fjalëkalimi nuk ruhet asnjëherë
                si tekst — ruhet si një gjurmë e pakthyeshme (hash) në sistemin e llogarive dhe as ne nuk e shohim dot.
              </Row>
              <Row label="Hyrja me Google ose Facebook">
                Nëse hyn me Google ose Facebook, marrim nga ata emailin, emrin dhe foton publike të
                profilit. Asgjë tjetër: nuk lexojmë listën e miqve, nuk shohim postimet e tua dhe nuk
                postojmë kurrë në emrin tënd.
              </Row>
              <Row label="Tregu">
                Monedhat virtuale, parashikimet dhe pozicionet e hapura, historikun e transaksioneve dhe
                bonuset ditore. Kjo është e nevojshme që Tregu të funksionojë.
              </Row>
              <Row label="Tërheqjet">
                Kur kërkon të konvertosh monedhat në euro, ruajmë shumën dhe metodën e pagesës që
                shkruan vetë — adresën e PayPal-it ose numrin e llogarisë bankare (IBAN). Këto janë
                të dhëna financiare: i përdorim vetëm për të kryer pagesën dhe për detyrimet
                kontabël, dhe i sheh vetëm ekipi që përpunon tërheqjet.
              </Row>
              <Row label="Të dhëna teknike">
                Adresën IP, llojin e shfletuesit dhe kohën e kërkesës — të regjistruara automatikisht
                nga serverët tanë. I përdorim për siguri dhe për të kuptuar defektet, jo për të të
                ndjekur nëpër internet.
              </Row>
            </div>
          </Section>

          <Section id="pse" title="Pse i përdorim">
            <p>
              <strong className="font-bold text-ink">Përmbledhja javore</strong> — me pëlqimin tënd,
              dërgojmë lajmet kryesore çdo të diel në orën 10:00, sipas orës së Kosovës. Çdo email ka lidhje çregjistrimi pa hyrje në
              llogari. Abonimi aktivizohet menjëherë, pa email ose kod konfirmimi.
              Pas çregjistrimit ruajmë vetëm të dhënat e
              nevojshme për të mos të dërguar përsëri pa një kërkesë të re abonimi. Për fshirjen e tyre,
              na shkruaj te <MailLink />.
            </p>
            <p>
              <strong className="font-bold text-ink">Për të mbajtur llogarinë tënde</strong> — hyrje,
              konfirmim emaili, rikuperim fjalëkalimi. Këto të dhëna na duhen për të ofruar shërbimet e llogarisë.
            </p>
            <p>
              <strong className="font-bold text-ink">Për të mbajtur Tregun</strong> — balanca,
              parashikimet dhe tërheqjet na duhen për të menaxhuar pjesëmarrjen tënde.
            </p>
            <p>
              <strong className="font-bold text-ink">Për siguri</strong> — për të ndaluar llogaritë e
              rreme, abuzimin dhe manipulimin e tregjeve. Për llogarinë kërkojmë një email të vlefshëm dhe
              të konfirmuar; përmbledhja javore ka një abonim të veçantë, pa hapur llogari.
            </p>
            <p>
              Nuk shesim të dhënat e tua. Nuk i japim për reklama. Nuk ndërtojmë profile
              reklamuese.
            </p>
          </Section>

          <Section id="ndarja" title="Me kë i ndajmë">
            <p>
              Për të mbajtur faqen në këmbë përdorim disa shërbime. Më poshtë shpjegojmë rolin e secilit
              dhe të dhënat që përpunon për shërbimin:
            </p>
            <div className="mt-1">
              <Row label="Supabase">
                Baza e të dhënave dhe sistemi i llogarive. Këtu ruhen emaili, gjurma e fjalëkalimit
                dhe të dhënat e Tregut.
              </Row>
              <Row label="Railway">
                Hosting. Shërben faqen dhe mban regjistrat teknikë të serverit.
              </Row>
              <Row label="Resend dhe Gmail — përmbledhja javore">
                Përmbledhjen javore e dërgojmë përmes Gmail. Resend mbetet ofrues alternativ
                që mund të përdoret sipas konfigurimit të shërbimit. Ofruesi merr adresën e emailit
                dhe përmbajtjen e mesazhit. Nuk shtojmë pikselë matës në përmbledhje; matjen e
                hapjeve dhe klikimeve e mbajmë të çaktivizuar edhe te ofruesi i emailit.
              </Row>
              <Row label="Brevo">
                Dërgimi i emaileve — konfirmimi i llogarisë dhe rikuperimi i fjalëkalimit. Merr vetëm
                adresën e emailit.
              </Row>
              <Row label="Google Analytics">
                Vetëm nëse pranon cookies për statistika. Mban të dhëna të përdorimit — faqet,
                kohën dhe vendin e përafërt — për statistikat e përgjithshme të faqes. Këto matje nuk i lidhim me llogarinë tënde në 383.
              </Row>
              <Row label="Microsoft Clarity">
                Vetëm nëse pranon cookies për statistika. Analizon klikimet, lëvizjen në faqe
                dhe regjistrimet e sesioneve për të përmirësuar përvojën. Të dhënat e ndjeshme
                maskohen; nuk i dërgojmë emrin ose emailin e llogarisë.
              </Row>
              <Row label="Statistikat e veçorive 383">
                Vetëm pasi pranon statistikat, numërojmë hapjet e faqeve, klikimet në kontrolle dhe
                kohën aktive. Përdorim një shenjë të rastësishme të shfletuesit, të koduar në server,
                pa e lidhur me llogarinë. Nuk ruajmë tekst formularësh, adresa IP ose përmbajtjen e
                butonave. Matjet fshihen pas shtatë ditësh dhe përmblidhen në raportin ditor.
              </Row>
              <Row label="Google dhe Meta">
                Vetëm nëse zgjedh të hysh me llogarinë tënde Google ose Facebook. Në atë rast ata e
                dinë që ke hyrë në 383.
              </Row>
            </div>
            <p>
              I japim të dhënat edhe kur na detyron ligji ose një vendim gjykate — dhe vetëm atëherë.
            </p>
          </Section>

          <Section id="cookies" title="Cookies">
            <p>
              Cookies thelbësore mbajnë sesionin tënd të hapur pasi hyn. Ato ndihmojnë që
              të mos të duhet të identifikohesh sërish sa herë ndryshon faqe.
            </p>
            <p>
              Për statistika përdorim Google Analytics dhe Microsoft Clarity — por <strong className="font-bold text-ink">vetëm
              nëse e pranon</strong> te banderola e cookies. Kur pranon, regjistrohen të dhëna të përdorimit:
              cilat faqe lexohen, sa zgjasin dhe vendi i përafërt. Adresa jote IP anonimizohet para se
              të ruhet nga Google Analytics. Clarity analizon edhe klikimet, lëvizjen në faqe dhe
              regjistrimet e sesioneve, me të dhënat e ndjeshme të maskuara. Clarity merr leje për
              statistika, ndërsa leja për cookies reklamimi mbetet e refuzuar.
            </p>
            <p>
              Zgjedhja jote ruhet vetëm në shfletuesin tënd. Nëse e ndryshon mendjen, fshi të dhënat e
              faqes nga shfletuesi — banderola do të të pyesë sërish herën tjetër.
            </p>
          </Section>

          <Section id="ruajtja" title="Sa gjatë i ruajmë">
            <p>
              Të dhënat e llogarisë ruhen për aq kohë sa llogaria është e hapur. Kur e fshin
              llogarinë, i fshijmë brenda 30 ditësh.
            </p>
            <p>
              Përjashtim bëjnë të dhënat e tërheqjeve. Kur një pagesë është kryer, të dhënat e saj
              ruhen sa kërkon ligji për dokumentet financiare, edhe pasi llogaria të jetë fshirë.
            </p>
          </Section>

          <Section id="te-drejtat" title="Të drejtat e tua">
            <p>Sipas ligjit të Kosovës për mbrojtjen e të dhënave, ke të drejtë:</p>
            <ul className="ml-1 space-y-2">
              {[
                "Të kërkosh një kopje të të gjitha të dhënave që mbajmë për ty.",
                "Të korrigjosh çdo të dhënë të pasaktë.",
                "Të fshish llogarinë dhe të dhënat e saj.",
                "Të kundërshtosh mënyrën se si i përpunojmë.",
                "Të ankohesh te Agjencia për Informim dhe Privatësi.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-[0.6rem] h-[5px] w-[5px] shrink-0 rounded-full bg-orange" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p>
              Për të gjitha këto, na shkruaj te <MailLink />. Përgjigjemi brenda 30 ditësh.
            </p>
          </Section>

          <Section id="fshirja" title="Fshirja e llogarisë">
            <p>
              Dërgo një email nga adresa me të cilën je regjistruar te <MailLink /> me temën “Fshirje
              llogarie”. E fshijmë brenda 30 ditësh dhe të konfirmojmë me email.
            </p>
            <p>
              Kjo vlen edhe nëse je regjistruar me Facebook ose Google — nuk të duhet të kalosh
              nëpër ta.
            </p>
            <p className="text-[0.9rem] text-muted">
              Fshirja mbyll edhe balancën e monedhave virtuale; ajo nuk rikthehet më pas.
              Nëse ke një tërheqje në proces, na shkruaj para se të kërkosh fshirjen.
            </p>
          </Section>

          <Section id="femijet" title="Mosha">
            <p>
              Për të hapur llogari në 383 duhet të jesh të paktën 16 vjeç. Kjo kërkesë lidhet
              me shërbimet e llogarisë. Nëse zbulojmë një llogari të hapur nga dikush nën këtë
              moshë, e fshijmë për të mbrojtur të dhënat e tij.
            </p>
          </Section>

          <Section id="ndryshimet" title="Ndryshimet">
            <p>
              Nëse e ndryshojmë këtë politikë, e përditësojmë datën lart. Për ndryshime që prekin
              vërtet mënyrën si i përdorim të dhënat e tua, të njoftojmë me email para se të hyjnë në
              fuqi.
            </p>
          </Section>

          <Section id="kontakt" title="Kontakt">
            <p>
              383 — Prishtinë, Kosovë
              <br />
              <MailLink />
            </p>
            <p>
              Ke të drejtë të ankohesh edhe te Agjencia për Informim dhe Privatësi e Republikës së
              Kosovës.
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
