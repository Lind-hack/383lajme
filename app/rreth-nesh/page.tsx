import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Rreth nesh",
  description:
    "383 është platformë lajmesh nga Kosova: lajme origjinale, Toni i Mediave Botërore ndaj Kosovës, Tregu 383 me parashikime, dhe vegla për vizitorët e diasporës.",
};

export default function RrethNeshPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="mx-auto max-w-[46rem] px-5 pb-24 pt-28 sm:px-6 sm:pt-32">
        <h1 className="text-balance text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[2.75rem]">
          Rreth nesh
        </h1>

        <div className="mt-8 space-y-5 text-[1rem] leading-[1.75] text-[#565656]">
          <p>
            <strong className="font-bold text-ink">383</strong> është platformë lajmesh nga Kosova,
            me seli në Prishtinë. Emrin e mbajmje nga kodit të vendit — lajme që ndodhin këtu, të
            shkruara këtu, për njerëzit që jetojnë këtu dhe për ata që e ndjekin Kosovën nga jashtë.
          </p>
          <p>
            Çdo ditë publikojmë lajme origjinale në shqip me burime të verifikuara dhe citate të
            plota. Përveç lajmeve, mbajmja tri gjëra që s’i gjen askund tjetër:
          </p>
          <ul className="ml-1 space-y-3">
            {[
              {
                title: "Toni i Mediave Botërore",
                text: "një indeks ditor se si shtypi i huaj në 15 vende flet për Kosovën — me citate verbatim si provë.",
                href: "/toni",
                label: "/toni",
              },
              {
                title: "Tregu 383",
                text: "një treg parashikimesh me monedha virtuale ku lexuesit blejnë dhe shesin rezultatin e ngjarjeve reale — sport, lajme dhe Formula 1.",
                href: "/tregu",
                label: "/tregu",
              },
              {
                title: "Vegla për vizitorët",
                text: "pritjet në pikat kufitare në kohë reale, raportime nga qytetarët dhe karta të qyteteve për diasporën që vjen në Kosovë.",
                href: "/visit",
                label: "/visit",
              },
            ].map((item) => (
              <li key={item.href} className="flex gap-3">
                <span aria-hidden className="mt-[0.6rem] h-[5px] w-[5px] shrink-0 rounded-full bg-orange" />
                <span>
                  <strong className="font-bold text-ink">{item.title}</strong>{" "}
                  <Link href={item.href} className="font-mono text-[0.85em] text-orange underline underline-offset-4">
                    {item.label}
                  </Link>{" "}
                  — {item.text}
                </span>
              </li>
            ))}
          </ul>
          <p>
            Jemi të pavarur. Redaksia vendos çfarë publikohet, burimet e jashtme citohen hapur dhe
            korrigjimet bëhen publikisht.
          </p>
          <p>
            Na gjej te{" "}
            <Link href="/kontakt" className="font-semibold text-orange underline underline-offset-4">
              faqja e kontaktit
            </Link>{" "}
            — info@383media.com.
          </p>
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
