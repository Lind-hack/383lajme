import { ImageResponse } from "next/og";

export const contentType = "image/png";

const safeColor = (value: string | null) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ff4422";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "383 Tregu").slice(0, 140);
  const selection = (searchParams.get("selection") ?? "PO").slice(0, 48);
  const probability = Math.max(0, Math.min(1, Number(searchParams.get("probability")) || 0));
  const volume = Math.max(0, Number(searchParams.get("volume")) || 0);
  const accent = safeColor(searchParams.get("accent"));

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", color: "#111317", background: "#f8f5ef", padding: 64 }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: `12px solid ${accent}`, background: "#fff", padding: "44px 52px 42px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 900, letterSpacing: "-.04em" }}>383<span style={{ color: accent }}>.</span></div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: accent }}>TREGU</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", maxWidth: 950, fontSize: title.length > 86 ? 44 : 54, fontWeight: 850, lineHeight: 1.08, letterSpacing: "-.035em" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 900, letterSpacing: "-.06em", color: accent }}>{Math.round(probability * 100)}%</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{selection}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 23, fontWeight: 700, color: "#5c5f63" }}>
          <div style={{ display: "flex" }}>{Math.round(volume).toLocaleString("sq-AL")} 383C vëllim</div>
          <div style={{ display: "flex" }}>383ks.com/tregu</div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
