import { ImageResponse } from "next/og";
import sharp from "sharp";
import { garamond, manrope, picture } from "@/lib/og-assets";
import { loadSharedPaper } from "@/lib/paper-snapshot-server";
import { getCoverArtMap } from "@/lib/cover-art-server";
import { sharedTitle } from "@/lib/reader-name.mjs";
import { FRONT_STORIES } from "@/lib/paper-pages.mjs";

/**
 * A reader's shared paper, as the picture a chat shows under the link: its
 * front page — the paper's name, the lead with its photo and the next stories,
 * exactly as Faqja 1 — under one line saying whose paper it is, so the friend
 * knows what they were sent before they tap.
 *
 *   /api/og/gazeta/<code>             1200×630  — the link preview (WhatsApp,
 *                                                 Facebook, Messenger, X…)
 *   /api/og/gazeta/<code>?f=story     1080×1920 — Instagram/Facebook Stories
 *   /api/og/gazeta/<code>?f=feed      1080×1350 — a picture for the feed
 *
 * JPEG, not PNG: WhatsApp drops a preview picture much over 300 KB, and a
 * photo-heavy PNG runs to a megabyte. Drawn from the same snapshot as
 * /gazeta/<code> (lib/paper-snapshot-server), with the same validation and
 * expiry: an invalid code is 404, an expired one 410. Anyone can mint a valid
 * code, so the work per picture is bounded: one light query and one photo,
 * fetched with a short timeout and a byte cap.
 *
 * Satori shrinks flex children that overflow, so every block is flexShrink: 0.
 */

type Theme = { paper: string; ink: string; soft: string; rule: string; accent: string };

