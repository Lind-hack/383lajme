// The three league emails, built from lib/tregu-email-kit.ts. Pure functions:
// data in, { subject, html, text } out, so they can be previewed and tested
// without sending anything.

import { leaguePrizes } from "@/lib/tregu-leagues";
import {
  button,
  esc,
  fmt,
  gapMeter,
  hero,
  leagueStrip,
  matchList,
  nearby,
  podium,
  shell,
  type LeagueSnapshot,
} from "@/lib/tregu-email-kit";

const SITE = "https://383ks.com";
type Built = { subject: string; html: string; text: string };

function prizesOf(snapshot: LeagueSnapshot | null) {
  if (!snapshot) return [];
  return leaguePrizes({
    kind: snapshot.kind as "public" | "private",
    prizes: snapshot.prizes ?? [],
    pot: Number(snapshot.pot) || 0,
    members: Number(snapshot.members) || 0,
    starts_at: snapshot.starts_at,
    ends_at: snapshot.ends_at,
  });
}

const why = (unsubscribe: string) =>
  `Ky email të vjen sepse je në një ligë në 383 Tregu. <a href="${esc(unsubscribe)}" style="color:#9A8877">Çregjistrohu</a> nga email-et e ligave.`;

export type Overtake = { actor: string; league: string; to: number; gap: number };

