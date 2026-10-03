import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import visitStyles from "@/components/visit/visit-v2.module.css";
import xhepStyles from "@/components/xhep/xhep.module.css";
import DayPlan from "@/components/xhep/day-plan";
import JoinTrip from "@/components/xhep/join-trip";
import { CITY_NAMES, cardArt } from "@/lib/xhep/card-art.mjs";
import { XHEP_LANG_COOKIE, resolveXhepLang, xhepDict } from "@/lib/xhep/i18n";
import { decodeTrip, tripUrl } from "@/lib/xhep/trip-link.mjs";

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

async function load(searchParams: Props["searchParams"]) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const lang = resolveXhepLang(params.lang, cookieStore.get(XHEP_LANG_COOKIE)?.value);
  const raw = Array.isArray(params.d) ? params.d[0] : params.d;
  const payload = typeof raw === "string" ? raw : "";
  return { lang, payload, trip: decodeTrip(payload) };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang, trip } = await load(searchParams);
  const t = xhepDict(lang).trip;
  return {
    title: t.metaTitle(trip?.name ?? ""),
    description: t.metaDescription,
    // A trip link is a private share: keep it out of search and don't leak it onward.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function TripPage({ searchParams }: Props) {
  const { lang, payload, trip } = await load(searchParams);
  const t = xhepDict(lang).trip;
  const visitHref = `/visit${lang === "sq" ? "?lang=sq" : ""}`;

  return (
    <>
      <Navbar />
      <main className={visitStyles.visitShell} lang={lang}>
        <section className={xhepStyles.companion}>
          {trip ? (
            <>
              <div className={xhepStyles.companionHead}>
                <h2>{trip.name ? t.heading(trip.name) : t.anon}</h2>
                <p>{t.summary(trip.days, trip.cities.map((id) => CITY_NAMES[id as keyof typeof CITY_NAMES]).join(" → "))}</p>
              </div>
              <div className={xhepStyles.cardLayout}>
                {/* The generator escapes every visitor-supplied string, so its output is safe to inline. */}
                <figure
                  className={xhepStyles.cardFigure}
                  dangerouslySetInnerHTML={{ __html: cardArt(trip, { lang, seed: trip.seed ?? "", qrUrl: tripUrl(trip, lang) }) }}
                />
                <div className={xhepStyles.cardSide}>
                  <JoinTrip lang={lang} payload={payload} />
                  <p className={xhepStyles.cardQrNote}>{t.publicNote}</p>
                </div>
              </div>
              <DayPlan lang={lang} profile={{ ...trip, v: 1, startDate: null, stamps: [], travellingWith: "", completed: true, updatedAt: null }} />
            </>
          ) : (
            <div className={xhepStyles.companionHead}>
              <h2>{t.invalidTitle}</h2>
              <p>{t.invalidBody}</p>
              <p>
                <Link className={xhepStyles.primaryButton} href={visitHref}>
                  {t.openVisit}
                </Link>
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
