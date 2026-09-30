// Where today sits between bad and good news for Kosovo's image — the picture
// that makes "44" mean something without reading the method.
//
// The bar is the same five-step scale the map and the swatches use (toneFill),
// drawn as a gradient, and positions use the same band, so a marker's colour
// on this bar and a country's colour on the map always agree. Words at the
// ends, never numbers: the band is compressed (see BAND in lib/tone-scale).

import { TONE_COLOR, bandPosition, toneLabel } from "@/lib/tone-scale";
import s from "./tone-scale-bar.module.css";

export default function ToneScaleBar({
  index,
  previous,
  size = "lg",
}: {
  index: number | null;
  /** Yesterday's reading, drawn as a hollow marker for comparison. */
  previous?: number | null;
  size?: "lg" | "sm";
}) {
  const pos = (v: number) => `${(bandPosition(v) * 100).toFixed(1)}%`;
  /** Near an end, a centred label would hang off the bar; anchor it inward. */
  const edge = (v: number) => (bandPosition(v) < 0.1 ? "start" : bandPosition(v) > 0.9 ? "end" : undefined);
  const label =
    index == null
      ? "Indeksi i sotëm ende po llogaritet"
      : `Indeksi sot ${index} nga 100, ${toneLabel(index)}` +
        (previous != null ? `; dje ${previous}` : "");

  return (
    <div className={s.scale} data-size={size} role="img" aria-label={label}>
      <div className={s.track}>
        <span
          className={s.bar}
          style={{
            background: `linear-gradient(90deg, ${TONE_COLOR.critical} 0%, ${TONE_COLOR.criticalSoft} 30%, ${TONE_COLOR.neutral} 50%, ${TONE_COLOR.positiveSoft} 70%, ${TONE_COLOR.positive} 100%)`,
          }}
        />
        <span className={s.mid} aria-hidden />

        {previous != null && (
          <span className={s.ghost} style={{ left: pos(previous) }} data-edge={edge(previous)} aria-hidden>
            <span className={s.ghostDot} />
            <span className={s.ghostLabel}>{previous} dje</span>
          </span>
        )}

        {index != null && (
          <span className={s.marker} style={{ ["--to" as string]: pos(index) }} data-edge={edge(index)} aria-hidden>
            <span className={s.markerLabel}>
              {index} <em>sot</em>
            </span>
            <span className={s.pin} />
          </span>
        )}
      </div>

      <div className={s.ends} aria-hidden>
        <span>Lajme të këqija</span>
        <span>Baraspeshë</span>
        <span>Lajme të mira</span>
      </div>
    </div>
  );
}
