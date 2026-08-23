/**
 * The Toni mark: a dial with a needle a little off centre.
 *
 * Authored rather than borrowed. Every stock option said the wrong thing — a
 * globe is a world map, a chart is a trend line, a thermometer is weather —
 * and Toni is none of those. It is a reading taken off a scale that runs
 * critical to positive, so the mark is the scale and the needle sitting on it.
 * The needle leans right of centre because the index has never been exactly 50
 * and a mark pointing dead centre would read as "no data".
 *
 * Drawn on lucide's grid (24×24, 2px round stroke, currentColor) so it sits in
 * a row of lucide icons without looking like a different set.
 */
export default function ToniGaugeIcon({
  size = 20,
  strokeWidth = 2.2,
  ...rest
}: {
  size?: number;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {/* The scale: a half dial, open at the bottom where the needle pivots. */}
      <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
      {/* Its two ends, marking the extremes the index runs between. */}
      <path d="M3.5 17h1.6M18.9 17h1.6" />
      {/* The needle, and the pin it turns on. */}
      <path d="M12 17 15.6 10.4" />
      <circle cx="12" cy="17" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}
