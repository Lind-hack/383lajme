// Slim probability fill bar. `prob` is the YES ("PO") probability, 0..1.
// Green fill when PO leads, red when JO leads — matches the site's
// emerald/crimson category tokens, no invented colors.
export default function ProbabilityBar({
  prob,
  height = 5,
  showLabel = true,
}: {
  prob: number;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, prob)) * 100);
  const leading = pct >= 50;
  const color = leading ? "#00A651" : "#E41E20";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>Gjasa PO</span>
          <span style={{ fontSize: 15, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </div>
      )}
      <div className="tregu-prob-track" style={{ height }}>
        <div className="tregu-prob-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