/** Someone passed you: who, where you are now, how close the place above is. */
export function buildOvertakeEmail({ first, overtakes, snapshot, unsubscribe }: {
  first: string;
  overtakes: Overtake[];
  snapshot: LeagueSnapshot | null;
  unsubscribe: string;
}): Built {
  const latest = overtakes[0];
  const prizes = prizesOf(snapshot);
  const me = snapshot?.rows.find((row) => row.me);
  const above = me ? snapshot?.rows.find((row) => row.place === me.place - 1) : null;
  const gap = above && me ? Math.max(0, above.points - me.points) : latest.gap;
  const place = me?.place ?? latest.to;
  const others = overtakes.slice(1, 4);
  const lead = `${esc(latest.actor)} të kaloi te <b>${esc(latest.league)}</b>. Tani je <b style="color:#FF4422">#${place}</b>${gap > 0 ? `, vetëm <b>${fmt(gap)} pikë</b> larg vendit #${place - 1}` : ""}.`;
  const body = [
    hero({ image: "dardani-overtaken", kicker: "U kalove", title: `${latest.actor} të kaloi`, lead }),
    snapshot ? leagueStrip(snapshot, prizes.reduce((sum, value) => sum + value, 0)) : "",
    gapMeter(gap, place),
    snapshot ? podium(snapshot.rows, prizes) : "",
    snapshot ? nearby(snapshot.rows) : "",
    others.length
      ? `<tr><td style="padding:14px 26px 0;background:#FCF8F1;font-family:Arial,Helvetica,sans-serif"><p style="margin:0;font-size:13px;color:#7A6A5C;line-height:1.6">Edhe: ${others.map((item) => `<b style="color:#17130E">${esc(item.actor)}</b> te ${esc(item.league)} (#${item.to})`).join(" · ")}</p></td></tr>`
      : "",
    snapshot ? matchList(snapshot.matches) : "",
    `<tr><td style="padding:4px 26px 0;background:#FCF8F1">${button("Rimerre vendin", `${SITE}/tregu#ligat`)}</td></tr>`,
  ].join("");
  return {
    subject: `${first}, ${latest.actor} të kaloi — tani je #${place}`,
    html: shell({ preheader: gap > 0 ? `${fmt(gap)} pikë të ndajnë nga vendi #${place - 1}. Ndeshjet e radhës janë shansi yt.` : "Ndeshjet e radhës janë shansi yt.", section: "Ligat", body, footer: why(unsubscribe) }),
    text: `${first}, ${latest.actor} të kaloi te ${latest.league}. Tani je #${place}${gap > 0 ? `, ${gap} pikë larg vendit #${place - 1}` : ""}.\n\nZgjidh ndeshjet e radhës: ${SITE}/tregu#ligat\n\nÇregjistrohu: ${unsubscribe}`,
  };
}

export type Reward = { kind?: string; place?: number; prize?: number; league?: string | null };
const MEDAL = ["", "🥇", "🥈", "🥉"];
const PLACE = ["", "i pari", "i dyti", "i treti"];

/** A prize is waiting: the medal, the amount, one button to open it. */
export function buildRewardEmail({ first, rewards }: { first: string; rewards: Reward[] }): Built {
  const total = rewards.reduce((sum, item) => sum + Number(item.prize ?? 0), 0);
  const best = [...rewards].sort((a, b) => Number(a.place ?? 9) - Number(b.place ?? 9))[0];
  const rows = rewards.map((item) => {
    const where = item.league ? item.league : item.kind === "monthly" ? "Renditja e muajit" : "Renditja e javës";
    return `<tr>
<td width="44" style="padding:12px 0 12px 14px;font-size:24px">${MEDAL[Number(item.place)] ?? "🏅"}</td>
<td style="padding:12px 0;font-size:15px;color:#17130E"><b>${esc(where)}</b><br><span style="font-size:12.5px;color:#7A6A5C">Dole ${PLACE[Number(item.place)] ?? `#${item.place}`}</span></td>
<td align="right" style="padding:12px 14px 12px 0;font-size:17px;font-weight:900;color:#17130E;white-space:nowrap">+${fmt(Number(item.prize ?? 0))}</td>
</tr>`;
  }).join(`<tr><td colspan="3" style="border-top:1px solid #F0E6DA;font-size:0;line-height:0">&nbsp;</td></tr>`);
  const body = [
    hero({
      image: "dardani-trophy",
      kicker: `${MEDAL[Number(best?.place)] ?? "🏅"} Fitove`,
      title: "Shpërblimi yt po të pret",
      lead: `${esc(first)}, ke <b style="color:#FF4422">${fmt(total)} 383C</b> gati për t'u hapur. Hape kutinë dhe monedhat shkojnë direkt në portofol.`,
      accent: "#C99A1A",
    }),
    `<tr><td style="padding:16px 26px 0;background:#FCF8F1;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#17130E" style="background:#17130E;border-radius:18px"><tr><td align="center" style="padding:22px 16px">
<div style="font-size:11px;font-weight:800;letter-spacing:.18em;color:#F2C14E;text-transform:uppercase">Totali</div>
<div style="font-size:52px;font-weight:900;letter-spacing:-.04em;color:#F2C14E;line-height:1.05">${fmt(total)}<span style="font-size:18px;color:#F5EFE6"> 383C</span></div>
</td></tr></table></td></tr>`,
    `<tr><td style="padding:14px 26px 0;background:#FCF8F1;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #EADFD2;border-radius:16px">${rows}</table></td></tr>`,
    `<tr><td style="padding:4px 26px 0;background:#FCF8F1">${button("Hape shpërblimin", `${SITE}/tregu`, "#C99A1A")}</td></tr>`,
  ].join("");
  return {
    subject: `${first}, ${fmt(total)} 383C po të presin ${MEDAL[Number(best?.place)] ?? ""}`.trim(),
    html: shell({ preheader: `Dole ${PLACE[Number(best?.place)] ?? "në podium"}. Hape kutinë në Tregu.`, section: "Shpërblim", body, footer: "Ky email të vjen sepse fitove një shpërblim në 383 Tregu." }),
    text: `${first}, ke ${fmt(total)} 383C që presin ta hapësh. Hyr në Tregu: ${SITE}/tregu`,
  };
}

export type DigestEvent = { title: string; body: string; kind: string };
export type DigestLeague = { snapshot: LeagueSnapshot; change: number };

