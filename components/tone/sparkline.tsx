// Minimal inline SVG sparkline — no charting dependency, matches the rest of
// the codebase's hand-rolled chart style.

export default function Sparkline({
  points,
  width = 160,
  height = 40,
  color = "#FF4422",
  minRange = 10,
  ariaLabel,
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  /**
   * Floor on the vertical extent, in the data's own units. Without it the
   * line auto-scales to min..max and a series that moved from 50 to 51 draws
   * as a mountain — this index sits inside a few points of 50 nearly always,
   * so free autoscaling here is a lie by default rather than by accident.
   */
  minRange?: number;
  ariaLabel?: string;
}) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const mid = (min + max) / 2;
  const range = Math.max(max - min, minRange);
  const lo = mid - range / 2;
  const pad = 4;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - lo) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}
