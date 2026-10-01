// The look of every league email: one dark 383 header, Dardani reacting to the
// news, a real podium, the gap to the next place, the next matches and what a
// surprise pays, and a footer that says why the email came.
//
// Email, not web: tables and inline styles only, no CSS gradients that Outlook
// drops, absolute image URLs, PNG not WebP. Everything degrades to readable
// text on a plain background.

const SITE = "https://383ks.com";
const INK = "#17130E";
const PAPER = "#FCF8F1";
const PAGE = "#EFE8DD";
const ORANGE = "#FF4422";
const MUTED = "#7A6A5C";
const GOLD = "#F2C14E";
const SILVER = "#D5D2CC";
const BRONZE = "#D9A574";

export const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export const fmt = (value: number) => Math.round(Number(value) || 0).toLocaleString("sq-AL");

export type SnapshotRow = { place: number; name: string; points: number; me: boolean };
export type SnapshotMatch = { slug: string; question: string; lock_at: string; options: { label: string; points: number }[] | null };
export type LeagueSnapshot = {
  name: string;
  kind: string;
  emblem: string | null;
  color: string | null;
  prizes: number[] | null;
  starts_at: string;
  ends_at: string;
  members: number;
  pot: number;
  rows: SnapshotRow[];
  matches: SnapshotMatch[];
};

