"use client";

// "Gazeta jote" on the homepage: one compact line under Top 5 that points to
// Për ty, so a reader scrolling Sot meets their own paper instead of having to
// guess what the tab means.
//
// It only points; nothing is chosen or saved here. Setting the paper up is
// Për ty's own onboarding, so there is one place that does it:
//
//   - a reader with a paper: "Gazeta e Lindit është gati për sot" → /per-ty;
//   - a guest 383 has learned from (lib/perty-learned.mjs): Dardani says he
//     made the paper → /per-ty, where the reveal asks before saving anything;
//   - anyone else: an invitation → /per-ty, which opens on the onboarding.
//
// The homepage is statically cached and shared, so the line is decided on the
// device after mount; a placeholder of the same height holds its place.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hasInterests, readInterests } from "@/lib/interests.mjs";
import { readPrefs } from "@/lib/paper-prefs.mjs";
import { paperTitle, readName } from "@/lib/reader-name.mjs";
import { hasLearnedPaper, learnedPicks } from "@/lib/perty-learned.mjs";
import { track } from "@/lib/analytics";
import DardaniFace from "@/components/dardani/dardani-face";

type Line = { kind: "paper" | "learned" | "new"; title: string; sub: string; cta: string };

export default function PerTyHome() {
  const [line, setLine] = useState<Line | null>(null);

  useEffect(() => {
    const interests = readInterests();
    if (hasInterests(interests)) {
      setLine({
        kind: "paper",
        title: `${paperTitle(readName(), readPrefs()?.title)} është gati për sot`,
        sub: "Lajmet që zgjodhe ti, në një faqe.",
        cta: "Hape",
      });
    } else if (hasLearnedPaper(learnedPicks(interests?.affinity))) {
      setLine({
        kind: "learned",
        title: "Dardani ta bëri gazetën nga ajo që lexove",
        sub: "Shihe dhe ndrysho çka s'të duhet.",
        cta: "Shihe",
      });
    } else {
      setLine({
        kind: "new",
        title: "Bëje 383 gazetën tënde",
        sub: "Zgjidh temat, njerëzit dhe qytetin. Pa llogari.",
        cta: "Fillo",
      });
    }
  }, []);

  if (!line) return <div className="pth-strip pth-strip--loading" aria-hidden="true" />;
  return (
    <Link href="/per-ty" className="pth-strip" onClick={() => track("perty_home_open", { kind: line.kind })}>
      <DardaniFace state="happy" size={32} decorative />
      <span className="pth-strip-text">
        <strong>{line.title}</strong>
        <span>{line.sub}</span>
      </span>
      <span className="pth-strip-cta">
        {line.cta} <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </Link>
  );
}
