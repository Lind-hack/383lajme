import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import { ArrowRight, Activity, LineChart, MapPin } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Rreth nesh",
  description:
    "383 është platformë lajmesh nga Kosova: lajme origjinale, Toni i Mediave Botërore ndaj Kosovës, Tregu 383 me parashikime, dhe vegla për vizitorët e diasporës.",
};

const FOUNDER_PHOTO = "lind-sylqa.jpg";

function hasFounderPhoto() {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", FOUNDER_PHOTO));
  } catch {
    return false;
  }
}

const PRODUCTS = [
  {
    icon: Activity,
    title: "Toni i Mediave Botërore",
    href: "/toni",
    body: "Një indeks ditor se si shtypi i huaj flet për Kosovën — ndjekim 15 vende në 15 gjuhë, klasifikojmë çdo artikull me citat verbatim dhe publikojmë rezultatin hapur.",
    style: "dark" as const,
  },
  {
    icon: LineChart,
    title: "Tregu 383",
    href: "/tregu",
    body: "Tregu i vetëm i parashikimeve në Kosovë. Lexuesit blejnë dhe shesin rezultatin e ngjarjeve reale — sport, lajme, Formula 1 — me monedha virtuale dhe çmime që lëvizin në kohë reale.",
    style: "orange" as const,
  },
  {
    icon: MapPin,
    title: "Vegla për vizitorët",
    href: "/visit",
    body: "Pritjet në pikat kufitare të përditësuara çdo 10 minuta, raportime nga qytetarët, shërbime pranë ty dhe karta të qyteteve që punojnë edhe pa internet — për diasporën që vjen.",
    style: "light" as const,
  },
];

const FACTS = [
  { value: "20+", label: "lajme të verifikuara në ditë" },
  { value: "15", label: "vende në indeksin e tonit medial" },
  { value: "4", label: "pika kufitare në kohë reale" },
  { value: "7", label: "qytete me karta për vizitorë" },
];