function kosovoWhen(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("sq-AL", { timeZone: "Europe/Belgrade", weekday: "short", day: "numeric", month: "short" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${day} · ${time}`;
}

/** Days left in a league, as a short phrase. */
export function leagueTimeLeft(endsAt: string) {
  const days = Math.ceil((Date.parse(endsAt) - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 1) return "mbaron sot";
  return `edhe ${days} ditë`;
}

/** The emblem as an image when it is one, else the emoji/text mark. */
function emblem(mark: string | null, color: string | null, size = 34) {
  const tint = color && /^#[0-9a-f]{6}$/i.test(color) ? color : GOLD;
  if (mark && (mark.startsWith("/") || mark.startsWith("http"))) {
    const src = mark.startsWith("/") ? `${SITE}${mark}` : mark;
    return `<img src="${esc(src)}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border-radius:10px;background:#fff;object-fit:contain">`;
  }
  return `<div style="width:${size}px;height:${size}px;line-height:${size}px;border-radius:10px;background:${tint}22;border:1px solid ${tint}66;text-align:center;font-size:${Math.round(size * 0.55)}px">${esc(mark || "🏆")}</div>`;
}

export function button(label: string, href: string, color = ORANGE) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0"><tr><td align="center" bgcolor="${color}" style="border-radius:999px">
<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a>
</td></tr></table>`;
}

/** Dardani beside the headline: the emotional beat of the email. */
export function hero({ image, kicker, title, lead, accent = ORANGE }: { image: string; kicker: string; title: string; lead: string; accent?: string }) {
  return `<tr><td style="padding:26px 26px 6px;background:${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;padding-right:12px">
<div style="display:inline-block;padding:5px 11px;border-radius:999px;background:${accent}1f;color:${accent};font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">${esc(kicker)}</div>
<h1 style="margin:12px 0 8px;font-size:30px;line-height:1.1;letter-spacing:-.03em;color:${INK}">${esc(title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:#5B4A3C">${lead}</p>
</td>
<td valign="bottom" width="132" style="width:132px"><img src="${SITE}/email/${image}.png" width="132" alt="Dardani" style="display:block;width:132px;height:auto;border:0"></td>
</tr></table>
</td></tr>`;
}

/** How far the reader is from the place above. */
export function gapMeter(gap: number, place: number) {
  if (!(gap > 0) || place <= 1) return "";
  // A short gap fills most of the bar: it should feel within reach.
  const fill = Math.max(12, Math.min(92, 100 - gap * 2));
  return `<tr><td style="padding:14px 26px 4px;background:${PAPER};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #EADFD2;border-radius:16px"><tr><td style="padding:14px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:13px;color:${MUTED};font-weight:700">Deri te vendi #${place - 1}</td>
<td align="right" style="font-size:20px;font-weight:900;color:${INK}">${fmt(gap)} <span style="font-size:12px;color:${MUTED}">pikë</span></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px"><tr>
<td width="${fill}%" height="10" bgcolor="${ORANGE}" style="height:10px;border-radius:999px 0 0 999px;font-size:0;line-height:0">&nbsp;</td>
<td height="10" bgcolor="#F1E7DB" style="height:10px;border-radius:0 999px 999px 0;font-size:0;line-height:0">&nbsp;</td>
</tr></table>
<p style="margin:9px 0 0;font-size:12.5px;color:${MUTED}">Një surprizë e saktë jep deri në 99 pikë. Mjafton një.</p>
</td></tr></table>
</td></tr>`;
}

/** Gold, silver and bronze blocks, 2-1-3, with the reader picked out. */
export function podium(rows: SnapshotRow[], prizes: number[] = []) {
  const byPlace = new Map(rows.map((row) => [row.place, row]));
  const order: [number, string, number][] = [[2, SILVER, 74], [1, GOLD, 104], [3, BRONZE, 54]];
  if (!byPlace.get(1)) return "";
  const cells = order.map(([place, color, height]) => {
    const row = byPlace.get(place);
    const me = row?.me;
    const name = row ? (me ? "Ti" : row.name.split(/\s+/)[0]) : "—";
    return `<td valign="bottom" align="center" width="33%" style="padding:0 5px;font-family:Arial,Helvetica,sans-serif">
<div style="font-size:13px;font-weight:800;color:${me ? ORANGE : "#F5EFE6"};margin-bottom:2px">${esc(name)}</div>
<div style="font-size:12px;color:rgba(245,239,230,.62);margin-bottom:8px">${row ? `${fmt(row.points)} pikë` : "&nbsp;"}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="${height}" bgcolor="${color}" align="center" valign="top" style="height:${height}px;border-radius:12px 12px 4px 4px;${me ? `border:3px solid ${ORANGE};` : ""}padding-top:10px">
<div style="font-size:24px;font-weight:900;color:#2A1E12;line-height:1">${place}</div>
${prizes[place - 1] ? `<div style="font-size:11px;font-weight:800;color:#3A2A18;margin-top:4px">${fmt(prizes[place - 1])} 383C</div>` : ""}
</td></tr></table>
</td>`;
  }).join("");
  return `<tr><td style="padding:16px 26px 0;background:${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${INK}" style="background:${INK};border-radius:18px"><tr><td style="padding:18px 14px 16px">
<p style="margin:0 0 14px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:.18em;color:${GOLD};text-transform:uppercase">Podiumi tani</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
</td></tr></table>
</td></tr>`;
}

/** The reader's neighbourhood in the table: above, them, below. */
export function nearby(rows: SnapshotRow[]) {
  const me = rows.find((row) => row.me);
  if (!me || me.place <= 3) return "";
  const shown = rows.filter((row) => Math.abs(row.place - me.place) <= 1);
  const lines = shown.map((row) => `<tr>
<td width="44" style="padding:11px 0 11px 14px;font-weight:900;color:${row.me ? ORANGE : MUTED};font-size:15px">#${row.place}</td>
<td style="padding:11px 0;font-size:15px;font-weight:${row.me ? 800 : 600};color:${INK}">${row.me ? "Ti" : esc(row.name)}</td>
<td align="right" style="padding:11px 14px 11px 0;font-size:15px;font-weight:800;color:${INK}">${fmt(row.points)}</td>
</tr>`).join(`<tr><td colspan="3" style="border-top:1px solid #F0E6DA;font-size:0;line-height:0">&nbsp;</td></tr>`);
  return `<tr><td style="padding:14px 26px 0;background:${PAPER};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #EADFD2;border-radius:16px">${lines}</table>
</td></tr>`;
}

/** The next matches, each with what the favourite and the surprise would pay. */
export function matchList(matches: SnapshotMatch[]) {
  if (!matches.length) return "";
  const cards = matches.map((match) => {
    const options = (match.options ?? []).slice(0, 3);
    const top = options.length ? Math.max(...options.map((o) => o.points)) : 0;
    const chips = options.map((o) => `<td style="padding:0 6px 0 0"><div style="padding:7px 10px;border-radius:10px;background:${o.points === top ? "#FFF0E6" : "#F6F1EA"};border:1px solid ${o.points === top ? "#FFC9B3" : "#EADFD2"};white-space:nowrap">
<span style="font-size:12px;color:${INK};font-weight:700">${esc(o.label)}</span>
<span style="font-size:12px;font-weight:900;color:${o.points === top ? ORANGE : "#007A3C"}"> +${o.points}</span>
</div></td>`).join("");
    return `<tr><td style="padding:0 0 10px">
<a href="${SITE}/tregu/${esc(match.slug)}" style="text-decoration:none;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #EADFD2;border-radius:16px"><tr><td style="padding:13px 14px">
<div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:${MUTED};text-transform:uppercase">${esc(kosovoWhen(match.lock_at))}</div>
<div style="margin:4px 0 10px;font-size:15px;font-weight:800;line-height:1.3;color:${INK}">${esc(match.question)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${chips}</tr></table>
</td></tr></table></a>
</td></tr>`;
  }).join("");
  return `<tr><td style="padding:20px 26px 0;background:${PAPER};font-family:Arial,Helvetica,sans-serif">
<p style="margin:0 0 10px;font-size:13px;font-weight:800;color:${INK}">Ndeshjet e radhës <span style="color:${MUTED};font-weight:600">· surpriza (portokalli) jep më shumë</span></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cards}</table>
</td></tr>`;
}

/** A league's name strip: emblem, name, members, time left, pot. */
export function leagueStrip(snapshot: LeagueSnapshot, prizeTotal: number) {
  return `<tr><td style="padding:16px 26px 0;background:${PAPER};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #EADFD2;border-radius:16px"><tr>
<td width="46" style="padding:12px 0 12px 14px">${emblem(snapshot.emblem, snapshot.color)}</td>
<td style="padding:12px 10px">
<div style="font-size:15px;font-weight:800;color:${INK}">${esc(snapshot.name)}</div>
<div style="font-size:12px;color:${MUTED};margin-top:2px">${fmt(snapshot.members)} lojtarë · ${leagueTimeLeft(snapshot.ends_at)}</div>
</td>
${prizeTotal > 0 ? `<td align="right" style="padding:12px 14px 12px 0;white-space:nowrap"><div style="font-size:11px;color:${MUTED};font-weight:700">NË LOJË</div><div style="font-size:16px;font-weight:900;color:${INK}">${fmt(prizeTotal)} 383C</div></td>` : ""}
</tr></table>
</td></tr>`;
}

/** The frame: preheader, dark 383 header, paper body, footer with the why. */
export function shell({ preheader, section, body, footer }: { preheader: string; section: string; body: string; footer: string }) {
  return `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>383</title></head>
<body style="margin:0;padding:0;background:${PAGE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE}">${esc(preheader)}&#847; &#847; &#847; &#847; &#847; &#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-radius:22px;overflow:hidden;background:${PAPER}">
<tr><td bgcolor="${INK}" style="background:${INK};padding:18px 26px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:26px;font-weight:900;letter-spacing:-.04em;color:#ffffff">383<span style="color:${ORANGE}">.</span></td>
<td align="right"><span style="display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.22);color:#F5EFE6;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">${esc(section)}</span></td>
</tr></table>
</td></tr>
<tr><td bgcolor="${ORANGE}" style="height:4px;font-size:0;line-height:0;background:${ORANGE}">&nbsp;</td></tr>
${body}
<tr><td style="padding:26px 26px 28px;background:${PAPER};font-family:Arial,Helvetica,sans-serif;text-align:center">
<p style="margin:0 0 10px;font-size:13px;font-weight:700"><a href="${SITE}" style="color:${INK};text-decoration:none">Lajme</a> &nbsp;·&nbsp; <a href="${SITE}/tregu" style="color:${INK};text-decoration:none">Tregu</a> &nbsp;·&nbsp; <a href="${SITE}/tregu#ligat" style="color:${INK};text-decoration:none">Ligat</a></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#9A8877">${footer}</p>
<p style="margin:10px 0 0;font-size:11px;color:#B3A393">383 · Prishtinë, Kosovë</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
