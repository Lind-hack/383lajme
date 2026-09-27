import { ImageResponse } from "next/og";

/* The shareable trade card: 1080×1350, the portrait size Instagram, TikTok and
   WhatsApp status all show uncropped. Dark on purpose — this image lives in
   feeds, not on the cream floor, and the ribbon's ink-black with its orange
   hairline is the one dark surface 383 already owns. */

const W = 1080;
const H = 1350;

const safeColor = (value: string | null) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ff4422";

/** Lift a team or category colour until it reads on the ink background. */
function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = () => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  for (let i = 0; i < 8 && lum() < 0.42; i++) {
    r = Math.round(r + (255 - r) * 0.22);
    g = Math.round(g + (255 - g) * 0.22);
    b = Math.round(b + (255 - b) * 0.22);
  }
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/* Manrope, fetched once per server instance. Google serves TTF to a client
   that does not advertise woff2, which is what satori needs. If the fetch
   fails the card still renders in the default face rather than erroring. */
const fontCache = new Map<number, Promise<ArrayBuffer | null>>();
function manrope(weight: number) {
  if (!fontCache.has(weight)) {
    fontCache.set(
      weight,
      (async () => {
        try {
          const css = await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}`, {
            headers: { "User-Agent": "Mozilla/4.0" },
            signal: AbortSignal.timeout(4000),
          }).then((r) => r.text());
          const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
          if (!url) return null;
          return await fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.arrayBuffer() : null));
        } catch {
          return null;
        }
      })().then((font) => {
        // A failed fetch is not cached: the next card gets another try.
        if (!font) fontCache.delete(weight);
        return font;
      })
    );
  }
  return fontCache.get(weight)!;
}

/** Downsampled probabilities, 0..1, oldest first. */
function parsePoints(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => Number(v) / 1000)
    .filter((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    .slice(-64);
}

function chartPaths(points: number[], width: number, height: number) {
  if (points.length < 2) return null;
  const min = Math.max(0, Math.min(...points) - 0.08);
  const max = Math.min(1, Math.max(...points) + 0.08);
  const span = Math.max(0.12, max - min);
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (p: number) => height - ((p - min) / span) * height;
  const coords = points.map((p, i) => [x(i), y(p)] as const);
  const line = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx.toFixed(1)} ${cy.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const [lx, ly] = coords[coords.length - 1];
  const grid = [0.25, 0.5, 0.75]
    .map((g) => min + span * g)
    .map((p) => ({ y: y(p), label: `${Math.round(p * 100)}%` }));
  return { line, area, lx, ly, grid };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "383 Tregu").slice(0, 160);
  const selection = (searchParams.get("selection") ?? "PO").slice(0, 40);
  const category = (searchParams.get("category") ?? "").slice(0, 24);
  const probability = Math.max(0, Math.min(1, Number(searchParams.get("probability")) || 0));
  const volume = Math.max(0, Number(searchParams.get("volume")) || 0);
  const accent = readableOn(safeColor(searchParams.get("accent")));
  const points = parsePoints(searchParams.get("points"));
  const hasHistory = points.length >= 2;
  const titleSize = hasHistory
    ? title.length > 110 ? 50 : title.length > 70 ? 58 : 68
    : title.length > 110 ? 56 : title.length > 60 ? 68 : title.length > 30 ? 84 : 104;
  /* Satori has no layout feedback, so the chart takes whatever height the
     title leaves: estimate the title's lines from its length and give the rest
     to the line, instead of a fixed chart floating under a gap. */
  const charsPerLine = Math.floor(952 / (titleSize * 0.53));
  const titleLines = Math.min(5, Math.ceil(title.length / charsPerLine));
  const fixed = 10 + 64 + 64 + 64 + 52 + 190 + 44 + 40 + 30 + 36 + 56;
  const chartHeight = Math.max(280, Math.min(620, H - fixed - titleLines * titleSize * 1.08));
  const chart = hasHistory ? chartPaths([...points, probability], 952, chartHeight) : null;

  const pct = Math.round(probability * 100);
  const multiple = probability > 0.005 ? (1 / probability).toFixed(2) : null;
  const change = points.length ? Math.round((probability - points[0]) * 100) : 0;

  const [regular, bold, heavy] = await Promise.all([manrope(500), manrope(700), manrope(800)]);
  const fonts = [
    regular && { name: "Manrope", data: regular, weight: 500 as const, style: "normal" as const },
    bold && { name: "Manrope", data: bold, weight: 700 as const, style: "normal" as const },
    heavy && { name: "Manrope", data: heavy, weight: 800 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 500 | 700 | 800; style: "normal" }[];

  const ink = "#17130E";
  const text = "#F1ECE3";
  const muted = "rgba(241,236,227,0.56)";
  const hair = "rgba(241,236,227,0.12)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: ink,
          color: text,
          fontFamily: fonts.length ? "Manrope" : undefined,
          position: "relative",
          borderTop: "10px solid #FF4422",
        }}
      >
        {/* The pick's colour, thrown from the upper right like the floor's
            flagship wash. One light source, nothing else per-market. */}
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -220,
            width: 900,
            height: 900,
            borderRadius: 900,
            background: `radial-gradient(circle, ${accent}38 0%, ${accent}00 62%)`,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "64px 64px 56px", position: "relative" }}>
          {/* Masthead */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: "-0.05em" }}>
                383<span style={{ color: "#FF4422" }}>.</span>
              </div>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: "0.18em", color: muted }}>TREGU</div>
            </div>
            {category ? (
              <div
                style={{
                  display: "flex",
                  padding: "12px 22px",
                  borderRadius: 100,
                  border: `2px solid ${hair}`,
                  fontSize: 24,
                  fontWeight: 700,
                  color: text,
                }}
              >
                {category}
              </div>
            ) : null}
          </div>

          {/* Without a chart the question, pick and bar sit as one block,
              centred between masthead and footer. */}
          {!chart && <div style={{ display: "flex", flex: 1 }} />}

          {/* Question */}
          <div
            style={{
              display: "flex",
              marginTop: chart ? 64 : 0,
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              maxWidth: 952,
            }}
          >
            {title}
          </div>

          {/* The pick and its price */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 52, gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: muted }}>Parashikimi</div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ display: "flex", width: 22, height: 22, borderRadius: 22, background: accent }} />
                <div style={{ display: "flex", fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em", color: accent }}>{selection}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={{ display: "flex", fontSize: 150, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 0.9 }}>{pct}%</div>
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 26, fontWeight: 700, color: muted }}>
                <span>gjasa</span>
                {multiple ? <span style={{ color: text }}>×{multiple} pagesa</span> : null}
                {change ? <span style={{ color: change > 0 ? "#3ED484" : "#FF6B7A" }}>{change > 0 ? "+" : "−"}{Math.abs(change)} pp</span> : null}
              </div>
            </div>
          </div>

          {/* Price history */}
          <div style={{ display: "flex", ...(chart ? { flex: 1 } : {}), marginTop: chart ? 44 : 64, position: "relative", alignItems: "flex-end" }}>
            {chart ? (
              <svg width={952} height={chartHeight} viewBox={`0 0 952 ${chartHeight}`}>
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {chart.grid.map((g) => (
                  <line key={g.label} x1="0" x2="952" y1={g.y} y2={g.y} stroke={hair} strokeWidth="2" strokeDasharray="4 10" />
                ))}
                <path d={chart.area} fill="url(#fill)" />
                <path d={chart.line} fill="none" stroke={accent} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={chart.lx} cy={chart.ly} r="22" fill={accent} opacity="0.22" />
                <circle cx={chart.lx} cy={chart.ly} r="11" fill={accent} stroke={ink} strokeWidth="4" />
              </svg>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 18 }}>
                {/* No recorded history yet: the price as one bar with its
                    scale, instead of an empty frame where a chart would be. */}
                <div style={{ display: "flex", width: "100%", height: 28, borderRadius: 28, background: hair }}>
                  <div style={{ display: "flex", width: `${Math.max(3, pct)}%`, height: 28, borderRadius: 28, background: accent }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 700, color: muted }}>
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>

          {!chart && <div style={{ display: "flex", flex: 1 }} />}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 40,
              paddingTop: 30,
              borderTop: `2px solid ${hair}`,
              fontSize: 26,
              fontWeight: 700,
              color: muted,
            }}
          >
            <div style={{ display: "flex" }}>{Math.round(volume).toLocaleString("sq-AL")} 383C vëllim</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, color: text }}>
              Parashiko në <span style={{ color: "#FF4422", fontWeight: 800 }}>383ks.com/tregu</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  );
}
