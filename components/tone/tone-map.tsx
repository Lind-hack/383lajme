"use client";

// The inset map. Five countries carry data; everything else in frame is
// context, drawn recessively so the map reads as a place rather than as a
// mostly-empty grid.
//
// Hand-rolled inline SVG, like every other chart here — the geometry is
// pre-projected into lib/tone-map-paths.ts by scripts/build-map-paths.mjs, so
// this adds no dependency and no runtime projection work.
//
// One deliberate departure from the house chart idiom: the other charts use
// preserveAspectRatio="none" and stretch to their container, which is fine for
// an abstract plot and wrong for geography — it would shear every coastline.
// This one keeps its aspect ratio, so text stays out of the SVG.

import { useId } from "react";
import { MAP_SHAPES, MAP_VIEWBOX } from "@/lib/tone-map-paths";
import { BAND, toneFill, toneLabel } from "@/lib/tone-scale";

export interface ToneMapCountry {
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  code: string;
  /** Albanian display name, the key the rest of the data uses. */
  country: string;
  index: number | null;
}

interface Props {
  countries: ToneMapCountry[];
  /** Highlighted right now — hover or selection. Shared with the rows below. */
  active: string | null;
  /** Clicked open. Gets a heavier outline that survives the mouse leaving. */
  selected: string | null;
  onHover: (country: string | null) => void;
  onSelect: (country: string) => void;
}

const CONTEXT_FILL = "rgba(17,17,17,0.05)";
const BORDER = "rgba(17,17,17,0.12)";

export default function ToneMap({ countries, active, selected, onHover, onSelect }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const byCode = new Map(countries.map((c) => [c.code, c]));

  return (
    // Full width. It was capped at 560px while it covered five countries and
    // half an ocean; with sixteen countries and a Europe-weighted crop the
    // map is the primary object in the module and gets the room.
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Harta e tonit të medias sipas vendit"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        <title>Toni i medias sipas vendit</title>

        {/* Context first, so the tracked countries paint over it. */}
        <g fill={CONTEXT_FILL} stroke={BORDER} strokeWidth={0.6} vectorEffect="non-scaling-stroke">
          {MAP_SHAPES.filter((s) => !s.tracked).map((s, i) => (
            <path key={`ctx-${uid}-${i}`} d={s.d} />
          ))}
        </g>

        {MAP_SHAPES.filter((s) => s.tracked).map((s, i) => {
          const data = byCode.get(s.code);
          const on = data != null && active === data.country;
          const isOpen = data != null && selected === data.country;
          const label = data
            ? `${data.country}: ${data.index ?? "pa të dhëna"} — ${toneLabel(data.index)}`
            : s.code;
          return (
            <path
              key={`hit-${uid}-${i}`}
              d={s.d}
              fill={toneFill(data?.index ?? null)}
              stroke={isOpen ? "#111111" : on ? "rgba(17,17,17,0.55)" : BORDER}
              strokeWidth={isOpen ? 2.2 : on ? 1.6 : 0.8}
              vectorEffect="non-scaling-stroke"
              tabIndex={data ? 0 : -1}
              role={data ? "button" : undefined}
              aria-label={data ? label : undefined}
              aria-pressed={data ? isOpen : undefined}
              // Hover only ever highlights. Opening is a click, so nothing a
              // reader is travelling toward can vanish under the pointer.
              onPointerEnter={() => data && onHover(data.country)}
              onPointerLeave={() => data && onHover(null)}
              onFocus={() => data && onHover(data.country)}
              onBlur={() => data && onHover(null)}
              onClick={() => data && onSelect(data.country)}
              onKeyDown={(e) => {
                if (data && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(data.country);
                }
              }}
              style={{
                cursor: data ? "pointer" : "default",
                outline: "none",
                transition: "stroke-width 160ms var(--ease-out), opacity 160ms var(--ease-out), stroke 160ms var(--ease-out)",
                opacity: active && !on && !isOpen ? 0.5 : 1,
              }}
            />
          );
        })}
      </svg>

      {/* The band is stated, not hidden. Compressing 0-100 into 35-65 is what
          makes five near-50 countries distinguishable at all, and a reader is
          entitled to know the scale was compressed. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "10px",
          fontSize: "10.5px",
          color: "#9CA3AF",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700 }}>Kritik</span>
        <span
          aria-hidden
          style={{
            flex: "1 1 90px",
            minWidth: "90px",
            height: "6px",
            borderRadius: "100px",
            background: `linear-gradient(90deg, ${toneFill(BAND.lo)}, ${toneFill(50)}, ${toneFill(BAND.hi)})`,
          }}
        />
        <span style={{ fontWeight: 700 }}>Pozitiv</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
          shkalla {BAND.lo}–{BAND.hi}
        </span>
      </div>
    </div>
  );
}
