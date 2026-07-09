"use client";

export interface ChartPoint {
  t: string;
  aiProb: number | null;
  marketProb: number;
}

// Lightweight dependency-free SVG line chart: AI line (gold, dashed) vs market line (green/red solid).
export default function ProbChart({ points, height = 220 }: { points: ChartPoint[]; height?: number }) {
  if (points.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8B90A0",
          fontSize: 13,
        }}
      >
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  const width = 640;
  const padY = 18;
  const xFor = (i: number) => (i / (points.length - 1)) * width;
  const yFor = (p: number) => padY + (1 - p) * (height - padY * 2);

  const marketPath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(pt.marketProb).toFixed(1)}`)
    .join(" ");

  const aiPoints = points.filter((p) => p.aiProb !== null);
  const aiPath =
    aiPoints.length > 1
      ? points
          .map((pt, i) => (pt.aiProb === null ? null : `${aiPath0(i) ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(pt.aiProb).toFixed(1)}`))
          .filter(Boolean)
          .join(" ")
      : "";

  function aiPath0(i: number) {
    return points.slice(0, i).every((p) => p.aiProb === null);
  }

  const last = points[points.length - 1];
  const lastColor = last.marketProb >= 0.5 ? "#00E599" : "#FF3B5C";

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <line x1="0" y1={yFor(0.5)} x2={width} y2={yFor(0.5)} stroke="rgba(255,255,255,0.10)" strokeDasharray="4 4" />
        {aiPath && <path d={aiPath} fill="none" stroke="#F5B942" strokeWidth="2" strokeDasharray="5 4" opacity="0.85" />}
        <path d={marketPath} fill="none" stroke={lastColor} strokeWidth="2.5" />
        <circle cx={xFor(points.length - 1)} cy={yFor(last.marketProb)} r="4" fill={lastColor} />
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#8B90A0", fontWeight: 600 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 2, background: lastColor, display: "inline-block" }} /> Çmimi i tregut
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 2, background: "#F5B942", display: "inline-block", opacity: 0.85 }} /> Vlerësimi AI
        </span>
      </div>
    </div>
  );
}
