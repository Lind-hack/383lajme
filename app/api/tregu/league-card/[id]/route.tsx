import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { manropeFonts } from "@/lib/og-fonts";
import { isImageEmblem, leagueColor, leaguePrizes, scopeOf, type LeagueSummary } from "@/lib/tregu-leagues";

export const dynamic = "force-dynamic";

/* A league's table as a 1080×1350 image for stories and group chats: the
   emblem and name, the podium with its prizes, the rest of the top eight, and
   (for private leagues) the code to get in. Dark, like the trade card and the
   stadium card it comes from.

   Anyone holding a league's id may render it: ids are unguessable, the image
   only shows first names, ranks and profit, and sharing it is its purpose. */

const W = 1080;
const H = 1350;
const MEDALS = ["#E3B341", "#B4BAC4", "#C58A4B"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  const admin = createAdminClient();
  if (!admin) return new Response("unavailable", { status: 503 });

  const [{ data: league }, { data: scores }, { data: members }] = await Promise.all([
    admin.from("tregu_leagues").select("id, name, kind, code, starts_at, ends_at, entry_fee, prizes, emblem, color, scope_kind, scope_value, settled_at").eq("id", id).single(),
    admin.rpc("tregu_league_scores", { p_league_id: id }),
    admin.from("tregu_league_members").select("user_id, fee_paid, profiles(display_name)").eq("league_id", id),
  ]);
  if (!league) return new Response("not found", { status: 404 });

  type Score = { uid: string; net: number; reached_at: string | null; joined_at: string };
  const names = new Map<string, string>();
  for (const member of (members ?? []) as unknown as { user_id: string; profiles: { display_name: string | null } | null }[]) {
    names.set(member.user_id, String(member.profiles?.display_name ?? "Tregtar").trim().split(/\s+/)[0] || "Tregtar");
  }
  const pot = ((members ?? []) as { fee_paid: number }[]).reduce((sum, member) => sum + Number(member.fee_paid || 0), 0);
  const rows = ((scores ?? []) as Score[])
    .sort((a, b) =>
      Number(b.net) - Number(a.net) ||
      (a.reached_at ? Date.parse(a.reached_at) : Infinity) - (b.reached_at ? Date.parse(b.reached_at) : Infinity) ||
      Date.parse(a.joined_at) - Date.parse(b.joined_at)
    )
    .map((row, index) => ({ rank: index + 1, name: names.get(row.uid) ?? "Tregtar", profit: Math.round(Number(row.net)) }));

  const summary = { ...league, pot, members: rows.length } as unknown as LeagueSummary;
  const prizes = leaguePrizes(summary);
  const accent = leagueColor(summary);
  const emblem = league.emblem || (league.kind === "public" ? scopeOf(summary).emblem : "🏆");
  const origin = new URL(request.url).origin;
  const emblemSrc = isImageEmblem(emblem) ? (emblem.startsWith("http") ? emblem : `${origin}${emblem}`) : null;
  const ended = Boolean(league.settled_at) || Date.parse(league.ends_at) <= Date.now();
  const daysLeft = Math.max(0, Math.ceil((Date.parse(league.ends_at) - Date.now()) / 86_400_000));

  const fonts = await manropeFonts();
  const text = "#F4EFE6";
  const muted = "rgba(244,239,230,0.58)";
  const line = "rgba(244,239,230,0.12)";
  const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("sq-AL")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#100D0A", color: text, fontFamily: fonts.length ? "Manrope" : undefined, position: "relative", borderTop: `10px solid ${accent}` }}>
        <div style={{ position: "absolute", top: -300, left: -200, width: 1000, height: 900, borderRadius: 1000, background: `radial-gradient(circle, ${accent}40 0%, ${accent}00 62%)`, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "64px 64px 56px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 800, letterSpacing: "-0.05em" }}>383<span style={{ color: "#FF4422" }}>.</span></div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: "0.18em", color: muted }}>LIGAT</div>
            </div>
            <div style={{ display: "flex", padding: "10px 20px", borderRadius: 100, border: `2px solid ${line}`, fontSize: 22, fontWeight: 700 }}>
              {ended ? "Renditja përfundimtare" : daysLeft <= 1 ? "Dita e fundit" : `${daysLeft} ditë mbetur`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 56 }}>
            <div style={{ display: "flex", width: 120, height: 120, borderRadius: 32, background: "#fff", alignItems: "center", justifyContent: "center", fontSize: 64, boxShadow: `0 0 0 6px ${accent}55` }}>
              {emblemSrc ? <img src={emblemSrc} width={84} height={84} style={{ objectFit: "contain" }} /> : emblem}
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontSize: league.name.length > 24 ? 54 : 66, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>{league.name}</div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 26, fontWeight: 700, color: muted }}>
                {rows.length} tregtarë · {prizes.length ? `${prizes.reduce((a, b) => a + b, 0).toLocaleString("sq-AL")} 383C në lojë` : "për lavdi"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 52, flex: 1 }}>
            {rows.slice(0, 8).map((row) => {
              const medal = MEDALS[row.rank - 1];
              const prize = prizes[row.rank - 1] && (league.kind === "private" || row.profit > 0) ? prizes[row.rank - 1] : 0;
              return (
                <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 22, padding: medal ? "20px 26px" : "14px 26px", borderRadius: 22, background: medal ? `${medal}22` : "rgba(255,255,255,0.04)", border: `2px solid ${medal ? `${medal}66` : line}` }}>
                  <div style={{ display: "flex", width: 54, height: 54, borderRadius: 54, alignItems: "center", justifyContent: "center", background: medal ?? "transparent", color: medal ? "#1A1206" : muted, fontSize: 28, fontWeight: 800 }}>{row.rank}</div>
                  <div style={{ display: "flex", flex: 1, fontSize: medal ? 38 : 32, fontWeight: 800 }}>{row.name}</div>
                  <div style={{ display: "flex", fontSize: medal ? 36 : 30, fontWeight: 800, color: row.profit > 0 ? "#3ED484" : row.profit < 0 ? "#FF6B7A" : muted }}>{signed(row.profit)}</div>
                  {prize ? <div style={{ display: "flex", padding: "8px 16px", borderRadius: 100, background: "#F2C14E", color: "#1A1206", fontSize: 24, fontWeight: 800 }}>{prize.toLocaleString("sq-AL")}</div> : null}
                </div>
              );
            })}
            {rows.length === 0 ? <div style={{ display: "flex", fontSize: 32, color: muted }}>Ende pa anëtarë.</div> : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 36, paddingTop: 28, borderTop: `2px solid ${line}`, fontSize: 26, fontWeight: 700, color: muted }}>
            {league.kind === "private" && league.code && !ended ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                Hyr me kodin
                <span style={{ color: "#F2C14E", fontWeight: 800, letterSpacing: "0.2em" }}>{league.code}</span>
              </div>
            ) : (
              <div style={{ display: "flex" }}>{scopeOf(summary).label}</div>
            )}
            <div style={{ display: "flex", color: text }}>383ks.com/tregu/ligat</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "public, max-age=120" } }
  );
}
