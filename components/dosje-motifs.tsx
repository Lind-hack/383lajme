/**
 * The erased-motif layer behind a dossier card (design 3a).
 *
 * Five figures from the country's own record are drawn in pencil and set into
 * the paper itself — bleeding off the edge, multiplied into the stock at low
 * opacity, and eroded at the edges by a turbulence mask so they read as
 * something the page was printed over rather than an image placed on top.
 * Each carries a rotated museum label along the card's edge.
 *
 * It is decoration in the strict sense: aria-hidden, pointer-events:none, and
 * it never moves. Nothing here is a control and nothing here is information a
 * reader has to have.
 *
 * Two variants, because a rotated label is as long as the text inside it and
 * clips against a short card. 3a spaces five figures down a sheet 1600 units
 * tall; the sidebar rail is a fraction of that, so at the design's own
 * percentages the labels run past the top edge and lose their dates. The rail
 * variant therefore carries three figures on a band that keeps every label
 * clear of both edges, at reduced scale. The full variant is the design as
 * drawn, for surfaces tall enough to hold it.
 *
 * A figure whose pencil plate is missing still contributes its label. That is
 * deliberate — the labels are the memorial, the drawings are the atmosphere,
 * and a missing plate must never leave a broken image over the text.
 */

interface Motif {
  /** Pencil plate under /public/dosje, or null when the asset is not present. */
  src: string | null;
  name: string;
  dates: string;
  side: "left" | "right";
  /** Vertical position down the card. */
  top: string;
  width: number;
  height: number;
  /** How far the plate hangs past the card edge. */
  bleed: number;
}

const SKANDERBEG = "/dosje/pencil-skanderbeg.png";
const JASHARI = "/dosje/photo-jashari.jpg";

/** The design as drawn: five figures down a tall sheet. */
const FULL: Motif[] = [
  { src: SKANDERBEG, name: "Përkrenarja e Skënderbeut", dates: "1405–1468", side: "right", top: "6.5%", width: 196, height: 172, bleed: 84 },
  { src: null, name: "Ibrahim Rugova", dates: "1944–2006", side: "left", top: "19%", width: 196, height: 190, bleed: 80 },
  { src: JASHARI, name: "Adem Jashari", dates: "1955–1998", side: "right", top: "38%", width: 190, height: 200, bleed: 86 },
  { src: null, name: "Kompleksi Memorial, Prekaz", dates: "5–7 MARS 1998", side: "left", top: "57%", width: 226, height: 168, bleed: 94 },
  { src: null, name: "Shpallja e Pavarësisë, Vlorë", dates: "28 NËNTOR 1912", side: "right", top: "76%", width: 214, height: 178, bleed: 90 },
];

/**
 * The rail: three figures on a 24–76% band. Every label's midpoint sits at
 * least a quarter of the card from either edge, which is what keeps a rotated
 * string from losing its dates off the top.
 */
const RAIL: Motif[] = [
  { src: SKANDERBEG, name: "Përkrenarja e Skënderbeut", dates: "1405–1468", side: "right", top: "24%", width: 150, height: 132, bleed: 62 },
  { src: JASHARI, name: "Adem Jashari", dates: "1955–1998", side: "left", top: "50%", width: 146, height: 154, bleed: 60 },
  { src: null, name: "Shpallja e Pavarësisë, Vlorë", dates: "28 NËNTOR 1912", side: "right", top: "76%", width: 164, height: 136, bleed: 68 },
];

export default function DosjeMotifs({ variant = "full" }: { variant?: "full" | "rail" }) {
  const motifs = variant === "rail" ? RAIL : FULL;

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Hand-drawn iconography and grain, well under the text's contrast floor. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/dosje/motifs.svg)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% auto",
          backgroundPosition: "center top",
          opacity: variant === "rail" ? 0.4 : 0.55,
        }}
      />

      {motifs.map((m) => {
        const edge = m.side === "right" ? { right: `${-m.bleed}px` } : { left: `${-m.bleed}px` };
        const labelEdge = m.side === "right" ? { right: "3px" } : { left: "3px" };
        return (
          <div key={m.name}>
            {m.src && (
              <div style={{ position: "absolute", ...edge, top: m.top, width: `${m.width}px`, height: `${m.height}px` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: 0.3,
                    mixBlendMode: "multiply",
                    filter: m.src.endsWith(".jpg") ? "grayscale(1) contrast(1.15)" : undefined,
                    WebkitMaskImage: "url(/dosje/erode-mask.svg)",
                    maskImage: "url(/dosje/erode-mask.svg)",
                    WebkitMaskSize: "100% 100%",
                    maskSize: "100% 100%",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                  }}
                />
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}
