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

import { useId, useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X, Plus, Minus, RotateCcw } from "lucide-react";
import { MAP_SHAPES, MAP_VIEWBOX } from "@/lib/tone-map-paths";
import { BAND, toneFill, toneLabel } from "@/lib/tone-scale";
import ToneMapSheet from "./tone-map-sheet";
import type { ToneCardArticle } from "./tone-article-card";

export interface ToneMapCountry {
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  code: string;
  /** Albanian display name, the key the rest of the data uses. */
  country: string;
  index: number | null;
  /** The scraper's own is_confident(): enough articles AND enough of the
   *  country's coverage. False hatches the shape rather than giving it a
   *  confident band colour — the one use of texture the chart guidance
   *  allows, because it encodes uncertainty rather than decorating.
   *
   *  Deliberately the flag and not a second coverage threshold here: the
   *  rule lives in tools/tone_scraper.py, and two copies of it would drift. */
  confident?: boolean;
  /** Articles behind the index. Drives the fill's weight.
   *
   *  Tone alone cannot carry this map. Under the v2 definition only 2 of 92
   *  cached articles hold any stance at all — the foreign press reports on
   *  Kosovo, it does not editorialise about it — so every country renders the
   *  same neutral grey and the map says nothing. Volume genuinely varies,
   *  from one article to nineteen, and "who is even writing about us" is a
   *  real question the map can now answer. */
  n?: number;
}

interface Props {
  countries: ToneMapCountry[];
  /** Highlighted right now — hover or selection. Shared with the rows below. */
  active: string | null;
  /** Clicked open. Gets a heavier outline that survives the mouse leaving. */
  selected: string | null;
  onHover: (country: string | null) => void;
  onSelect: (country: string) => void;
  /** The two biggest stories for a country, for the tap-a-country sheet.
   *  Optional: without it the map behaves exactly as before. */
  articlesFor?: (country: string) => ToneCardArticle[];
  /** Per-country stats for the sheet header. */
  statsFor?: (country: string) => { flag: string; n: number; confident: boolean } | null;
  /** "See everything" in the sheet, which opens the drill-down below. */
  onExpand?: (country: string) => void;
}

/** Zoom bounds. 1 is the fitted view; beyond 6 the 110m geometry is visibly
 *  faceted and there is nothing more to see. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

const CONTEXT_FILL = "rgba(17,17,17,0.05)";
const BORDER = "rgba(17,17,17,0.12)";

/**
 * Pan and zoom over the projected map.
 *
 * Deliberately transform-only: the viewBox stays fixed and a <g> carries a
 * translate/scale, so the browser composites it instead of re-rasterising a
 * few thousand path segments on every frame. Panning a viewBox is the obvious
 * implementation and it drops frames on a phone.
 */
function useMapView(enabled: boolean) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ dist: number; k: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const clamp = useCallback((v: { x: number; y: number; k: number }) => {
    const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k));
    // Never pan so far that the map leaves the frame: the visible half-extent
    // grows with the zoom, so the bound has to as well.
    const maxX = (MAP_VIEWBOX.width * (k - 1)) / 2;
    const maxY = (MAP_VIEWBOX.height * (k - 1)) / 2;
    return {
      k,
      x: Math.min(maxX, Math.max(-maxX, v.x)),
      y: Math.min(maxY, Math.max(-maxY, v.y)),
    };
  }, []);

  const reset = useCallback(() => setView({ x: 0, y: 0, k: 1 }), []);
  const zoomBy = useCallback(
    (factor: number) => setView((v) => clamp({ ...v, k: v.k * factor })),
    [clamp]
  );

  // Leaving fullscreen returns to the fitted view, so reopening never starts
  // in whatever corner the last session ended in.
  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!enabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k };
      drag.current = null;
    }
  }, [enabled, view.x, view.y, view.k]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!enabled || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const next = pinch.current.k * (dist / pinch.current.dist);
      setView((v) => clamp({ ...v, k: next }));
      return;
    }
    if (drag.current) {
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      // Pointer pixels to viewBox units, so a drag tracks the finger 1:1 at
      // any container size.
      const scale = MAP_VIEWBOX.width / (rect.width || 1);
      setView((v) =>
        clamp({
          ...v,
          x: drag.current!.vx + (e.clientX - drag.current!.x) * scale,
          y: drag.current!.vy + (e.clientY - drag.current!.y) * scale,
        })
      );
    }
  }, [enabled, clamp]);

  const endPointer = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }, []);

  return { view, reset, zoomBy, onPointerDown, onPointerMove, endPointer };
}