/** The morning recap: every league at a glance, what happened, what's next. */
export function buildDigestEmail({ first, leagues, events, openDuels, unsubscribe }: {
  first: string;
  leagues: DigestLeague[];
  events: DigestEvent[];
  openDuels: number;
  unsubscribe: string;
}): Built {
  const cards = leagues.map(({ snapshot, change }) => {
    const me = snapshot.rows.find((row) => row.me);
    const leader = snapshot.rows.find((row) => row.place === 1);
    const trend = change > 0 ? `<span style="color:#007A3C">▲ ${change}</span>` : change < 0 ? `<span style="color:#B4181A">▼ ${Math.abs(change)}</span>` : `<span style="color:#9A8877">•</span>`;
    return `<tr><td style="padding:0 0 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #EADFD2;border-radius:16px"><tr>
<td style="padding:14px">
<div style="font-size:15px;font-weight:800;color:#17130E">${esc(snapshot.name)}</div>
<div style="font-size:12.5px;color:#7A6A5C;margin-top:3px">${leader ? `Në krye: ${leader.me ? "ti" : esc(leader.name.split(/\s+/)[0])} · ${fmt(leader.points)} pikë` : "Ende pa pikë"}</div>
</td>
<td align="right" style="padding:14px;white-space:nowrap">
<div style="font-size:26px;font-weight:900;color:${me && me.place <= 3 ? "#C99A1A" : "#17130E"};line-height:1">${me ? `#${me.place}` : "—"}</div>
<div style="font-size:12px;font-weight:800;margin-top:3px">${trend} <span style="color:#9A8877;font-weight:600">nga ${fmt(snapshot.members)}</span></div>
</td>
</tr></table></td></tr>`;
  }).join("");
  const happened = events.slice(0, 5).map((event) => `<tr><td style="padding:9px 0;border-top:1px solid #F0E6DA;font-size:14px;color:#17130E"><b>${esc(event.title)}</b> <span style="color:#7A6A5C">— ${esc(event.body)}</span></td></tr>`).join("");
  const nextMatches = leagues.flatMap((league) => league.snapshot.matches).sort((a, b) => Date.parse(a.lock_at) - Date.parse(b.lock_at));
  const unique = nextMatches.filter((match, index) => nextMatches.findIndex((other) => other.slug === match.slug) === index).slice(0, 3);
  const body = [
    hero({ image: "dardani-morning", kicker: "Mirëmëngjes", title: `${first}, ja ligat e tua`, lead: leagues.length === 1 ? "Një ligë, një renditje, disa ndeshje që mund ta ndryshojnë sot." : `${leagues.length} liga sot. Ja ku je në secilën.` }),
    `<tr><td style="padding:16px 26px 0;background:#FCF8F1;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cards}</table></td></tr>`,
    happened ? `<tr><td style="padding:10px 26px 0;background:#FCF8F1;font-family:Arial,Helvetica,sans-serif"><p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#17130E">Në 24 orët e fundit</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${happened}</table></td></tr>` : "",
    openDuels ? `<tr><td style="padding:14px 26px 0;background:#FCF8F1;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF0E6;border:1px solid #FFC9B3;border-radius:14px"><tr><td style="padding:12px 14px;font-size:14px;color:#17130E">⚔️ <b>${openDuels} duel${openDuels === 1 ? "" : "e"}</b> të hapur të presin.</td></tr></table></td></tr>` : "",
    matchList(unique),
    `<tr><td style="padding:4px 26px 0;background:#FCF8F1">${button("Hap ligat", `${SITE}/tregu#ligat`)}</td></tr>`,
  ].join("");
  const best = leagues.map((league) => league.snapshot.rows.find((row) => row.me)?.place ?? 99).sort((a, b) => a - b)[0];
  return {
    subject: events.some((event) => event.kind === "overtaken")
      ? `${first}, dikush të kaloi natën — ja renditja`
      : best <= 3 ? `${first}, je në podium sot 🏆` : `${first}, renditja jote sot`,
    html: shell({ preheader: unique.length ? `${unique.length} ndeshje sot mund ta ndryshojnë renditjen.` : "Renditja jote këtë mëngjes.", section: "Ligat", body, footer: why(unsubscribe) }),
    text: `Mirëmëngjes ${first}.\n\n${leagues.map(({ snapshot }) => `${snapshot.name}: #${snapshot.rows.find((row) => row.me)?.place ?? "—"} nga ${snapshot.members}`).join("\n")}\n\n${events.map((event) => `${event.title} — ${event.body}`).join("\n")}\n\nHap ligat: ${SITE}/tregu#ligat\n\nÇregjistrohu: ${unsubscribe}`,
  };
}
