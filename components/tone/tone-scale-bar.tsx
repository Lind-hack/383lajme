// Where today sits between bad and good news for Kosovo's image — the picture
// that makes "44" mean something without reading the method.
//
// The bar runs the full 0–100 the index is measured on, so 100 is its end. Its
// gradient changes colour exactly where toneFill does (the 30–70 band's five
// steps fall at 38, 46, 54 and 62), so a marker's colour on this bar and a
// country's colour on the map still agree.

import { TONE_COLOR, scalePosition, toneLabel } from "@/lib/tone-scale";
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
  const pos = (v: number) => `${(scalePosition(v) * 100).toFixed(1)}%`;
  /** Near an end, a centred label would hang off the bar; anchor it inward. */
  const edge = (v: number) => (scalePosition(v) < 0.1 ? "start" : scalePosition(v) > 0.9 ? "end" : undefined);
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
            background: `linear-gradient(90deg, ${TONE_COLOR.critical} 0%, ${TONE_COLOR.critical} 34%, ${TONE_COLOR.criticalSoft} 42%, ${TONE_COLOR.neutral} 50%, ${TONE_COLOR.positiveSoft} 58%, ${TONE_COLOR.positive} 66%, ${TONE_COLOR.positive} 100%)`,
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
        <span>0 · Portretizim negativ</span>
        <span>50 · Baraspeshë</span>
        <span>Portretizim pozitiv · 100</span>
      </div>
    </div>
  );
}
