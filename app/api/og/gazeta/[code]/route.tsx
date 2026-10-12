import { ImageResponse } from "next/og";
import sharp from "sharp";
import { garamond, manrope, picture } from "@/lib/og-assets";
import { loadSharedPaper } from "@/lib/paper-snapshot-server";
import { getCoverArtMap } from "@/lib/cover-art-server";
import { sharedTitle } from "@/lib/reader-name.mjs";

/**
 * A reader's shared paper, as the picture a chat shows under the link — set
 * like the paper's own cover (app/per-ty/paper/slides.tsx): the lead's photo
 * edge to edge, the headline in white over a dark fade, and on top whose paper
 * it is, so the friend knows what they were sent before they tap.
 *
 *   /api/og/gazeta/<code>             1200×630  — the link preview (WhatsApp,
 *                                                 Facebook, Messenger, X…)
 *   /api/og/gazeta/<code>?f=story     1080×1920 — Instagram/Facebook Stories
 *   /api/og/gazeta/<code>?f=feed      1080×1350 — a picture for the feed
 *
 * JPEG, not PNG: WhatsApp drops a preview picture much over 300 KB. Drawn from
 * the same snapshot as /gazeta/<code> (lib/paper-snapshot-server), with the
 * same validation and expiry: an invalid code is 404, an expired one 410.
 * Anyone can mint a valid code, so the work per picture is bounded: one light
 * query and one photo, fetched with a short timeout and a byte cap.
 *
 * Satori shrinks flex children that overflow, so every block is flexShrink: 0.
 */

/** The kinds of paper (lib/paper-look.mjs), with the spot colour reel.css uses. */
const ACCENT: Record<string, string> = {
  "e-perditshme": "#FF4422",
  sporti: "#12A150",
  tabloid: "#FF1F3D",
  bota: "#2F6BFF",
  biznes: "#12A0AA",
};

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const format = new URL(request.url).searchParams.get("f");
  const paper = await loadSharedPaper(code);
  if (paper.status === "invalid") {
    console.warn("[gazeta-og] rejected code", code.length);
    return new Response("Not found", { status: 404 });
  }
  if (paper.status === "expired") return new Response("Gone", { status: 410 });

  const tall = format === "story" || format === "feed";
  const W = tall ? 1080 : 1200;
  const H = format === "story" ? 1920 : format === "feed" ? 1350 : 630;
  const accent = ACCENT[paper.snapshot.look] ?? ACCENT["e-perditshme"];
  const name = paper.snapshot.name;
  const title = sharedTitle(name, paper.snapshot.title);
  const who = name ? `${name} të ndau gazetën e vet` : "Të ndanë një gazetë personale";
  const [lead, ...rest] = paper.edition;
  const next = rest.slice(0, 3);
  const more = paper.edition.length - 1;
  const inside = paper.sections.map((s) => s.title).slice(0, 3);

  const covers = await getCoverArtMap().catch(() => ({}) as Record<string, string>);
  const [photo, fonts] = await Promise.all([
    picture(lead.imageUrl || covers[lead.slug], { width: W, height: H, timeoutMs: 3500, maxBytes: 5_000_000, tag: "[gazeta-og]" }),
    Promise.all([manrope(), garamond()]).then(([m, g]) => [...m, g]),
  ]);

  const serif = "EB Garamond";
  const label = { fontFamily: "Manrope", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" as const };
  const pad = tall ? 64 : 48;

  const top = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: tall ? "16px 28px" : "11px 20px",
          borderRadius: 999,
          background: "#FFFFFF",
          color: "#151412",
          fontSize: tall ? 32 : 23,
          fontWeight: 800,
        }}
      >
        <div style={{ display: "flex", width: tall ? 14 : 11, height: tall ? 14 : 11, marginRight: tall ? 14 : 10, borderRadius: 99, background: accent }} />
        {who}
      </div>
      <div style={{ display: "flex", fontSize: tall ? 52 : 38, fontWeight: 800, letterSpacing: -1.5, color: "#FFFFFF" }}>
        383<span style={{ color: accent }}>.</span>
      </div>
    </div>
  );

  const headline = (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", color: accent, fontSize: tall ? 30 : 20, ...label }}>{`${title} · ${dayLabel(paper.snapshot.date)}`}</div>
      <div
        style={{
          display: "block",
          marginTop: tall ? 18 : 10,
          fontFamily: serif,
          fontWeight: 700,
          fontSize: format === "story" ? 92 : tall ? 80 : 56,
          lineHeight: 1.04,
          letterSpacing: -1,
          color: "#FFFFFF",
          lineClamp: tall ? 4 : 2,
          overflow: "hidden",
        }}
      >
        {clean(lead.title)}
      </div>
    </div>
  );

  const list = tall && next.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, marginTop: 40, borderTop: "2px solid rgba(255,255,255,0.3)" }}>
      {next.map((s) => (
        <div key={s.slug} style={{ display: "flex", flexDirection: "column", flexShrink: 0, padding: "22px 0", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
          <span style={{ display: "flex", color: accent, fontSize: 22, ...label }}>{s.category}</span>
          <span style={{ display: "block", marginTop: 6, fontFamily: serif, fontWeight: 700, fontSize: 40, lineHeight: 1.15, color: "#FFFFFF", lineClamp: 2, overflow: "hidden" }}>
            {clean(s.title)}
          </span>
        </div>
      ))}
    </div>
  );

  const foot = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginTop: tall ? 40 : 18 }}>
      <span style={{ display: "flex", color: "rgba(255,255,255,0.86)", fontSize: tall ? 30 : 21, fontWeight: 700 }}>
        {more > 0 ? `+ ${more} lajme të tjera${inside.length ? ` · ${inside.join(" · ")}` : ""}` : inside.join(" · ")}
      </span>
      <span
        style={{
          display: "flex",
          padding: tall ? "16px 30px" : "11px 22px",
          borderRadius: 999,
          background: accent,
          color: "#FFFFFF",
          fontSize: tall ? 30 : 21,
          fontWeight: 800,
        }}
      >
        {tall ? "Hape te 383ks.com" : "Shfletoje →"}
      </span>
    </div>
  );

  const image = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          position: "relative",
          background: `linear-gradient(160deg, ${accent}, #121212 75%)`,
          fontFamily: "Manrope",
          fontWeight: 600,
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} alt="" />
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: H,
            background: tall
              ? "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 45%, rgba(0,0,0,0.15) 72%, rgba(0,0,0,0.5) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.7) 42%, rgba(0,0,0,0.1) 75%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: pad }}>
          {top}
          <div style={{ display: "flex", flex: 1 }} />
          {headline}
          {list}
          {foot}
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
  const jpeg = await sharp(Buffer.from(await image.arrayBuffer()))
    .jpeg({ quality: tall ? 84 : 82, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      // The code is the paper: the same code always draws the same picture.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
