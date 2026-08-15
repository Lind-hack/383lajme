import type { Metadata } from "next";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import VisitExperience from "@/components/visit/visit-experience";
import visitStyles from "@/components/visit/visit.module.css";

export const metadata: Metadata = {
  title: "Diaspora and visitor guide | 383",
  description:
    "A practical, source-checked travel companion for visitors coming to Kosovo or Albania.",
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
            "<!-- THESIS: public-interest travel utility. OWN-WORLD: Folded Atlas. STORY: prepare, arrive, act. FIRST VIEWPORT: create a private travel card and reach emergency help. FORM: candidate 3, seed 197739fd. FINISH: restrained paper texture, precise source states, one orange action accent, red reserved for emergencies. -->",
        }}
      />
      <VisitExperience />
      <div className={visitStyles.printHidden}>
        <Footer />
      </div>
    </>
  );
}
