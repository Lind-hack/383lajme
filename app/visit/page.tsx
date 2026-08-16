import type { Metadata } from "next";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import VisitV2Experience from "@/components/visit/visit-v2-experience";
import visitStyles from "@/components/visit/visit-v2.module.css";

export const metadata: Metadata = {
  title: "Diaspora and visitor guide | 383",
  description:
    "Live Kosovo border waits, nearby emergency services and downloadable city travel cards for diaspora visitors.",
};

export default function VisitPage() {
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
      <VisitV2Experience />
      <div className={visitStyles.printHidden}>
        <Footer />
      </div>
    </>
  );
}
