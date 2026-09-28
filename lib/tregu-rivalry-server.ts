import * as nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmptyPush, type VapidKeys } from "@/lib/web-push";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type EventRow = { id: string; user_id: string; league_id: string | null; kind: string; actor: string | null; data: Record<string, unknown>; created_at: string };

const SITE = "https://383ks.com";

/** One line of Albanian for an event, shared by push, the banner and email. */
export function describeEvent(event: Pick<EventRow, "kind" | "actor" | "data">): { title: string; body: string } {
  const actor = event.actor ?? "Dikush";
  const league = String(event.data?.league ?? "liga");
  const gap = Number(event.data?.gap ?? 0);
  const stake = Number(event.data?.stake ?? 0);
  switch (event.kind) {
    case "overtaken":
      return { title: `${actor} të kaloi`, body: `Ra në #${event.data?.to} te ${league}. ${gap ? `${gap} 383C të kthejnë vendin.` : "Kthehu sot."}` };
    case "climbed":
      return { title: `U ngjite në #${event.data?.to}`, body: `Te ${league}. Mbaje vendin.` };
    case "duel_challenge":
      return { title: `${actor} të sfidoi`, body: stake ? `Duel 24 orë · ${stake} 383C secili. Prano ose refuzo.` : "Duel 24 orë. Prano ose refuzo." };
    case "duel_accepted":
      return { title: `${actor} pranoi duelin`, body: "24 orë nisin tani. Fiton kush mbyll më shumë fitim." };
    case "duel_declined":
      return { title: `${actor} e refuzoi duelin`, body: "Basti t'u kthye." };
    case "duel_won":
      return { title: `Fitove duelin me ${actor}`, body: stake ? `+${stake * 2} 383C në portofol.` : "Fitore e pastër." };
    case "duel_lost":
      return { title: `${actor} fitoi duelin`, body: "Sfidoje përsëri." };
    case "duel_draw":
      return { title: `Barazim me ${actor}`, body: "Bastet u kthyen." };
    case "duel_expired":
      return { title: `${actor} nuk u përgjigj`, body: "Sfida skadoi, basti t'u kthye." };
    default:
      return { title: "Ligat", body: "Diçka ndryshoi në ligat e tua." };
  }
}

async function vapidKeys(admin: Admin): Promise<VapidKeys | null> {
  const { data } = await admin.from("tregu_app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private_jwk"]);
  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  const publicKey = map.get("vapid_public");
  const privateJwk = map.get("vapid_private_jwk");
  if (!publicKey || !privateJwk) return null;
  return { publicKey, privateJwk: JSON.parse(privateJwk) };
}

/** Wake each device of every user with new push-worthy events. */
async function pushEvents(admin: Admin) {
  const keys = await vapidKeys(admin);
  if (!keys) return { pushed: 0, skipped: "no-vapid-keys" };
  const worthy = ["overtaken", "duel_challenge", "duel_accepted", "duel_won", "duel_lost"];
  const claimedAt = new Date().toISOString();
  // Claim first, so overlapping heartbeats never push the same event twice.
  const { data: events } = await admin
    .from("tregu_league_events")
    .update({ pushed_at: claimedAt })
    .is("pushed_at", null)
    .in("kind", worthy)
    .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .select("user_id");
  const users = [...new Set((events ?? []).map((row) => row.user_id as string))];
  if (!users.length) return { pushed: 0 };
  const { data: subs } = await admin.from("tregu_push_subscriptions").select("endpoint, user_id").in("user_id", users);
  let pushed = 0;
  for (const sub of subs ?? []) {
    try {
      const result = await sendEmptyPush(sub.endpoint, keys);
      if (result === "gone") await admin.from("tregu_push_subscriptions").delete().eq("endpoint", sub.endpoint);
      else pushed += 1;
    } catch {
      // A single device failing must not stop the others.
    }
  }
  return { pushed };
}

function kosovoHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(now));
}

function kosovoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The morning recap, from 08:00 Kosovo time, once per user per day. */
async function sendDigests(admin: Admin) {
  if (kosovoHour() < 8) return { digests: 0, skipped: "before-8" };
  const user = (process.env.GMAIL_USER ?? "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !pass) return { digests: 0, skipped: "no-gmail" };

  const { data: recipients, error } = await admin.rpc("tregu_digest_recipients", { p_limit: 25 });
  if (error) throw new Error(`digest recipients: ${error.message}`);
  if (!recipients?.length) return { digests: 0 };

  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  const today = kosovoDate();
  let sent = 0;
  for (const recipient of recipients as { user_id: string; email: string; display_name: string; unsubscribe_token: string }[]) {
    const [{ data: leagues }, { data: events }, { data: duels }] = await Promise.all([
      admin.from("tregu_league_members").select("league_id, tregu_leagues!inner(id, name, ends_at, settled_at)").eq("user_id", recipient.user_id),
      admin.from("tregu_league_events").select("kind, actor, data, created_at").eq("user_id", recipient.user_id).gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()).order("created_at", { ascending: false }).limit(8),
      admin.from("tregu_duels").select("id, status").or(`challenger.eq.${recipient.user_id},opponent.eq.${recipient.user_id}`).in("status", ["pending", "active"]),
    ]);
    const active = (leagues ?? [])
      .map((row) => (row as unknown as { tregu_leagues: { id: string; name: string; ends_at: string; settled_at: string | null } }).tregu_leagues)
      .filter((league) => !league.settled_at && Date.parse(league.ends_at) > Date.now());
    const lines: string[] = [];
    for (const league of active) {
      const { data: rank } = await admin.from("tregu_league_ranks").select("rank, profit").eq("league_id", league.id).eq("user_id", recipient.user_id).maybeSingle();
      const { count } = await admin.from("tregu_league_members").select("user_id", { count: "exact", head: true }).eq("league_id", league.id);
      lines.push(`<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><b>${escapeHtml(league.name)}</b></td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:800">${rank ? `#${rank.rank} nga ${count ?? "?"}` : "—"}</td></tr>`);
    }
    const eventLines = (events ?? []).map((event) => {
      const text = describeEvent(event as EventRow);
      return `<li style="margin:0 0 8px"><b>${escapeHtml(text.title)}</b> — ${escapeHtml(text.body)}</li>`;
    });
    const openDuels = (duels ?? []).length;
    const unsubscribe = `${SITE}/api/tregu/unsubscribe?token=${recipient.unsubscribe_token}`;
    const first = recipient.display_name.split(/\s+/)[0];
    const subject = (events ?? []).find((event) => event.kind === "overtaken")
      ? `${first}, ${describeEvent((events ?? []).find((event) => event.kind === "overtaken") as EventRow).title.toLowerCase()} — 383 Ligat`
      : `${first}, renditja jote sot — 383 Ligat`;
    try {
      await transport.sendMail({
        from: `383 Tregu <${user}>`,
        to: recipient.email,
        subject,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        text: `Mirëmëngjes ${first}.\n\n${active.map((league) => league.name).join(", ")}\n\n${(events ?? []).map((event) => { const t = describeEvent(event as EventRow); return `${t.title} — ${t.body}`; }).join("\n")}\n\nHyr në Tregu: ${SITE}/tregu\n\nÇregjistrohu: ${unsubscribe}`,
        html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#171513">
<h1 style="font-size:22px;margin:0 0 6px">Mirëmëngjes ${escapeHtml(first)}</h1>
<p style="margin:0 0 18px;color:#555">Ja ku je në ligat e tua këtë mëngjes.</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${lines.join("")}</table>
${eventLines.length ? `<h2 style="font-size:16px;margin:22px 0 8px">Në 24 orët e fundit</h2><ul style="padding-left:18px;margin:0;font-size:14px;line-height:1.5">${eventLines.join("")}</ul>` : ""}
${openDuels ? `<p style="margin:18px 0 0;font-size:14px"><b>${openDuels} duel${openDuels === 1 ? "" : "e"}</b> të hapur presin.</p>` : ""}
<a href="${SITE}/tregu" style="display:inline-block;margin-top:22px;background:#111;color:#fff;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:999px">Tregto dhe kaloji</a>
<p style="margin-top:28px;font-size:12px;color:#888">Merr këtë email sepse je në një ligë në 383 Tregu. <a href="${unsubscribe}" style="color:#888">Çregjistrohu</a>.</p>
</main>`,
      });
      sent += 1;
    } catch {
      // Leave last_digest_on unset so the next tick retries this user.
      continue;
    }
    await admin.from("tregu_notification_prefs").update({ last_digest_on: today }).eq("user_id", recipient.user_id);
  }
  return { digests: sent };
}

/**
 * Rivalry jobs for the two-minute heartbeat: settle duels every tick, refresh
 * league ranks (and so overtake events) every few minutes, push new events,
 * and send the morning digest. Each step is independent: one failing never
 * stops the rest.
 */
export async function runRivalryJobs(now = new Date()) {
  const admin = createAdminClient();
  if (!admin) return { skipped: "supabase-not-configured" };
  const result: Record<string, unknown> = {};
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      result[name] = await run();
    } catch (error) {
      result[name] = { error: String(error instanceof Error ? error.message : error) };
    }
  };
  await step("duels", async () => (await admin.rpc("tregu_settle_duels")).data);
  if (now.getUTCMinutes() % 6 < 2) await step("ranks", async () => (await admin.rpc("tregu_refresh_league_ranks")).data);
  await step("push", () => pushEvents(admin));
  await step("digest", () => sendDigests(admin));
  return result;
}
