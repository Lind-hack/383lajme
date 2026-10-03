import { ImageResponse } from "next/og";
import { garamond, manrope, picture } from "@/lib/og-assets";
import { loadSharedPaper } from "@/lib/paper-snapshot-server";
import { sharedTitle } from "@/lib/reader-name.mjs";
import { coverWord } from "@/lib/per-ty-paper.mjs";

/**
 * A reader's shared paper as its cover — the same front page they see on top
 * of Për ty, as a picture:
 *
 *   /api/og/gazeta/<code>?f=feed    1080×1350 — WhatsApp, Facebook, the feed
 *   /api/og/gazeta/<code>?f=story   1080×1920 — Instagram/Facebook Stories
 *
 * Drawn from the same snapshot as /gazeta/<code> (lib/paper-snapshot-server),
 * with the same validation and expiry: an invalid code is 404, an expired one
 * 410, so a picture never outlives its page. Anyone can mint a valid code, so
 * the work per image is bounded: one light query, and only the lead story's
 * picture is fetched, with a short timeout and a byte cap.
 *
 * Satori has no `double` border and shrinks flex children that overflow, so
 * rules are drawn as separate lines and every block is flexShrink: 0.
 */

type Theme = { sheet: string; ink: string; soft: string; accent: string; accentInk: string; serif: boolean };

const ACCENT: Record<string, [string, string]> = {
  portokalli: ["#FF4422", "#B42A10"],
  blu: ["#2563EB", "#1D4ED8"],
  gjelber: ["#16A34A", "#15803D"],
  vjollce: ["#7C3AED", "#6D28D9"],
  kuqe: ["#DC2626", "#B91C1C"],
};

function themeFor(style: string, accent: string): Theme {
  const [a, aInk] = ACCENT[accent] ?? ACCENT.portokalli;
  if (style === "nate") return { sheet: "#1C1714", ink: "#F7F2EB", soft: "#B5A99E", accent: a, accentInk: "#FF8A70", serif: true };
  if (style === "moderne") return { sheet: "#FFFFFF", ink: "#111111", soft: "#5E5048", accent: a, accentInk: aInk, serif: false };
  return { sheet: "#FBF8F4", ink: "#111111", soft: "#5E5048", accent: a, accentInk: aInk, serif: true };
}

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

/** The word in one line, or split in two halves when it is long. */
function wordLines(word: string) {
  if (word.length <= 7) return [word];
  const half = Math.ceil(word.length / 2);
  return [word.slice(0, half), word.slice(half)];
}

/** Bars from the code, so every shared paper's barcode differs. */
function bars(seed: string) {
  let h = 2166136261;
  return Array.from({ length: 30 }, (_, i) => {
    h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 16777619) >>> 0;
    return 2 + (h % 4);
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const story = new URL(request.url).searchParams.get("f") === "story";
  const paper = await loadSharedPaper(code);
  if (paper.status === "invalid") {
    console.warn("[gazeta-og] rejected code", code.length);
    return new Response("Not found", { status: 404 });
  }
  if (paper.status === "expired") return new Response("Gone", { status: 410 });

  const W = 1080;
  const H = story ? 1920 : 1350;
  const t = themeFor(paper.snapshot.style, paper.snapshot.accent);
  const title = sharedTitle(paper.snapshot.name, paper.snapshot.title);
  const lead = paper.edition[0];
  const word = coverWord(lead, paper.snapshot.leadKey);
  const artW = W - 112;
  const artH = story ? 760 : 420;
  const art = await picture(lead.imageUrl, { width: artW, height: artH, timeoutMs: 4000, maxBytes: 5_000_000, tag: "[gazeta-og]" });
  const fonts = [...(await manrope()), ...(t.serif ? [await garamond()] : [])];
  const headFont = t.serif ? "EB Garamond" : "Manrope";
  const inside = paper.sections.map((s) => s.title).slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: t.sheet,
          color: t.ink,
          padding: story ? "80px 56px 64px" : "40px 56px 40px",
          fontFamily: "Manrope",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", flexShrink: 0, justifyContent: "space-between", alignItems: "center", fontSize: 24, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: t.soft }}>
          <span>{dayLabel(paper.snapshot.date)}</span>
          <span style={{ display: "flex", fontSize: 40, letterSpacing: -1.5, color: t.ink, textTransform: "none" }}>
            383<span style={{ color: t.accent }}>.</span>
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexShrink: 0,
            justifyContent: "center",
            marginTop: story ? 28 : 14,
            fontFamily: headFont,
            fontSize: title.length > 22 ? 78 : title.length > 16 ? 94 : 112,
            fontWeight: t.serif ? 700 : 800,
            letterSpacing: t.serif ? -2 : -5,
            lineHeight: 1,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", flexShrink: 0, height: 6, marginTop: 14, background: t.ink }} />
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            justifyContent: "space-between",
            padding: "8px 0",
            borderBottom: `2px solid ${t.ink}`,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: t.soft,
          }}
        >
          <span style={{ color: t.accentInk }}>Lajmet që zgjodha</span>
          <span>{`${paper.edition.length} lajme`}</span>
        </div>

        {/* The word across the sheet in solid ink, the art under it. On the
            live page the art shows through the letters; on a picture people
            share, legibility wins. */}
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, marginTop: story ? 36 : 18 }}>
          {wordLines(word).map((line) => (
            <div
              key={line}
              style={{
                display: "flex",
                fontSize: Math.min(story ? 280 : 240, Math.floor(artW / (Math.max(line.length, 3) * 0.66))),
                fontWeight: 800,
                lineHeight: 0.84,
                letterSpacing: -6,
                color: t.ink,
              }}
            >
              {line}
            </div>
          ))}
        </div>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={artW} height={artH} style={{ flexShrink: 0, marginTop: 18, objectFit: "cover", borderRadius: 6 }} alt="" />
        )}

        <div
          style={{
            display: "block",
            flexShrink: 0,
            marginTop: 22,
            fontFamily: headFont,
            fontSize: story ? 62 : 50,
            fontWeight: t.serif ? 700 : 800,
            lineHeight: 1.1,
            letterSpacing: -1,
            lineClamp: story ? 3 : 2,
            overflow: "hidden",
          }}
        >
          {lead.title}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        {inside.length > 0 && (
          <div style={{ display: "flex", flexShrink: 0, flexWrap: "wrap", marginBottom: 16, fontSize: 24, fontWeight: 800, color: t.soft }}>
            <span style={{ marginRight: 12, letterSpacing: 3, textTransform: "uppercase", color: t.accentInk }}>Brenda:</span>
            <span>{inside.join(" · ")}</span>
          </div>
        )}
        <div style={{ display: "flex", flexShrink: 0, height: 6, background: t.ink }} />
        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "stretch", height: 56, marginRight: 22 }}>
            {bars(code).map((w, i) => (
              <div key={i} style={{ display: "flex", width: w, marginRight: 2, background: i % 2 ? "transparent" : t.ink }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>Bëj gazetën tënde</span>
            <span style={{ fontSize: 24, color: t.soft }}>383ks.com/per-ty</span>
          </div>
          <div style={{ display: "flex", marginLeft: "auto", padding: "14px 26px", borderRadius: 999, background: t.accent, color: "#FFFFFF", fontSize: 26, fontWeight: 800 }}>
            Për ty
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
      headers: { "Cache-Control": "public, max-age=86400" },
    }
  );
}
