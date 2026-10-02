import { mailConfigured, sendMail } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmptyPush, type VapidKeys } from "@/lib/web-push";
import type { LeagueSnapshot } from "@/lib/tregu-email-kit";
import { buildDigestEmail, buildOvertakeEmail, buildRewardEmail, type DigestLeague } from "@/lib/tregu-league-emails";

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
      return { title: `${actor} të kaloi`, body: `Ra në #${event.data?.to} te ${league}. ${gap ? `${gap} pikë të kthejnë vendin.` : "Kthehu sot."}` };
    case "climbed":
      return { title: `U ngjite në #${event.data?.to}`, body: `Te ${league}. Mbaje vendin.` };
    case "duel_challenge":
      return { title: `${actor} të sfidoi`, body: stake ? `Duel 24 orë · ${stake} 383C secili. Prano ose refuzo.` : "Duel 24 orë. Prano ose refuzo." };
    case "duel_accepted":
      return { title: `${actor} pranoi duelin`, body: "24 orë nisin tani. Fiton kush mbledh më shumë pikë." };
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

/** The site's VAPID key pair; also used by Për ty's morning push. */
export async function vapidKeys(admin: Admin): Promise<VapidKeys | null> {
  const { data, error } = await admin.from("tregu_app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private_jwk"]);
  if (error) throw new Error(`vapid keys: ${error.message}`);
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
  const { data: events, error: claimError } = await admin
    .from("tregu_league_events")
    .update({ pushed_at: claimedAt })
    .is("pushed_at", null)
    .in("kind", worthy)
    .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .select("user_id");
  if (claimError) throw new Error(`push claim: ${claimError.message}`);
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

/** One league as the emails draw it: podium, the reader's neighbours, next matches. */
async function leagueSnapshot(admin: Admin, leagueId: string | null | undefined, userId: string): Promise<LeagueSnapshot | null> {
  if (!leagueId) return null;
  const { data, error } = await admin.rpc("tregu_email_league_snapshot", { p_league_id: leagueId, p_user: userId });
  if (error) {
    // The email still goes out without the podium rather than not at all.
    console.error(`league snapshot ${leagueId}: ${error.message}`);
    return null;
  }
  return (data ?? null) as LeagueSnapshot | null;
}

/** The morning recap, from 08:00 Kosovo time, once per user per day. */
async function sendDigests(admin: Admin) {
  if (kosovoHour() < 8) return { digests: 0, skipped: "before-8" };
  if (Date.now() < playerMailPausedUntil) return { digests: 0, skipped: "sender-domain-unverified" };
  if (!mailConfigured()) return { digests: 0, skipped: "no-mail" };

  const { data: recipients, error } = await admin.rpc("tregu_digest_recipients", { p_limit: 25 });
  if (error) throw new Error(`digest recipients: ${error.message}`);
  if (!recipients?.length) return { digests: 0 };

  const today = kosovoDate();
  let sent = 0;
  const failures: string[] = [];
  for (const recipient of recipients as { user_id: string; email: string; display_name: string; unsubscribe_token: string }[]) {
    const [{ data: leagues }, { data: events }, { data: duels }] = await Promise.all([
      admin.from("tregu_league_members").select("league_id, tregu_leagues!inner(id, name, ends_at, settled_at)").eq("user_id", recipient.user_id),
      admin.from("tregu_league_events").select("kind, actor, data, created_at").eq("user_id", recipient.user_id).gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()).order("created_at", { ascending: false }).limit(8),
      admin.from("tregu_duels").select("id, status").or(`challenger.eq.${recipient.user_id},opponent.eq.${recipient.user_id}`).in("status", ["pending", "active"]),
    ]);
    const active = (leagues ?? [])
      .map((row) => (row as unknown as { tregu_leagues: { id: string; name: string; ends_at: string; settled_at: string | null } }).tregu_leagues)
      .filter((league) => !league.settled_at && Date.parse(league.ends_at) > Date.now());
    const digestLeagues: DigestLeague[] = [];
    for (const league of active.slice(0, 4)) {
      const snapshot = await leagueSnapshot(admin, league.id, recipient.user_id);
      if (!snapshot) continue;
      const { data: rank } = await admin.from("tregu_league_ranks").select("rank, day_rank").eq("league_id", league.id).eq("user_id", recipient.user_id).maybeSingle();
      const change = rank && rank.day_rank != null ? Number(rank.day_rank) - Number(rank.rank) : 0;
      digestLeagues.push({ snapshot, change: Number.isFinite(change) ? change : 0 });
    }
    if (!digestLeagues.length) {
      // No active league: nothing to recap today. Active leagues but no
      // snapshot means the lookup failed; leave the day open so it retries.
      if (active.length) failures.push(`no league snapshot for ${recipient.user_id}`);
      else await admin.from("tregu_notification_prefs").update({ last_digest_on: today }).eq("user_id", recipient.user_id);
      continue;
    }
    const openDuels = (duels ?? []).length;
    const unsubscribe = `${SITE}/api/tregu/unsubscribe?token=${recipient.unsubscribe_token}`;
    const first = recipient.display_name.split(/\s+/)[0];
    const email = buildDigestEmail({
      first,
      leagues: digestLeagues,
      events: (events ?? []).map((event) => ({ ...describeEvent(event as EventRow), kind: String(event.kind) })),
      openDuels,
      unsubscribe,
    });
    try {
      await sendMail({
        fromName: "383 Ligat",
        idempotencyKey: `digest-${recipient.user_id}-${today}`,
        to: recipient.email,
        subject: email.subject,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        text: email.text,
        html: email.html,
      });
      sent += 1;
    } catch (error) {
      // Leave last_digest_on unset so the next tick retries this user, and say
      // why: a silent catch here hid a dead mail route for two days.
      const message = String(error instanceof Error ? error.message : error);
      failures.push(message);
      if (SENDER_NOT_VERIFIED.test(message)) {
        playerMailPausedUntil = Date.now() + 30 * 60_000;
        break;
      }
      continue;
    }
    await admin.from("tregu_notification_prefs").update({ last_digest_on: today }).eq("user_id", recipient.user_id);
  }
  if (failures.length) console.error(`League digest: ${failures.length} failed, first: ${failures[0]}`);
  return { digests: sent, failed: failures.length, ...(failures.length ? { error: failures[0] } : {}) };
}

