"use client";

export interface ChartPoint {
  t: string;
  marketProb: number | null;
  movementKind?: "trade" | "news_oracle" | null;
}

// One LMSR price series moves through real 383C bets and bounded news-oracle adjustments.
export default function ProbChart({ points, height = 220 }: { points: ChartPoint[]; height?: number }) {
  if (points.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  const width = 640;
  const padY = 18;
  const xFor = (i: number) => (i / (points.length - 1)) * width;
  const yFor = (p: number) => padY + (1 - p) * (height - padY * 2);
  const pathFor = (key: "marketProb") => points
    .map((point, i) => (point[key] === null ? null : `${points.slice(0, i).every((prior) => prior[key] === null) ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(point[key]!).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  const marketPath = pathFor("marketProb");
  const last = [...points].reverse().find((point) => point.marketProb !== null);
  if (!last || last.marketProb === null) return null;
  const lastColor = last.marketProb >= 0.5 ? "#00A651" : "#E41E20";

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Grafiku i probabilitetit PO nga çmimi LMSR">
        <line x1="0" y1={yFor(0.5)} x2={width} y2={yFor(0.5)} stroke="rgba(17,17,17,0.10)" strokeDasharray="4 4" />
        <path d={marketPath} fill="none" stroke={lastColor} strokeWidth="2.5" />
        {points.map((point, i) => {
          if (point.marketProb === null || !point.movementKind) return null;
          const x = xFor(i);
          const y = yFor(point.marketProb);
          const isNewsOracle = point.movementKind === "news_oracle";
          return <circle key={`${point.t}-${i}`} cx={x} cy={y} r="4" fill={isNewsOracle ? "#F59E0B" : "#00A651"}><title>{isNewsOracle ? "Lëvizje nga oracle i lajmeve" : "Lëvizje nga bast 383C"}</title></circle>;
        })}
        <circle cx={xFor(points.lastIndexOf(last))} cy={yFor(last.marketProb)} r="3" fill={lastColor} />
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 2, background: lastColor, display: "inline-block" }} /> Çmimi LMSR</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00A651", display: "inline-block" }} /> Bast 383C</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} /> Oracle lajmesh</span>
      </div>
    </div>
  );
}
