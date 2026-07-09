// Red -> green slider. `prob` is the YES probability, 0..1.
export default function ProbabilityBar({
  prob,
  height = 8,
  showLabel = true,
}: {
  prob: number;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, prob)) * 100);
  const color = pct >= 50 ? "#00A651" : "#E41E20";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="tregu-prob-track" style={{ height }}>
        <div
          className="tregu-prob-marker"
          style={{
            left: `${pct}%`,
            width: height + 6,
            height: height + 6,
            boxShadow: `0 0 0 3px rgba(255,255,255,0.9), 0 0 14px ${color}`,
          }}
        />
      </div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B6B6B", fontWeight: 700 }}>
          <span style={{ color: "#E41E20" }}>JO</span>
          <span style={{ color, fontSize: 13 }}>{pct}%</span>
          <span style={{ color: "#00A651" }}>PO</span>
        </div>
      )}
    </div>
  );
}
