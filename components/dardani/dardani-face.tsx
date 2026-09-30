"use client";

import { useEffect, type CSSProperties } from "react";
import { DARDANI_STILLS, type DardaniStillName } from "@/lib/dardani-assets";
import DardaniImage from "./dardani-image";

/**
 * Dardani's face in a peach circle, showing what Pyet Dardanin is doing.
 *
 * One state, one face, shared by every surface (specs/pyet-dardanin.md):
 *
 *   neutral   idle, nothing asked yet
 *   thinking  question sent, no answer yet
 *   talking   the answer is being written out
 *   happy     answered, with at least one source
 *   confused  the archive does not have it
 *   sad       the request itself failed (network, provider, rate limit)
 */
export type DardaniFaceState = "neutral" | "thinking" | "talking" | "happy" | "confused" | "sad";

const STILL: Record<DardaniFaceState, DardaniStillName> = {
  neutral: "avatar-neutral",
  thinking: "avatar-thinking",
  talking: "avatar-talking",
  happy: "avatar-happy",
  confused: "face-confused",
  sad: "face-sad",
};

const ALT: Record<DardaniFaceState, string> = {
  neutral: "Dardani",
  thinking: "Dardani duke menduar",
  talking: "Dardani duke folur",
  happy: "Dardani i gëzuar",
  confused: "Dardani i hutuar",
  sad: "Dardani i trishtuar",
};

/** Warm every face into the cache, so a state change swaps with no blank frame. */
export function usePreloadDardaniFaces() {
  useEffect(() => {
    for (const name of Object.values(STILL)) {
      const img = new window.Image();
      img.src = DARDANI_STILLS[name].src;
    }
  }, []);
}

export default function DardaniFace({
  state,
  size,
  decorative = false,
  className,
  style,
}: {
  state: DardaniFaceState;
  size: number;
  /** Inside a labelled control, where the face would only repeat the label. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={["dardani-face", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, ...style }}
    >
      <DardaniImage
        key={state}
        name={STILL[state]}
        alt={ALT[state]}
        decorative={decorative}
        unoptimized
        className="dardani-face-img"
        style={{ width: "105%", height: "auto" }}
      />
    </span>
  );
}