export default function RrethNeshPage() {
  const photo = hasFounderPhoto();

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      {/* Hero — asymmetric split, display type carries it */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-32 sm:px-6 sm:pt-40 lg:grid-cols-[7fr_5fr] lg:items-end">
        <div>
          <p className="mb-5 flex items-center gap-3 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-muted">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-orange" aria-hidden />
            Rreth nesh
          </p>
          <h1 className="text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[4rem] lg:text-[4.5rem]">
            Lajmet e Kosovës,
            <br />
            treguara{" "}
            <span className="text-orange">siç meritojnë</span>.
          </h1>
          <p className="mt-7 max-w-[58ch] text-[1.05rem] leading-[1.7] text-[#565656]">
            383 është platformë lajmesh nga Prishtina. Publikojmë lajme origjinale me burime të
            verifikuara, masim se si bota flet për Kosovën dhe ndërtojmë vegla publike që s'i gjen
            askund tjetër. Emri është kodi i vendit — sepse këtu ndodhin lajmet.
          </p>
        </div>

        {/* Typographic mark — pure type, no fake imagery */}
        <div className="relative hidden select-none lg:block" aria-hidden>
          <div className="text-right font-extrabold leading-[0.8] tracking-[-0.06em] text-ink/[0.06]" style={{ fontSize: "clamp(9rem, 14vw, 15rem)" }}>
            383
          </div>
          <div className="-mt-6 flex justify-end">
            <span className="rounded-full bg-ink px-5 py-2 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-cream">
              Prishtinë · Kosovë
            </span>
          </div>
        </div>
      </section>

      {/* What we build — bento with real background variety */}
      <section className="border-y border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
          <h2 className="max-w-[24ch] text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
            Tri gjëra që s'i gjen askund tjetër
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PRODUCTS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className={`group flex min-h-[280px] flex-col justify-between rounded-3xl p-7 transition-transform duration-200 ease-out active:scale-[0.98] ${
                  p.style === "dark"
                    ? "bg-ink text-cream"
                    : p.style === "orange"
                      ? "bg-orange/[0.08] ring-1 ring-orange/25"
                      : "bg-white ring-1 ring-border"
                }`}
              >
                <div>
                  <p.icon
                    size={22}
                    strokeWidth={2}
                    className={p.style === "dark" ? "text-orange" : p.style === "orange" ? "text-orange" : "text-ink"}
                    aria-hidden
                  />
                  <h3 className="mt-5 text-[1.25rem] font-extrabold tracking-[-0.02em]">{p.title}</h3>
                  <p
                    className={`mt-3 text-[0.92rem] leading-[1.65] ${
                      p.style === "dark" ? "text-cream/60" : "text-[#565656]"
                    }`}
                  >
                    {p.body}
                  </p>
                </div>
                <span
                  className={`mt-6 inline-flex items-center gap-2 text-[0.85rem] font-bold transition-colors ${
                    p.style === "dark" ? "text-orange" : "text-ink group-hover:text-orange"
                  }`}
                >
                  Hap
                  <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>

          {/* Facts — plain row, no card noise */}
          <dl className="mt-16 grid grid-cols-2 gap-y-10 border-t border-border pt-10 md:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label} className="flex flex-col">
                <dd className="order-1 text-[2.4rem] font-extrabold tracking-[-0.03em] text-ink">{f.value}</dd>
                <dt className="order-2 mt-2 max-w-[18ch] text-[0.85rem] leading-snug text-muted">{f.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Founder */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[5fr_7fr]">
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-3 rounded-[28px] bg-orange/15 rotate-[1.5deg]" aria-hidden />
            {photo ? (
              <Image
                src={`/${FOUNDER_PHOTO}`}
                alt="Lind Sylqa — themeluesi dhe CEO i 383"
                width={480}
                height={600}
                priority
                className="relative aspect-[4/5] w-full rounded-[24px] object-cover"
              />
            ) : (
              <div className="relative flex aspect-[4/5] w-full items-center justify-center rounded-[24px] bg-ink">
                <span className="text-[6rem] font-extrabold tracking-[-0.04em] text-cream">LS</span>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
              Njeriu pas kodit të vendit
            </h2>

            <div className="mt-7 space-y-4 text-[1rem] leading-[1.75] text-[#565656]">
              <p>
                383 u ngrit nga <strong className="font-bold text-ink">Lind Sylqa</strong>, themelues
                dhe CEO. Ka nisur karrierën në media sociale me një kompani nga SHBA-ja, ka punuar
                automatizime dhe dalje reklamash në një startup zviceran, dhe drejton{" "}
                <a
                  href="https://www.tiktok.com/@building.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-orange underline underline-offset-4"
                >
                  @building.ai
                </a>
                , një nga llogaritë më të mëdha të teknologjisë në TikTok me qindra miliona
                shikime.
              </p>
              <p>
                Sot ai udhëheq 383 me një ekip të vogël dhe një newsroom të automatizuar — ku
                redaktoria vendos çfarë publikohet, burimet citohen hapur dhe korrigjimet bëhen
                publikisht.
              </p>
            </div>

            <blockquote className="mt-8 border-l-2 border-orange pl-5 text-[1.15rem] font-semibold leading-[1.5] text-ink">
              “Kosova meriton media që i dalin para lajmeve — jo që i kopjojnë.”
            </blockquote>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="rounded-full bg-ink px-5 py-2.5 text-[0.82rem] font-bold uppercase tracking-[0.1em] text-cream">
                Themelues &amp; CEO
              </span>
              <a
                href="https://www.linkedin.com/in/lsylqa/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.9rem] font-semibold text-ink underline decoration-border underline-offset-4 transition-colors hover:text-orange"
              >
                Lind Sylqa — LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-28 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[24px] bg-orange/[0.07] p-8 ring-1 ring-orange/20 sm:p-10">
          <p className="max-w-[40ch] text-balance text-[1.3rem] font-extrabold leading-snug tracking-[-0.02em] text-ink">
            Ke një histori për ne, apo dëshiron të bashkëpunosh?
          </p>
          <Link
            href="/kontakt"
            className="group inline-flex items-center gap-2 rounded-full bg-orange px-6 py-3.5 text-[0.9rem] font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Na shkruaj
            <ArrowRight size={16} strokeWidth={2.5} className="transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>

        <div className="mt-14 border-t border-border pt-8">
          <Link href="/" className="text-[0.9rem] font-semibold text-ink transition-colors hover:text-orange">
            ← Kthehu në ballinë
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
