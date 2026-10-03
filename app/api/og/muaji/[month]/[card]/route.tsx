import { ImageResponse } from "next/og";
import { dardaniPng, manrope, picture } from "@/lib/og-assets";
import { getMonthWrapped, type MonthWrapped } from "@/lib/monthly-wrapped-server";
import { cardsFor, type WrappedCard } from "@/lib/monthly-wrapped.mjs";

/**
 * One card of "Tetori në 383" as a 1080×1920 image — the size Stories, TikTok
 * and Reels want. The wrapped page shows these same images, so what a reader
 * sees is exactly what they share.
 *
 *   /api/og/muaji/2026-10/hyrje   (hyrje · kosove · shqiperi · bote · emri · dita)
 *
 * Public newsroom data only. Set in Manrope, 383's own face, from the two
 * weights kept in public/wrapped/fonts (the Latin subset carries every
 * Albanian letter), so a build never depends on fetching a font.
 */

const W = 1080;
const H = 1920;

const THEME: Record<WrappedCard, { bg: string; ink: string; soft: string; accent: string }> = {
  hyrje: { bg: "#FF4422", ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)", accent: "#111111" },
  kosove: { bg: "#244AA5", ink: "#FFFFFF", soft: "rgba(255,255,255,0.75)", accent: "#F5C400" },
  shqiperi: { bg: "#C8102E", ink: "#FFFFFF", soft: "rgba(255,255,255,0.78)", accent: "#111111" },
  bote: { bg: "#111111", ink: "#FFFFFF", soft: "rgba(255,255,255,0.7)", accent: "#2DD4BF" },
  emri: { bg: "#5B21B6", ink: "#FFFFFF", soft: "rgba(255,255,255,0.75)", accent: "#FDE68A" },
  dita: { bg: "#FFC72C", ink: "#111111", soft: "rgba(17,17,17,0.72)", accent: "#C2340F" },
};

const number = (n: number) => n.toLocaleString("de-DE"); // 1.234, as Albanian writes it

function Frame({ card, w, children }: { card: WrappedCard; w: MonthWrapped; children: React.ReactNode }) {
  const t = THEME[card];
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: t.bg, color: t.ink, padding: "96px 88px", fontFamily: "Manrope", fontWeight: 500 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 40, letterSpacing: 2 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>
          383<span style={{ color: card === "hyrje" ? "#111111" : "#FF4422" }}>.</span>
        </div>
        <div style={{ display: "flex", color: t.soft, textTransform: "uppercase" }}>{w.title}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", color: t.soft, fontSize: 34 }}>
        <span>383ks.com</span>
        <span>
          {w.monthName} {w.year}
        </span>
      </div>
    </div>
  );
}

function Story({ card, label, story, image }: { card: WrappedCard; label: string; story: { title: string } | null; image: string | null }) {
  if (!story) return null;
  const t = THEME[card];
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} width={904} height={508} style={{ objectFit: "cover", borderRadius: 36, marginBottom: 36 }} alt="" />
      )}
      <div style={{ display: "flex", fontSize: 34, color: t.accent, textTransform: "uppercase", letterSpacing: 3 }}>{label}</div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 52, lineHeight: 1.2, fontWeight: 800, letterSpacing: -1 }}>{story.title}</div>
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ month: string; card: string }> }) {
  const { month, card: raw } = await params;
  const w = await getMonthWrapped(month);
  const card = raw as WrappedCard;
  if (!w || !cardsFor(w).includes(card)) return new Response("Not found", { status: 404 });
  const t = THEME[card];
  let body: React.ReactNode;

  if (card === "hyrje") {
    const wave = await dardaniPng("dardani-wave.png");
    body = (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 92, lineHeight: 1.02, fontWeight: 800, letterSpacing: -2 }}>{w.title}</div>
        <div style={{ display: "flex", fontSize: 300, lineHeight: 1, marginTop: 64, letterSpacing: -12, fontWeight: 800 }}>{number(w.total)}</div>
        <div style={{ display: "flex", fontSize: 54, color: t.soft, marginTop: 8 }}>lajme në {w.days} ditë.</div>
        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 96 }}>
          {wave && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wave} width={266} height={360} alt="" />
          )}
          <div style={{ display: "flex", fontSize: 44, lineHeight: 1.3, marginLeft: 36, marginBottom: 40, maxWidth: 560 }}>
            Ja çfarë ndodhi në {w.monthName}. Tërhiq, të tregoj unë.
          </div>
        </div>
      </div>
    );
  } else if (card === "kosove" || card === "shqiperi" || card === "bote") {
    const region = w.regions.find((r) => r.key === card)!;
    const image = await picture(region.top?.imageUrl);
    body = (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 110, fontWeight: 800, letterSpacing: -3 }}>{region.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 24 }}>
          <span style={{ fontSize: 220, lineHeight: 1, letterSpacing: -10, color: t.accent, fontWeight: 800 }}>{number(region.count)}</span>
          <span style={{ fontSize: 56, marginLeft: 24, color: t.soft }}>lajme</span>
        </div>
        <Story card={card} label="Lajmi i muajit" story={region.top} image={image} />
      </div>
    );
  } else if (card === "emri" && w.person) {
    const image = await picture(w.person.top?.imageUrl);
    body = (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 48, color: t.accent, textTransform: "uppercase", letterSpacing: 4 }}>Emri i muajit</div>
        <div style={{ display: "flex", fontSize: 140, lineHeight: 1.02, marginTop: 24, fontWeight: 800, letterSpacing: -4 }}>{w.person.name}</div>
        <div style={{ display: "flex", fontSize: 56, color: t.soft, marginTop: 28 }}>
          u përmend në {number(w.person.count)} lajme
        </div>
        <Story card={card} label="Më i lexuari" story={w.person.top} image={image} />
      </div>
    );
  } else if (card === "dita" && w.busiest) {
    body = (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 48, color: t.accent, textTransform: "uppercase", letterSpacing: 4 }}>
          Dita më e ngarkuar
        </div>
        <div style={{ display: "flex", fontSize: 120, lineHeight: 1.05, marginTop: 24, fontWeight: 800, letterSpacing: -3 }}>{w.busiest.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 40 }}>
          <span style={{ fontSize: 220, lineHeight: 1, letterSpacing: -10, fontWeight: 800 }}>{number(w.busiest.count)}</span>
          <span style={{ fontSize: 56, marginLeft: 24, color: t.soft }}>lajme në një ditë</span>
        </div>
        <Story card={card} label="Ajo ditë" story={w.busiest.top} image={null} />
      </div>
    );
  } else {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <Frame card={card} w={w}>
        {body}
      </Frame>
    ),
    {
      width: W,
      height: H,
      fonts: await manrope(),
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    }
  );
}
