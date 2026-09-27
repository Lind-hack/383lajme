/** Prize pools, in 383 Monedha, for places 1–3. The board renders these and
 *  the period lock (migration 0083) pays exactly these — one copy, so the
 *  card can never advertise a prize the payout does not match. */
export const LEADERBOARD_PRIZES = {
  monthly: [500, 300, 150],
  weekly: [125, 75, 40],
} as const;

export type LeaderboardKind = keyof typeof LEADERBOARD_PRIZES;
/** What a prize was won in: a leaderboard period, or a league. */
export type RewardKind = LeaderboardKind | "league";

export const LEADERBOARD_KIND_LABEL: Record<RewardKind, string> = {
  weekly: "Java",
  monthly: "Muaji",
  league: "Liga",
};

/** A frozen top-3 row, as tregu_leaderboard_rewards stores it. */
export type LeaderboardReward = {
  id: string;
  period_kind: RewardKind;
  period_start: string;
  period_end: string;
  place: number;
  user_id?: string;
  display_name: string;
  profit: number;
  prize: number;
  status: "pending" | "approved" | "claimed" | "rejected";
  notified_at?: string | null;
  approved_at?: string | null;
  claimed_at?: string | null;
  created_at?: string;
  league_id?: string | null;
  league_name?: string | null;
};

const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/** Calendar parts of an instant on Kosovo time. */
function kosovoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { day: get("day"), month: get("month") - 1, year: get("year") };
}

/** "21–27 shtator" / "shtator 2026", on Kosovo time. Month names are spelled
 *  here rather than taken from Intl: browsers without Albanian locale data
 *  fall back to English ("September"). The end bound is exclusive (next
 *  Monday / the 1st, 00:00), so the last day shown is the one before it. */
export function leaderboardPeriodLabel(kind: RewardKind, start: string, end: string): string {
  const from = kosovoParts(new Date(start));
  const to = kosovoParts(new Date(new Date(end).getTime() - 1));
  if (kind === "monthly") return `${MONTHS[from.month]} ${from.year}`;
  return from.month === to.month
    ? `${from.day}–${to.day} ${MONTHS[to.month]}`
    : `${from.day} ${MONTHS[from.month]} – ${to.day} ${MONTHS[to.month]}`;
}
