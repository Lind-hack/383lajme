import type { Metadata } from "next";
import { cookies } from "next/headers";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import VisitV2Experience from "@/components/visit/visit-v2-experience";
import visitStyles from "@/components/visit/visit-v2.module.css";
import { XHEP_LANG_COOKIE, resolveXhepLang, xhepDict } from "@/lib/xhep/i18n";

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

async function visitLang(searchParams: Props["searchParams"]) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  return resolveXhepLang(params.lang, cookieStore.get(XHEP_LANG_COOKIE)?.value);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await visitLang(searchParams);
  const { meta } = xhepDict(lang);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: lang === "sq" ? "/visit?lang=sq" : "/visit",
      languages: { en: "/visit?lang=en", sq: "/visit?lang=sq", "x-default": "/visit" },
    },
  };
}

export default async function VisitPage({ searchParams }: Props) {
  const lang = await visitLang(searchParams);
  return (
    <>
      <div className={visitStyles.printHidden}>
        <Navbar />
      </div>
      <div
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html:
            "<!-- THESIS: Kosovo in your pocket: a calm border desk and a photo-led city guide, not a generic travel portal. OWN-WORLD: warm folded road atlas, cream-and-ink utility cards, documentary city photography, 383 orange actions. STORY: check the wait, verify a nearby report, find help, then build a city card. FIRST VIEWPORT: the direct headline and two card modes sit beside a full rectangular Kosovo map and a continuous live wait meter. FORM: Folded Atlas route desk, pinned to the user's approved warm-map reference. SAFETY: location is requested only by explicit action; border reports require a fresh position within 1 km and exact coordinates are never stored. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. -->",
        }}
      />
      {/* The site layout is Albanian; this subtree declares its own language. */}
      <div lang={lang}>
        <VisitV2Experience lang={lang} />
      </div>
      <div className={visitStyles.printHidden}>
        <Footer />
      </div>
    </>
  );
}
