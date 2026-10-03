// Ligat on the floor: the words and order of the league cards, from the rows
// tregu_leagues_hub() returns (migration 0095). Pure, so node --test covers it.
import { formatKosovoTime } from "./tregu-local-time.mjs";

const HOUR = 3_600_000;

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function untilShort(ms) {
  if (ms <= 0) return "tani";
  const hours = Math.floor(ms / HOUR);
  if (hours >= 48) return `${Math.floor(hours / 24)} ditë`;
  if (hours >= 1) return `${hours} orë`;
  return `${Math.max(1, Math.round(ms / 60_000))} min`;
}

/**
 * What a card says about today, and how loud:
 *  due      — picks open and not all made ("3 parashikime të hapura · mbyllen 20:45")
 *  done     — everything open is picked ("Gati për sot")
 *  idle     — nothing locks in the next 24 hours
 *  upcoming — the league hasn't started
 *  join     — the reader isn't in it
 *  ended    — over, waiting for results
 */
export function cardStatus(row, now = Date.now()) {
  const starts = Date.parse(row?.starts_at ?? "");
  const ends = Date.parse(row?.ends_at ?? "");
  if (row?.settled || (Number.isFinite(ends) && ends <= now)) return { tone: "ended", label: "Përfundoi · po llogariten pikët" };
  if (!row?.is_member) {
    // The clock chip already says how long is left; say who is playing.
    const active = Number(row?.active_today) || 0;
    const members = Number(row?.members) || 0;
    if (active > 0) return { tone: "join", label: `${active} ${active === 1 ? "parashikoi" : "parashikuan"} sot` };
    return { tone: "join", label: members > 0 ? `${members} ${members === 1 ? "lojtar" : "lojtarë"} brenda` : "Bëhu i pari brenda" };
  }
  if (Number.isFinite(starts) && starts > now) return { tone: "upcoming", label: `Nis për ${untilShort(starts - now)}` };
  const open = Number(row?.open_count) || 0;
  const picked = Number(row?.picked_count) || 0;
  const left = Math.max(0, open - picked);
  if (open === 0) return { tone: "idle", label: "Asnjë ndeshje në 24 orët e ardhshme" };
  if (left === 0) return { tone: "done", label: "Gati për sot" };
  const lock = row?.next_lock_at ? formatKosovoTime(row.next_lock_at) : null;
  return {
    tone: "due",
    label: `${plural(left, "parashikim i hapur", "parashikime të hapura")}${lock ? ` · ${left === 1 ? "mbyllet" : "e para mbyllet"} ${lock}` : ""}`,
  };
}

const TONE_ORDER = { due: 0, upcoming: 1, done: 2, idle: 3, join: 4, ended: 5 };

/** The reader's leagues: picks to make first (soonest lock first), then by place. */
export function sortMine(rows, now = Date.now()) {
  return [...(rows ?? [])].sort((a, b) => {
    const ta = TONE_ORDER[cardStatus(a, now).tone];
    const tb = TONE_ORDER[cardStatus(b, now).tone];
    if (ta !== tb) return ta - tb;
    const la = Date.parse(a?.next_lock_at ?? "") || Infinity;
    const lb = Date.parse(b?.next_lock_at ?? "") || Infinity;
    if (la !== lb) return la - lb;
    return (Number(a?.my_rank) || Infinity) - (Number(b?.my_rank) || Infinity);
  });
}

/** "Ti #6 ▲2 · 284 pikë · 32 pikë nga podiumi" as parts the card lays out. */
export function podiumLine(row) {
  const rank = Number(row?.my_rank) || null;
  if (!row?.is_member) return null;
  if (!rank) return { rank: null, change: 0, points: 0, note: row?.ranks_ready === false ? "Renditja po llogaritet" : "Bëj parashikimin e parë" };
  const change = Number(row?.my_rank_change) || 0;
  const points = Math.round(Number(row?.my_points) || 0);
  const gap = Math.round(Number(row?.gap_to_podium) || 0);
  let note;
  if (rank === 1) note = "Je i pari";
  else if (rank <= 3) note = "Je në podium";
  else note = `${gap} pikë nga podiumi`;
  return { rank, change, points, note };
}

/** What leaving costs, in the words of the confirm sheet. Mirrors tregu_league_leave(). */
export function leaveCopy(league, now = Date.now()) {
  const fee = Math.round(Number(league?.entry_fee) || 0);
  const members = Number(league?.members) || 0;
  const pot = Math.round(Number(league?.pot) || 0);
  const starts = Date.parse(league?.starts_at ?? "");
  const joined = Date.parse(league?.joined_at ?? "");
  const grace = Number.isFinite(joined) && now - joined < 15 * 60_000 && !league?.has_picks;
  if (members <= 1) {
    const others = Math.max(0, pot - fee);
    return {
      refund: fee,
      text: others > 0
        ? `Je i fundit në ligë: liga mbyllet dhe poti prej ${others} 383C nuk ndahet. Të kthehen ${fee} 383C.`
        : `Je i fundit në ligë: liga mbyllet${fee ? ` dhe të kthehen ${fee} 383C` : ""}.`,
    };
  }
  if (fee === 0) return { refund: 0, text: "Parashikimet e tua hiqen dhe del nga renditja." };
  if ((Number.isFinite(starts) && starts > now) || grace) {
    return { refund: fee, text: `Të kthehen ${fee} 383C. Parashikimet e tua hiqen.` };
  }
  return { refund: 0, text: `Tarifa prej ${fee} 383C mbetet në pot. Parashikimet e tua hiqen dhe del nga renditja.` };
}

/** The push for "picks_due": names the league and, if placed, the place. */
export function picksDueCopy(data) {
  const league = String(data?.league ?? "liga");
  const rank = Number(data?.rank) || null;
  const open = Math.max(1, Number(data?.open) || 1);
  const lock = data?.lock_at ? formatKosovoTime(data.lock_at) : null;
  return {
    title: rank ? `Je #${rank} te ${league}` : `Parashikimet e sotme te ${league}`,
    body: `${open} ndeshje pa parashikim${lock ? ` · ${open === 1 ? "mbyllet" : "e para mbyllet"} në ${lock}` : ""}. Bëji tani.`,
  };
}

/** The strip's short status (the full sentence is cardStatus): fits a phone row. */
export function stripStatus(row, now = Date.now()) {
  const full = cardStatus(row, now);
  if (full.tone === "due") {
    const left = Math.max(0, (Number(row?.open_count) || 0) - (Number(row?.picked_count) || 0));
    const lock = row?.next_lock_at ? formatKosovoTime(row.next_lock_at) : null;
    return { ...full, short: `${left} të hapura${lock ? ` · ${lock}` : ""}` };
  }
  if (full.tone === "done") return { ...full, short: "Gati për sot" };
  if (full.tone === "idle") return { ...full, short: "Pa ndeshje sot" };
  if (full.tone === "ended") return { ...full, short: "Përfundoi" };
  return { ...full, short: full.label };
}
