import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import KuiziDites from "@/components/kuizi-dites";
import { getKuiziData } from "@/lib/kuizi-server";
import { formatAlbanianDate } from "@/lib/reagimi-data";

// The quiz changes once a morning; ten minutes keeps a shared link current
// without rendering the page per visitor.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kuizi i ditës",
  description:
    "Pesë pyetje për lajmet e 24 orëve të fundit. Pas çdo përgjigjeje sheh si u përgjigjën lexuesit e tjerë.",
  openGraph: {
    title: "Kuizi i ditës · 383",
    description: "Pesë pyetje për lajmet e ditës. Sa e ndoqe ti?",
    url: "/kuiz",
  },
};

/**
 * Where a shared result lands. The same card as the homepage, given the page
 * to itself, so a friend opening the link can play straight away.
 */
export default async function KuizPage() {
  const kuizi = await getKuiziData().catch(() => null);

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
        <p className="mb-3 flex items-center gap-3 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-orange" aria-hidden />
          Kuizi i ditës
          {kuizi && <span className="normal-case tracking-normal">· {formatAlbanianDate(kuizi.dateKey)}</span>}
        </p>
        <h1 className="mb-8 text-balance text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[3rem]">
          Pesë pyetje për lajmet e ditës.
        </h1>

        {kuizi ? (
          <KuiziDites data={kuizi} standalone />
        ) : (
          <div className="rounded-2xl border border-[#E8E3DB] bg-white p-8">
            <p className="text-[1.05rem] font-bold text-ink">Kuizi i sotëm nuk është gati ende.</p>
            <p className="mt-2 text-[0.95rem] text-[#565656]">
              Del çdo mëngjes nga lajmet e 24 orëve të fundit.{" "}
              <Link href="/" className="font-bold text-orange">
                Lexo lajmet e fundit
              </Link>
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