type PlayerMail = {
  kind: "overtaken" | "reward";
  user_id: string;
  email: string;
  display_name: string;
  unsubscribe_token: string | null;
  event_ids: string[] | null;
  reward_ids: string[] | null;
  payload: Array<Record<string, unknown>>;
};

/**
 * Resend refuses mail to players until 383ks.com is verified there (the shared
 * test sender only reaches the account owner). After that refusal, player
 * mail pauses for half an hour instead of retrying every two minutes.
 */
let playerMailPausedUntil = 0;
const SENDER_NOT_VERIFIED = /verify a domain|own email address|testing emails|domain is not verified/i;

/**
 * The two emails a player acts on: someone passed them (at most one email per
 * six hours, never after an unsubscribe), and a prize is ready to open.
 * Claimed in the database first, released again if the send fails.
 */
async function sendPlayerEmails(admin: Admin) {
  if (!mailConfigured()) return { sent: 0, skipped: "no-mail" };
  if (Date.now() < playerMailPausedUntil) return { sent: 0, skipped: "sender-domain-unverified" };
  const { data, error } = await admin.rpc("tregu_claim_player_emails", { p_limit: 20 });
  if (error) throw new Error(`tregu_claim_player_emails: ${error.message}`);
  let sent = 0;
  const failures: string[] = [];
  for (const mail of (data ?? []) as PlayerMail[]) {
    const first = mail.display_name.split(/\s+/)[0];
    try {
      if (mail.kind === "overtaken") {
        const items = mail.payload as { actor?: string; data?: Record<string, unknown>; league_id?: string }[];
        const overtakes = items.map((item) => ({
          actor: String(item.actor ?? "Dikush"),
          league: String(item.data?.league ?? "liga"),
          to: Number(item.data?.to ?? 0),
          gap: Number(item.data?.gap ?? 0),
        }));
        const snapshot = await leagueSnapshot(admin, items[0]?.league_id, mail.user_id);
        const unsubscribe = mail.unsubscribe_token ? `${SITE}/api/tregu/unsubscribe?token=${mail.unsubscribe_token}` : `${SITE}/tregu`;
        const email = buildOvertakeEmail({ first, overtakes, snapshot, unsubscribe });
        await sendMail({
          fromName: "383 Ligat",
          idempotencyKey: `overtaken-${(mail.event_ids ?? []).join("-").slice(0, 200)}`,
          to: mail.email,
          subject: email.subject,
          headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          text: email.text,
          html: email.html,
        });
      } else {
        const email = buildRewardEmail({ first, rewards: mail.payload as { kind?: string; place?: number; prize?: number; league?: string | null }[] });
        await sendMail({
          fromName: "383 Tregu",
          idempotencyKey: `reward-${(mail.reward_ids ?? []).join("-").slice(0, 200)}`,
          to: mail.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
      }
      sent += 1;
    } catch (sendError) {
      const message = String(sendError instanceof Error ? sendError.message : sendError);
      failures.push(message);
      await admin.rpc("tregu_release_player_emails", { p_event_ids: mail.event_ids ?? [], p_reward_ids: mail.reward_ids ?? [] });
      if (SENDER_NOT_VERIFIED.test(message)) {
        playerMailPausedUntil = Date.now() + 30 * 60_000;
        // Hand back everything else claimed this round; it waits for the domain.
        const rest = ((data ?? []) as PlayerMail[]).slice(((data ?? []) as PlayerMail[]).indexOf(mail) + 1);
        await admin.rpc("tregu_release_player_emails", {
          p_event_ids: rest.flatMap((item) => item.event_ids ?? []),
          p_reward_ids: rest.flatMap((item) => item.reward_ids ?? []),
        });
        break;
      }
    }
  }
  if (failures.length) console.error(`Player emails: ${failures.length} failed, first: ${failures[0]}`);
  return { sent, failed: failures.length, ...(failures.length ? { error: failures[0] } : {}) };
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
  // supabase-js returns RPC failures instead of throwing; without this a
  // broken function reads as a quiet `null`, which is how 0087's failing
  // rank refresh went unnoticed.
  const rpc = async (fn: string) => {
    const { data, error } = await admin.rpc(fn);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };
  await step("duels", () => rpc("tregu_settle_duels"));
  if (now.getUTCMinutes() % 6 < 2) await step("ranks", () => rpc("tregu_refresh_league_ranks"));
  await step("push", () => pushEvents(admin));
  await step("digest", () => sendDigests(admin));
  await step("mail", () => sendPlayerEmails(admin));
  return result;
}
