import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Kontakto 383: lajme dhe sugjerime, korrigjime, bashkëpunime biznesi. info@383media.com",
};

const CONTACT = "info@383media.com";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-5 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <div className="text-[0.9rem] font-bold tracking-[-0.01em] text-ink">{label}</div>
      <div className="text-[0.95rem] leading-[1.7] text-[#565656]">{children}</div>
    </div>
  );
}

export default function KontaktPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="mx-auto max-w-[46rem] px-5 pb-24 pt-28 sm:px-6 sm:pt-32">
        <h1 className="text-balance text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[2.75rem]">
          Kontakt
        </h1>

        <p className="mt-6 text-[1.05rem] leading-[1.7] text-[#565656]">
          E gjitha te një adresë:{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-orange underline underline-offset-4">
            {CONTACT}
          </a>
          . Përgjigjemi brenda disa ditësh pune.
        </p>

        <div className="mt-10 rounded-2xl bg-white p-6 ring-1 ring-border sm:p-8">
          <Row label="Lajme dhe sugjerime">
            Ke një histori që duhet treguar, ose diçka që po na ikën? Shkruaj — burimet mbrohen.
          </Row>
          <Row label="Korrigjime">
            Nëse gjejmë gabim, e rregullojmë dhe e shënojmë hapur. Korrigjimet i trajtojmë me
            prioritet.
          </Row>
          <Row label="Biznese dhe partneritete">
            Për bashkëpunime dhe pozicione sponzorizuare, shkruaj me temën “Partneritet”.
          </Row>
          <Row label="Privatësia dhe të dhënat">
            Të drejtat e tua mbi të dhënat janë të përshkruara te{" "}
            <Link href="/privatesia" className="font-semibold text-ink underline decoration-orange/40 underline-offset-4 hover:text-orange">
              Politika e privatësisë
            </Link>{" "}
            — kërkesat përpunohen brenda 30 ditësh.
          </Row>
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <Link
            href="/"
            className="text-[0.9rem] font-semibold text-ink transition-colors hover:text-orange"
          >
            ← Kthehu në ballinë
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
