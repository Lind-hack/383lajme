"use client";

import { nightArtFor, trophyArtFor } from "@/lib/tregu-sport-branding";

/**
 * The decorative layers a competition treatment puts behind a surface.
 *
 * The floor card, the market banner and the trade receipt are the same object
 * seen three times, so they render the same artwork and differ only in how the
 * CSS places it. Keeping the markup here rather than in each of them is what
 * stops the three drifting apart — the Europa beam paths in particular are
 * geometry, and geometry copied three times gets edited once.
 */
export default function CompetitionArtwork({ league }: { league?: string | null }) {
  const nightArt = nightArtFor(league);
  const trophyArt = trophyArtFor(league);

  if (trophyArt) {
    return (
      <>
        {/* Four beams fall from above, refract off the bottom edge and carry on
            out through the right. Drawn as paths rather than moved elements: a
            translating box can only travel along one axis, so it cannot change
            direction mid-flight — the bend has to be in the geometry.

            The refraction keeps the horizontal direction it arrived with, so a
            beam coming down-and-right leaves up-and-right rather than folding
            back on itself.

            Every path is the same shape translated 24 units along x, not four
            separately drawn lines. Exact translates stay exactly parallel, so
            the spacing on the outgoing leg is the spacing on the incoming one.

            viewBox 0 0 100 100 with preserveAspectRatio="none" stretches them to
            whatever size the host is, and pathLength="100" normalises the paths
            so all four advance at an identical rate. */}
        <svg
          className="tregu-uel-beams"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          <path d="M -10 -18 L 8 100 L 138 38" pathLength={100} />
          <path d="M 14 -18 L 32 100 L 162 38" pathLength={100} />
          <path d="M 38 -18 L 56 100 L 186 38" pathLength={100} />
          <path d="M 62 -18 L 80 100 L 210 38" pathLength={100} />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="tregu-uel-trophy"
          src={trophyArt.src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          width={trophyArt.width}
          height={trophyArt.height}
        />
      </>
    );
  }

  if (nightArt) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="tregu-night-stadium"
          src={nightArt}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          width={1000}
          height={265}
        />
        {/* After the stadium on purpose: the washes paint over the building as
            well as the navy, so one light source lights the whole surface. */}
        <span className="tregu-night-glow" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
      </>
    );
  }

  return null;
}
