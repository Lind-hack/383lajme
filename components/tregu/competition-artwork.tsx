"use client";

import { useId } from "react";

import { courtArtFor, nightArtFor, trophyArtFor } from "@/lib/tregu-sport-branding";

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
  // One id per instance: the floor renders many of these at once, and a
  // hardcoded <pattern id> would make every card past the first reference the
  // first card's defs — which also happens to be a duplicate-id document.
  const patternId = useId().replace(/:/g, "");
  const nightArt = nightArtFor(league);
  const trophyArt = trophyArtFor(league);
  const courtArt = courtArtFor(league);

  if (league === "uefa.nations") {
    return <NationsLattice patternId={patternId} />;
  }

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

  if (courtArt) {
    return (
      <>
        {/* The varnish. A polished floor's whole character is the arena light
            sliding across it, so that reflection is the treatment's one
            authored moment -- not a glow sitting on top of the card but a
            highlight travelling over the wood underneath it.

            A single element rather than the night treatment's four washes:
            hardwood returns one specular band, and stacking several would read
            as fog rather than as varnish. Its travel, angle and the static
            state it parks in under reduced motion all live in globals.css. */}
        <span className="tregu-court-varnish" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="tregu-court-ball"
          src={courtArt.src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          width={courtArt.width}
          height={courtArt.height}
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


/** The UEFA Nations League palette, read off the competition's own flag weave. */
const UNL_RED = "#E1332D";
const UNL_BLUE = "#1B4F9C";
const UNL_SKY = "#36A9E1";
const UNL_YELLOW = "#F6C500";
const UNL_GREEN = "#009B48";
const UNL_WHITE = "#FFFFFF";

/**
 * One diamond of the weave: two triangles meeting on the horizontal axis, and a
 * disc over the seam. Every cell in the competition's identity is this shape.
 */
type Cell = { top: string; bottom: string; disc: string };

/** A cell that carries no nation: pale stock, so copy laid over it stays legible. */
const PALE: Cell = { top: "#EDEFF4", bottom: "#F5F6F9", disc: "#FFFFFF" };

/**
 * The eight distinct cells of the repeating unit, in the order they sit in the
 * 96x96 tile: four on the tile's own lattice, four on the complementary one that
 * fills the gaps between them. Colours are hand-assigned rather than cycled so
 * no two touching cells share a hue — a cycle produces visible diagonal banding.
 */
/**
 * The repeating unit is mostly pale and only partly national — the proportion the
 * competition's own artwork uses, where the wordmark sits on undyed stock with
 * colour breaking around it. Filling every cell reads as gift wrap and leaves
 * nowhere legible to put a market question; three in eight reads as the flag.
 */
const UNL_CELLS: Cell[] = [
  { top: UNL_RED, bottom: UNL_WHITE, disc: UNL_BLUE },
  PALE,
  PALE,
  { top: UNL_YELLOW, bottom: UNL_GREEN, disc: UNL_WHITE },
  PALE,
  { top: UNL_SKY, bottom: UNL_BLUE, disc: UNL_WHITE },
  PALE,
  PALE,
];

/**
 * Where each cell is drawn inside the tile. A <pattern> clips at its edge rather
 * than wrapping, so a cell straddling the boundary has to be drawn at every
 * position it shows through — hence the repeats on cells 4-7.
 */
const UNL_PLACEMENTS: Array<Array<[number, number]>> = [
  [[24, 24]],
  [[72, 24]],
  [[24, 72]],
  [[72, 72]],
  [[0, 0], [96, 0], [0, 96], [96, 96]],
  [[48, 0], [48, 96]],
  [[0, 48], [96, 48]],
  [[48, 48]],
];

const R = 24; // half-diagonal of a cell
const DISC = 8.5;

function NationsLattice({ patternId }: { patternId: string }) {
  const weave = `unl-weave-${patternId}`;
  const emboss = `unl-emboss-${patternId}`;

  return (
    <>
      {/* The quiet field. Same lattice as the rim, but cut rather than coloured:
          a highlight on each cell's upper edges and a shadow on its lower ones,
          lit from the top-left, so the surface reads as folded stock. This is
          what sits behind the text, so it never carries a hue. */}
      <svg className="tregu-unl-field" aria-hidden focusable="false">
        <defs>
          <pattern id={emboss} width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M24 0 48 24 24 48 0 24Z" className="tregu-unl-facet" />
            <path d="M0 24 24 0M24 48 48 24" className="tregu-unl-lit" />
            <path d="M24 48 0 24M48 24 24 0" className="tregu-unl-shade" />
            <circle cx="24" cy="24" r={DISC} className="tregu-unl-disc" />
            <circle cx="0" cy="0" r={DISC} className="tregu-unl-disc" />
            <circle cx="48" cy="0" r={DISC} className="tregu-unl-disc" />
            <circle cx="0" cy="48" r={DISC} className="tregu-unl-disc" />
            <circle cx="48" cy="48" r={DISC} className="tregu-unl-disc" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${emboss})`} />
      </svg>

      {/* The rim. The same weave in full national colour, masked in CSS so it
          crowds the edges and is gone by the time it reaches the copy. The
          competition's flag is densest at its folds; so is this. */}
      <svg className="tregu-unl-rim" aria-hidden focusable="false">
        <defs>
          <pattern id={weave} width="96" height="96" patternUnits="userSpaceOnUse">
            {UNL_CELLS.map((cell, index) =>
              UNL_PLACEMENTS[index].map(([cx, cy]) => (
                <g key={`${index}-${cx}-${cy}`}>
                  <path d={`M${cx - R} ${cy}L${cx} ${cy - R}L${cx + R} ${cy}Z`} fill={cell.top} />
                  <path d={`M${cx - R} ${cy}L${cx} ${cy + R}L${cx + R} ${cy}Z`} fill={cell.bottom} />
                  <circle cx={cx} cy={cy} r={DISC} fill={cell.disc} />
                </g>
              ))
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${weave})`} />
      </svg>

      {/* The fold travelling over the weave. The competition's mark is a flag in
          motion, so the light moves and the cells do not — moving the cells
          themselves would break the tessellation they are drawn to hold. */}
      <span className="tregu-unl-fold" aria-hidden />
    </>
  );
}
