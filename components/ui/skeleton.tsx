// A shape we already know, drawn immediately. Deliberately NOT a client
// component: it ships no JS, renders in the first HTML flush, and holds the
// exact space the real content will occupy so nothing jumps when it arrives.
//
// Use this whenever the layout is predictable. Reach for DelayedSpinner only
// when it genuinely is not.

export function SectionSkeleton({
  rows = 3,
  height = 96,
  gap = 12,
}: {
  rows?: number;
  height?: number;
  gap?: number;
}) {
  return (
    <div aria-hidden="true" style={{ display: "grid", gap: `${gap}px` }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="ui-skeleton"
          style={{ height: `${height}px`, borderRadius: "12px" }}
        />
      ))}
    </div>
  );
}

/** Skeleton shaped like the lead story: one large image block plus text lines. */
export function LeadSkeleton() {
  return (
    <div aria-hidden="true" style={{ display: "grid", gap: "16px" }}>
      <div
        className="ui-skeleton"
        style={{ aspectRatio: "16 / 9", borderRadius: "16px" }}
      />
      <div className="ui-skeleton" style={{ height: "34px", borderRadius: "8px" }} />
      <div
        className="ui-skeleton"
        style={{ height: "20px", width: "70%", borderRadius: "8px" }}
      />
    </div>
  );
}

export default SectionSkeleton;
