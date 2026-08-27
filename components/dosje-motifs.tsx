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
  /** Vertical position down the card, as the design specifies it. */
  top: string;
  width: number;
  height: number;
  /** How far the plate hangs past the card edge. */
  bleed: number;
  /** Where the rotated label sits relative to the plate. */
  labelOffset: number;
}

const MOTIFS: Motif[] = [
  {
    src: "/dosje/pencil-skanderbeg.png",
    name: "Përkrenarja e Skënderbeut",
    dates: "1405–1468",
    side: "right",
    top: "6.5%",
    width: 196,
    height: 172,
    bleed: 84,
    labelOffset: 73,
  },
  {
    src: null,
    name: "Ibrahim Rugova",
    dates: "1944–2006",
    side: "left",
    top: "19%",
    width: 196,
    height: 190,
    bleed: 80,
    labelOffset: 81,
  },
  {
    src: null,
    name: "Adem Jashari",
    dates: "1955–1998",
    side: "right",
    top: "38%",
    width: 190,
    height: 200,
    bleed: 86,
    labelOffset: 86,
  },
  {
    src: null,
    name: "Kompleksi Memorial, Prekaz",
    dates: "5–7 MARS 1998",
    side: "left",
    top: "57%",
    width: 226,
    height: 168,
    bleed: 94,
    labelOffset: 72,
  },
  {
    src: null,
    name: "Shpallja e Pavarësisë, Vlorë",
    dates: "28 NËNTOR 1912",
    side: "right",
    top: "76%",
    width: 214,
    height: 178,
    bleed: 90,
    labelOffset: 77,
  },
];

const SERIF = "Georgia, 'Times New Roman', serif";

export default function DosjeMotifs() {
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
          opacity: 0.75,
        }}
      />

      {MOTIFS.map((m) => {
        const edge = m.side === "right" ? { right: `${-m.bleed}px` } : { left: `${-m.bleed}px` };
        const labelEdge = m.side === "right" ? { right: "2px" } : { left: "2px" };
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
                    opacity: 0.46,
                    mixBlendMode: "multiply",
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

            <div
              style={{
                position: "absolute",
                ...labelEdge,
                top: `calc(${m.top} + ${m.labelOffset}px)`,
                transform: m.side === "right" ? "rotate(90deg)" : "rotate(-90deg)",
                transformOrigin: m.side === "right" ? "right center" : "left center",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
              }}
            >
              <span
                style={{
                  font: `italic 400 10.5px ${SERIF}`,
                  color: "rgba(43,37,33,.3)",
                  letterSpacing: "0.03em",
                }}
              >
                {m.name}
              </span>
              <span
                style={{
                  font: "400 8px inherit",
                  letterSpacing: "0.18em",
                  color: "rgba(43,37,33,.22)",
                }}
              >
                {m.dates}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