export default function ToneMap({
  countries, active, selected, onHover, onSelect, articlesFor, statsFor, onExpand,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  // Portals need a DOM, so the overlay only exists after mount. Without this
  // the server render and the first client render disagree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { view, reset, zoomBy, onPointerDown, onPointerMove, endPointer } = useMapView(fullscreen);

  // Escape closes fullscreen, which is the one keyboard affordance a
  // full-viewport overlay genuinely owes the user.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    // The overlay covers the page; letting the body scroll behind it means
    // closing it drops the reader somewhere else entirely.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Where the selected country actually is on screen, so the sheet can sit
  // beside it instead of in a far corner. Measured off the rendered path,
  // which already carries the pan/zoom transform — recomputing the projection
  // by hand would be a second source of truth, free to drift from the first.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (!fullscreen || !selected || !stageRef.current) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const stageEl = stageRef.current;
      const path = stageEl?.querySelector<SVGPathElement>(
        `path[data-country="${CSS.escape(selected)}"]`
      );
      if (!stageEl || !path) return setAnchor(null);
      const pr = path.getBoundingClientRect();
      const sr = stageEl.getBoundingClientRect();
      setAnchor({ x: pr.left - sr.left, y: pr.top - sr.top, w: pr.width, h: pr.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fullscreen, selected, view.x, view.y, view.k]);

  /**
   * Sheet position, in stage coordinates.
   *
   * Beside the country, on whichever side has room, vertically centred on it
   * and clamped to the stage. Null in the inline map, which is too small to
   * put a 400px card next to anything — there it stays a bottom sheet.
   */
  const placement = (() => {
    if (!fullscreen || !anchor || !stageRef.current) return null;
    const stageEl = stageRef.current.getBoundingClientRect();
    const W = 400;
    const H = Math.min(340, stageEl.height - 24);
    const GAP = 18;
    const rightRoom = stageEl.width - (anchor.x + anchor.w);
    const side: "right" | "left" = rightRoom >= W + GAP ? "right" : "left";
    let left = side === "right" ? anchor.x + anchor.w + GAP : anchor.x - W - GAP;
    left = Math.max(12, Math.min(stageEl.width - W - 12, left));
    let top = anchor.y + anchor.h / 2 - H / 2;
    top = Math.max(12, Math.min(stageEl.height - H - 12, top));
    return { left, top, side };
  })();

  const sheetCountry = selected;
  const sheetStats = sheetCountry && statsFor ? statsFor(sheetCountry) : null;
  const sheetArticles = sheetCountry && articlesFor ? articlesFor(sheetCountry) : [];
  const sheetIndex = countries.find((c) => c.country === sheetCountry)?.index ?? null;

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const byCode = new Map(countries.map((c) => [c.code, c]));
  // Weight is relative to the busiest country in the frame, not an absolute
  // scale: on a quiet day the leader should still read as the leader.
  const maxN = Math.max(1, ...countries.map((c) => c.n ?? 0));
  // The key is only earned when something on the map is actually hatched.
  const hasThin = countries.some((c) => c.index != null && c.confident === false);

  // The band is stated, not hidden. Compressing 0-100 into 35-65 is what
  // makes near-50 countries distinguishable at all, and a reader is entitled
  // to know the scale was compressed.
  const legend = (
      <div
        className="tone-map__legend"
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
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <span
            aria-hidden
            style={{
              width: "26px", height: "9px", borderRadius: "2px",
              background: `linear-gradient(90deg, ${toneFill(50)}66, ${toneFill(50)})`,
              border: "1px solid rgba(17,17,17,0.12)",
            }}
          />
          sa shumë shkruajnë
        </span>
        {hasThin && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <span
              aria-hidden
              style={{
                width: "13px", height: "9px", borderRadius: "2px",
                border: "1px solid rgba(17,17,17,0.15)",
                background:
                  "repeating-linear-gradient(45deg, rgba(17,17,17,0.28) 0 1.5px, transparent 1.5px 4px)",
              }}
            />
            mbulim i pjesshëm
          </span>
        )}
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
          shkalla {BAND.lo}–{BAND.hi}
        </span>
      </div>
  );

  const stage = (
    <div className="tone-map__stage" ref={stageRef}>
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Harta e tonit të medias sipas vendit"
        className="tone-map__svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <title>Toni i medias sipas vendit</title>
        {/* One transform for the whole scene. See useMapView: the viewBox is
            fixed and this <g> moves, so panning composites instead of
            re-rasterising every path. */}
        <g
          transform={`translate(${view.x} ${view.y}) scale(${view.k}) translate(${(MAP_VIEWBOX.width * (1 - view.k)) / (2 * view.k)} ${(MAP_VIEWBOX.height * (1 - view.k)) / (2 * view.k)})`}
        >

        {/* One hatch mask per tracked shape would be wasteful; instead a
            single diagonal pattern is laid over the band colour, which stays
            underneath so the country still reads at its measured tone. */}
        <defs>
          <pattern id={`thin-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#FFFFFF" fillOpacity="0.55" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#FFFFFF" strokeWidth="3" />
          </pattern>
        </defs>

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
          const thin = data?.index != null && data.confident === false;
          const label = data
            ? `${data.country}: ${data.index ?? "pa të dhëna"} — ${toneLabel(data.index)}` +
              (thin ? " (mbulim i pjesshëm)" : "")
            : s.code;
          return (
            <g key={`hit-${uid}-${i}`}>
            <path
              data-country={data?.country || undefined}
              d={s.d}
              fill={toneFill(data?.index ?? null)}
              // Never below 0.4: a country with one article still has to be
              // visible and clickable, just visibly slighter.
              fillOpacity={data?.index == null ? 1 : 0.4 + 0.6 * Math.sqrt((data.n ?? 0) / maxN)}
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
            {/* Drawn over the fill and deaf to the pointer, so the hatch never
                intercepts a click meant for the country under it. */}
            {thin && (
              <path
                d={s.d}
                fill={`url(#thin-${uid})`}
                pointerEvents="none"
                style={{
                  transition: "opacity 160ms var(--ease-out)",
                  opacity: active && !on && !isOpen ? 0.5 : 1,
                }}
              />
            )}
            </g>
          );
        })}
        </g>
      </svg>

      {/* Toolbar. Zoom controls only exist in fullscreen — inline they would
          be three buttons over a map that already fits. */}
      <div className="tone-map__tools">
        {fullscreen ? (
          <>
            <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zmadho"><Plus size={15} strokeWidth={2.4} /></button>
            <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zvogëlo"><Minus size={15} strokeWidth={2.4} /></button>
            <button type="button" onClick={reset} aria-label="Rikthe pamjen"><RotateCcw size={14} strokeWidth={2.4} /></button>
            <button type="button" onClick={() => setFullscreen(false)} aria-label="Mbyll hartën"><X size={15} strokeWidth={2.4} /></button>
          </>
        ) : (
          <button type="button" onClick={() => setFullscreen(true)} aria-label="Zgjero hartën" className="tone-map__expand">
            <Maximize2 size={14} strokeWidth={2.4} /> Zgjero
          </button>
        )}
      </div>

      {/* What the country actually said, where the tap happened. Without this
          a tap on a phone only recoloured a shape and the answer stayed far
          below the fold. Lives inside the stage so it anchors to the map in
          both the inline and the fullscreen layout. */}
      {sheetCountry && (
        <div
          className={
            "tone-sheet-anchor" + (placement ? ` tone-sheet-anchor--${placement.side}` : "")
          }
          style={placement ? { left: placement.left, top: placement.top } : undefined}
        >
        <ToneMapSheet
          country={sheetCountry}
          flag={sheetStats?.flag ?? ""}
          index={sheetIndex}
          n={sheetStats?.n ?? 0}
          confident={sheetStats?.confident ?? true}
          articles={sheetArticles}
          onClose={() => onSelect(sheetCountry)}
          onExpand={onExpand ? () => { setFullscreen(false); onExpand(sheetCountry); } : undefined}
        />
        </div>
      )}
    </div>
  );

  return (
    // Full width. It was capped at 560px while it covered five countries and
    // half an ocean; with sixteen countries and a Europe-weighted crop the
    // map is the primary object in the module and gets the room.
    //
    // The fullscreen overlay is portalled to <body> and it has to be. The
    // module wraps this in a framer-motion div, and a transformed ancestor
    // becomes the containing block for position:fixed — so "fullscreen" was
    // rendering at the size of the card, with the site nav painted over it.
    <div className="tone-map">
      {fullscreen && mounted
        ? createPortal(
            <div className="tone-map tone-map--full">
              {stage}
              {legend}
            </div>,
            document.body
          )
        : stage}

      {/* Inline only: in fullscreen the legend rides along inside the portal,
          otherwise it would render behind the overlay. */}
      {!fullscreen && legend}
    </div>
  );
}

