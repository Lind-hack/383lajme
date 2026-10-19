import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import { ArrowRight, Activity, LineChart, MapPin } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import styles from "@/components/info-pages.module.css";

export const metadata: Metadata = {
  title: "Rreth nesh",
  description:
    "383 është platformë lajmesh nga Kosova: lajme, analizë të mbulimit ndërkombëtar, Tregu 383 dhe udhëzues për vizitorët.",
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
    body: "Shiko si e mbulojnë Kosovën mediat ndërkombëtare. Indeksi mbledh artikuj nga vende të ndryshme dhe shpjegon vlerësimin e tyre me citime nga burimi.",
    style: "dark" as const,
  },
  {
    icon: LineChart,
    title: "Tregu 383",
    href: "/tregu",
    body: "Provo parashikimet e tua për sportin dhe ngjarjet e ditës. Hap pozicione me monedha virtuale dhe ndiq si ndryshojnë vlerësimet e pjesëmarrësve.",
    style: "orange" as const,
  },
  {
    icon: MapPin,
    title: "Kosova në xhep",
    href: "/visit",
    body: "Planifiko vizitën me pritjet në kufi, raportimet e qytetarëve dhe shërbimet pranë teje. Shkarko udhëzuesit e qyteteve për t’i pasur me vete edhe pa internet.",
    style: "light" as const,
  },
];

export default function RrethNeshPage() {
  const photo = hasFounderPhoto();

  return (
    <div className={`min-h-screen ${styles.page}`}>
      <a href="#permbajtja" className={styles.skip}>Kalo te përmbajtja</a>
      <Navbar />
      <main id="permbajtja">

        {/* Hero — asymmetric split, display type carries it */}
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-32 sm:px-6 sm:pt-40 lg:grid-cols-[7fr_5fr] lg:items-end">
          <div>

            <h1 className="text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink sm:text-[4rem] lg:text-[4.5rem]">
              Lajmet e Kosovës,
              <br />
              treguara{" "}
              <span className="text-orange">siç meritojnë</span>.
            </h1>
            <p className="mt-7 max-w-[58ch] text-[1.05rem] leading-[1.7] text-[#565656]">
              383 është një platformë lajmesh nga Prishtina, për lexuesit në Kosovë dhe në diasporë.
              Sjellim lajmet e ditës, ndjekim si shkruajnë mediat ndërkombëtare për Kosovën dhe
              ndërtojmë mjete që të hyjnë në punë. Emri ynë vjen nga kodi telefonik i Kosovës.
            </p>
            <a href="#themeluesi" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline underline-offset-4 hover:text-orange">Njihu me themeluesin <ArrowRight size={16} aria-hidden /></a>
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
              Më shumë mënyra për ta njohur Kosovën
            </h2>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {PRODUCTS.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className={`group flex min-h-[240px] flex-col justify-between rounded-3xl p-7 transition-transform duration-200 ease-out active:scale-[0.98] ${
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
                        p.style === "dark" ? "text-cream/80" : "text-[#565656]"
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
                    Shiko {p.title}
                    <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>

          </div>
        </section>

        {/* Founder */}
        <section id="themeluesi" className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[5fr_7fr]">
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-3 rounded-[28px] bg-orange/15 rotate-[1.5deg]" aria-hidden />
              {photo ? (
                <Image
                  src={`/${FOUNDER_PHOTO}`}
                  alt="Lind Sylqa — themeluesi dhe CEO i 383"
                  width={480}
                  height={600}
                  sizes="(max-width: 640px) 90vw, 384px"
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
                Lind Sylqa, themeluesi i 383
              </h2>

              <div className="mt-7 space-y-4 text-[1rem] leading-[1.75] text-[#565656]">
                <p>
                  383 u ngrit nga <strong className="font-bold text-ink">Lind Sylqa</strong>, themelues
                  dhe CEO. Përvoja e tij përfshin mediat sociale me një kompani amerikane,
                  automatizimin dhe reklamat në një startup zviceran. Ai drejton edhe{" "}
                  <a
                    href="https://www.tiktok.com/@building.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-orange underline underline-offset-4"
                  >
                    @building.ai
                  </a>
                  , një llogari në TikTok ku ndan përmbajtje për teknologjinë dhe inteligjencën artificiale.
                </p>
                <p>
                  Në 383, ai bashkon përvojën në media me teknologjinë. Automatizimi ndihmon
                  në përpunimin e lajmeve; burimet dhe korrigjimet janë pjesë e rëndësishme e punës sonë.
                </p>
              </div>

              <blockquote className="mt-8 text-[1.15rem] font-semibold leading-[1.5] text-ink">
                “Dua që 383 të jetë një vend ku lajmet kuptohen lehtë dhe burimet janë të qarta.”
              <footer className="mt-4 text-sm font-medium text-[#565656]">Lind Sylqa · Themelues i 383</footer>
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

      </main>
      <Footer />
    </div>
  );
}