/** The kinds of paper (lib/paper-look.mjs), as app/per-ty/paper/newspaper.css draws them. */
const THEMES: Record<string, Theme> = {
  "e-perditshme": { paper: "#FDFCFA", ink: "#151412", soft: "#55514A", rule: "#DAD6CF", accent: "#B3261E" },
  sporti: { paper: "#FFFFFF", ink: "#151412", soft: "#55514A", rule: "#DDDDDD", accent: "#0A7F3F" },
  tabloid: { paper: "#FFFFFF", ink: "#151412", soft: "#55514A", rule: "#DDDDDD", accent: "#E1061B" },
  bota: { paper: "#F9F9F7", ink: "#151412", soft: "#55514A", rule: "#DAD9D4", accent: "#1D4F9F" },
  biznes: { paper: "#FFF1E5", ink: "#262A33", soft: "#4F5260", rule: "#EBD5C3", accent: "#0D7680" },
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
  const t = THEMES[paper.snapshot.look] ?? THEMES["e-perditshme"];
  const name = paper.snapshot.name;
  const title = sharedTitle(name, paper.snapshot.title);
  const who = name ? `${name} të ndau gazetën e vet` : "Dikush të ndau gazetën e vet";
  const [lead, ...rest] = paper.edition;
  const stories = rest.slice(0, FRONT_STORIES);
  const inside = paper.sections.map((s) => s.title).slice(0, 4);

  const photoW = tall ? W - 96 : 620;
  const photoH = format === "story" ? 700 : format === "feed" ? 430 : 236;
  const covers = await getCoverArtMap().catch(() => ({}) as Record<string, string>);
  const [photo, fonts] = await Promise.all([
    picture(covers[lead.slug] || lead.imageUrl, { width: photoW, height: photoH, timeoutMs: 3500, maxBytes: 5_000_000, tag: "[gazeta-og]" }),
    Promise.all([manrope(), garamond()]).then(([m, g]) => [...m, g]),
  ]);

  const serif = "EB Garamond";
  const label = { fontFamily: "Manrope", fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" as const };

  const strip = (
    <div style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "space-between", height: tall ? 96 : 62, padding: tall ? "0 48px" : "0 40px", background: t.ink, color: "#FFFFFF" }}>
      <span style={{ display: "flex", fontSize: tall ? 32 : 24, fontWeight: 700 }}>{who}</span>
      <span style={{ display: "flex", fontSize: tall ? 40 : 30, fontWeight: 800, letterSpacing: -1 }}>
        383<span style={{ color: t.accent }}>.</span>
      </span>
    </div>
  );

  const plate = (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, alignItems: tall ? "center" : "flex-start" }}>
      <div style={{ display: "flex", fontFamily: serif, fontWeight: 700, fontSize: tall ? (title.length > 20 ? 92 : 112) : title.length > 22 ? 48 : 58, letterSpacing: -1.5, lineHeight: 1 }}>{title}</div>
      <div style={{ display: "flex", alignSelf: "stretch", height: 1, marginTop: tall ? 18 : 10, background: t.ink }} />
      <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", padding: tall ? "10px 0" : "6px 0", fontSize: tall ? 24 : 16, color: t.soft, ...label }}>
        <span>{dayLabel(paper.snapshot.date)}</span>
        <span>{`${paper.edition.length === 1 ? "1 lajm" : `${paper.edition.length} lajme`} · Faqja 1`}</span>
      </div>
      <div style={{ display: "flex", alignSelf: "stretch", height: tall ? 5 : 4, background: t.ink }} />
    </div>
  );

  const leadBlock = (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, marginTop: tall ? 30 : 14 }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} width={photoW} height={photoH} style={{ objectFit: "cover" }} alt="" />
      ) : (
        <div style={{ display: "flex", width: photoW, height: tall ? 24 : 0 }} />
      )}
      <div style={{ display: "flex", marginTop: tall ? 22 : 12, fontSize: tall ? 24 : 15, color: t.accent, ...label }}>{lead.category}</div>
      <div
        style={{
          display: "block",
          marginTop: tall ? 8 : 4,
          fontFamily: serif,
          fontWeight: 700,
          fontSize: format === "story" ? 64 : tall ? 54 : 33,
          lineHeight: 1.08,
          letterSpacing: -0.5,
          lineClamp: tall ? 3 : 2,
          overflow: "hidden",
        }}
      >
        {clean(lead.title)}
      </div>
    </div>
  );

  const list = (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {stories.map((s, i) => (
        <div
          key={s.slug}
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            paddingTop: i === 0 ? 0 : tall ? 20 : 13,
            marginTop: i === 0 ? 0 : tall ? 20 : 13,
            borderTop: i === 0 ? "none" : `1px solid ${t.rule}`,
          }}
        >
          <span style={{ display: "flex", fontSize: tall ? 21 : 13, color: t.accent, ...label }}>{s.category}</span>
          <span
            style={{
              display: "block",
              marginTop: tall ? 6 : 3,
              fontFamily: serif,
              fontWeight: 700,
              fontSize: tall ? 38 : 23,
              lineHeight: 1.14,
              lineClamp: 2,
              overflow: "hidden",
            }}
          >
            {clean(s.title)}
          </span>
        </div>
      ))}
    </div>
  );

  const insideLine = inside.length > 0 && (
    <div style={{ display: "flex", flexShrink: 0, flexWrap: "wrap", fontSize: tall ? 24 : 15, fontWeight: 700, color: t.soft }}>
      <span style={{ marginRight: 10, color: t.ink, ...label }}>Brenda:</span>
      <span>{inside.join(" · ")}</span>
    </div>
  );

  const foot = (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "space-between",
        height: tall ? 120 : 54,
        padding: tall ? "0 48px" : "0 40px",
        borderTop: `${tall ? 3 : 2}px solid ${t.ink}`,
      }}
    >
      <span style={{ display: "flex", fontSize: tall ? 30 : 19, fontWeight: 800 }}>Hape dhe kthe faqet →</span>
      <span style={{ display: "flex", alignItems: "center", fontSize: tall ? 26 : 17, color: t.soft }}>
        Bëj tënden te
        <span style={{ display: "flex", marginLeft: 10, padding: tall ? "12px 24px" : "7px 16px", borderRadius: 999, background: t.accent, color: "#FFFFFF", fontWeight: 800 }}>
          383ks.com/per-ty
        </span>
      </span>
    </div>
  );

  const body = tall ? (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: format === "story" ? "56px 48px 32px" : "36px 48px 24px" }}>
      {plate}
      {leadBlock}
      <div style={{ display: "flex", flexShrink: 0, height: 2, margin: format === "story" ? "36px 0 30px" : "26px 0 22px", background: t.ink }} />
      {list}
      <div style={{ display: "flex", flex: 1 }} />
      {insideLine}
    </div>
  ) : (
    <div style={{ display: "flex", flex: 1, padding: "22px 40px 16px" }}>
      <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, width: photoW }}>
        {plate}
        {leadBlock}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 30, paddingLeft: 28, borderLeft: `1px solid ${t.rule}` }}>
        <span style={{ display: "flex", flexShrink: 0, marginBottom: 14, fontSize: 14, color: t.soft, ...label }}>Në faqen e parë</span>
        {list}
        <div style={{ display: "flex", flex: 1 }} />
        {insideLine}
      </div>
    </div>
  );

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: t.paper, color: t.ink, fontFamily: "Manrope", fontWeight: 500 }}>
        {strip}
        {body}
        {foot}
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
