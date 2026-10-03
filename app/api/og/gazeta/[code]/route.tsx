import { ImageResponse } from "next/og";
import { dardaniPng, garamond, manrope, picture } from "@/lib/og-assets";
import { loadSharedPaper } from "@/lib/paper-snapshot-server";
import { genitive, paperName } from "@/lib/reader-name.mjs";

/**
 * A reader's shared front page as a picture:
 *
 *   /api/og/gazeta/<code>?f=feed    1080×1350 — WhatsApp, Facebook, the feed
 *   /api/og/gazeta/<code>?f=story   1080×1920 — Instagram/Facebook Stories
 *
 * Drawn from the same snapshot as /gazeta/<code> (lib/paper-snapshot-server),
 * with the same validation and expiry: an invalid code is 404, an expired one
 * 410, so a picture never outlives its page. Anyone can mint a valid code, so
 * the work per image is bounded: one light query, and only the lead story's
 * picture is fetched, with a short timeout and a byte cap.
 */

type Theme = { bg: string; ink: string; soft: string; rule: string; accent: string; serif: boolean };

const ACCENT: Record<string, string> = {
  portokalli: "#FF4422",
  blu: "#2563EB",
  gjelber: "#16A34A",
  vjollce: "#7C3AED",
  kuqe: "#DC2626",
};

function themeFor(style: string, accent: string): Theme {
  const a = ACCENT[accent] ?? ACCENT.portokalli;
  if (style === "nate") return { bg: "#15110F", ink: "#F7F2EB", soft: "#B5A99E", rule: "#3B332D", accent: a, serif: true };
  if (style === "moderne") return { bg: "#FFFFFF", ink: "#111111", soft: "#5E5048", rule: "#E3DBD1", accent: a, serif: false };
  return { bg: "#FBF8F4", ink: "#111111", soft: "#5E5048", rule: "#E3DBD1", accent: a, serif: true };
}

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
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
  const name = paper.snapshot.name;
  const plate = name && genitive(name) ? paperName(name) : "Gazeta ime";
  const [lead, ...rest] = paper.edition;
  const rows = rest.slice(0, story ? 6 : 3);
  const leadImg = await picture(lead.imageUrl, {
    width: 952,
    height: story ? 500 : 330,
    timeoutMs: 4000,
    maxBytes: 5_000_000,
    tag: "[gazeta-og]",
  });
  const dardani = await dardaniPng("dardani-flying-news.png", "[gazeta-og]");
  const fonts = [...(await manrope()), ...(t.serif ? [await garamond()] : [])];
  const headFont = t.serif ? "EB Garamond" : "Manrope";
  const sections = paper.sections.map((s) => s.title).slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: t.bg,
          color: t.ink,
          padding: story ? "88px 64px 72px" : "56px 64px 48px",
          fontFamily: "Manrope",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30, color: t.soft }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: t.ink }}>
            383<span style={{ color: t.accent }}>.</span>
          </div>
          <div style={{ display: "flex", textTransform: "uppercase", letterSpacing: 3, fontWeight: 800 }}>{dayLabel(paper.snapshot.date)}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: story ? 40 : 22,
            paddingBottom: 14,
            borderBottom: `3px solid ${t.ink}`,
            fontFamily: headFont,
            fontSize: plate.length > 18 ? 84 : 104,
            fontWeight: t.serif ? 700 : 800,
            letterSpacing: t.serif ? -2 : -4,
            lineHeight: 1,
          }}
        >
          {plate}
        </div>
        {/* The second line of a newspaper's double rule (satori has no "double"). */}
        <div style={{ display: "flex", flexShrink: 0, height: 3, marginTop: 4, background: t.ink }} />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
            padding: "10px 0",
            borderBottom: `2px solid ${t.ink}`,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: t.soft,
          }}
        >
          {`${paper.edition.length} lajmet e mia për sot`}
        </div>

        <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", marginTop: story ? 40 : 26 }}>
          {leadImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={leadImg} width={952} height={story ? 500 : 330} style={{ objectFit: "cover", borderRadius: 28 }} alt="" />
          )}
          <div
            style={{
              display: "block",
              marginTop: leadImg ? 22 : 8,
              fontFamily: headFont,
              fontSize: story ? 58 : 46,
              fontWeight: t.serif ? 700 : 800,
              lineHeight: 1.12,
              letterSpacing: -1,
              lineClamp: story ? 3 : 2,
              overflow: "hidden",
            }}
          >
            {lead.title}
          </div>
        </div>

        <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", marginTop: 18 }}>
          {rows.map((a, i) => (
            <div key={a.slug} style={{ display: "flex", alignItems: "flex-start", padding: "16px 0", borderTop: `2px solid ${t.rule}` }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  width: 48,
                  height: 48,
                  marginRight: 22,
                  borderRadius: 24,
                  background: t.ink,
                  color: t.bg,
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                {i + 2}
              </div>
              <div style={{ display: "block", flex: 1, fontSize: 32, fontWeight: 800, lineHeight: 1.25, lineClamp: 2, overflow: "hidden" }}>
                {a.title}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        {sections.length > 0 && (
          <div style={{ display: "flex", flexShrink: 0, flexWrap: "wrap", marginBottom: 22 }}>
            {sections.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  marginRight: 12,
                  marginTop: 10,
                  padding: "8px 20px",
                  borderRadius: 999,
                  border: `2px solid ${t.rule}`,
                  fontSize: 26,
                  fontWeight: 800,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", padding: "18px 24px", borderRadius: 28, background: t.accent, color: "#FFFFFF" }}>
          {dardani && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dardani} width={126} height={102} style={{ marginRight: 20 }} alt="" />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Bëj gazetën tënde</div>
            <div style={{ display: "flex", fontSize: 28, opacity: 0.9 }}>383ks.com/per-ty</div>
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
