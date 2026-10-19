import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowUpRight, ShieldCheck, Briefcase, PencilLine } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import ContactEmailCopy from "@/components/contact-email-copy";
import styles from "@/components/info-pages.module.css";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Kontakto 383: lajme dhe sugjerime, korrigjime, bashkëpunime biznesi. info@383media.com",
};

const CONTACT = "info@383media.com";

const REASONS = [
  {
    icon: PencilLine,
    title: "Lajme dhe sugjerime",
    body: "Na trego çfarë po ndodh dhe pse ka rëndësi. Nëse ke lidhje ose dokumente që ndihmojnë, përfshiji në mesazh.",
  },
  {
    icon: ShieldCheck,
    title: "Korrigjime",
    body: "Na dërgo lidhjen e artikullit dhe shpjego çfarë duhet rishikuar. I trajtojmë me prioritet gabimet dhe i shënojmë korrigjimet.",
  },
  {
    icon: Briefcase,
    title: "Biznese dhe partneritete",
    body: "Na trego për biznesin tënd dhe llojin e bashkëpunimit që ke në mendje, përfshirë reklamat ose përmbajtjen e sponsorizuar.",
  },
];

export default function KontaktPage() {
  return (
    <div className={`min-h-screen ${styles.page}`}>
      <a href="#permbajtja" className={styles.skip}>Kalo te përmbajtja</a>
      <Navbar />
      <main id="permbajtja">

        {/* Split hero: promise left, the address itself as the display object right */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-32 sm:px-6 sm:pt-40 lg:grid-cols-[6fr_6fr] lg:items-center">
          <div>

            <h1 className="text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[4rem]">
              Le të flasim.
            </h1>
            <p className="mt-7 max-w-[46ch] text-[1.05rem] leading-[1.7] text-[#565656]">
              Ke një sugjerim, një pyetje apo një histori për të ndarë? Na shkruaj drejtpërdrejt.
              Synojmë të përgjigjemi brenda disa ditësh pune.
            </p>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rotate-[1deg] rounded-[28px] bg-orange/15" aria-hidden />
            <a
              href={`mailto:${CONTACT}`}
              className="group relative flex flex-col justify-between gap-10 rounded-[24px] bg-ink p-8 transition-transform duration-150 ease-out active:scale-[0.99] sm:p-10"
            >
              <Mail size={26} strokeWidth={2} className="text-orange" aria-hidden />
              <span className="text-balance break-all text-[1.7rem] font-extrabold leading-tight tracking-[-0.03em] text-cream sm:text-[2.2rem]">
                {CONTACT}
              </span>
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-cream px-5 py-2.5 text-[0.82rem] font-bold text-ink transition-colors group-hover:bg-orange group-hover:text-white">
                Hap email-in
                <ArrowUpRight size={15} strokeWidth={2.5} aria-hidden />
              </span>
            </a>
            <ContactEmailCopy email={CONTACT} />
          </div>
        </section>

        {/* Reasons */}
        <section className="border-y border-border bg-white/60">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
            <h2 className="max-w-[26ch] text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
              Si mund të të ndihmojmë?
            </h2>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {REASONS.map((r) => (
                <a key={r.title} href={`mailto:${CONTACT}?subject=${encodeURIComponent(r.title)}`} className="group rounded-3xl bg-cream p-7 ring-1 ring-border transition-colors hover:bg-white">
                  <r.icon size={22} strokeWidth={2} className="text-orange" aria-hidden />
                  <h3 className="mt-5 text-[1.15rem] font-extrabold tracking-[-0.02em] text-ink">{r.title}</h3>
                  <p className="mt-3 text-[0.92rem] leading-[1.65] text-[#565656]">{r.body}</p>
                  <span className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline underline-offset-4">Shkruaj për këtë <ArrowUpRight size={16} aria-hidden /></span>
                </a>
              ))}
            </div>

            <p className="mt-12 max-w-[70ch] border-t border-border pt-8 text-[0.95rem] leading-[1.7] text-[#565656]">
              Të drejtat e tua mbi të dhënat janë të përshkruara te{" "}
              <Link href="/privatesia" className="font-semibold text-ink underline decoration-orange/40 underline-offset-4 hover:text-orange">
                Politika e privatësisë
              </Link>{" "}
              — mund të na shkruash në të njëjtën adresë edhe për këto kërkesa. Përgjigjemi brenda 30 ditësh.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="border-t border-border pt-8 pb-20">
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
