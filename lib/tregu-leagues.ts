/** Leagues (migration 0084): public ones 383 runs and pays, private ones
 *  friends run on their own entry-fee pot. */

export type LeagueKind = "public" | "private";

export type LeagueSummary = {
  id: string;
  name: string;
  kind: LeagueKind;
  /** Only present for members of a private league. */
  code: string | null;
  starts_at: string;
  ends_at: string;
  entry_fee: number;
  prizes: number[] | null;
  pot: number;
  members: number;
  max_members: number;
  is_member: boolean;
  is_creator?: boolean;
  my_rank?: number | null;
  my_profit?: number | null;
  settled: boolean;
};

export type LeagueStanding = {
  rank: number;
  display_name: string;
  profit: number;
  is_me: boolean;
  is_creator: boolean;
};

export const LEAGUE_DURATIONS = [1, 3, 7, 14, 30] as const;
export const LEAGUE_FEES = [0, 50, 100, 250, 500] as const;
export const LEAGUE_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

/** The private pot's split, renormalised like the settlement does. */
export function potSplit(pot: number, members: number): number[] {
  const winners = Math.min(3, Math.max(0, members));
  if (pot <= 0 || winners === 0) return [];
  const shares = [50, 30, 20].slice(0, winners);
  const total = shares.reduce((a, b) => a + b, 0);
  const amounts = shares.map((share) => Math.floor((pot * share) / total));
  amounts[0] += pot - amounts.reduce((a, b) => a + b, 0);
  return amounts;
}

/** What 1st/2nd/3rd win: fixed prizes, or the pot as it stands. */
export function leaguePrizes(league: Pick<LeagueSummary, "kind" | "prizes" | "pot" | "members">): number[] {
  if (league.kind === "public") return (league.prizes ?? []).map(Number).filter((p) => p > 0);
  return potSplit(Number(league.pot) || 0, league.members);
}

export type LeaguePhase = "upcoming" | "live" | "ended";

export function leaguePhase(league: Pick<LeagueSummary, "starts_at" | "ends_at" | "settled">, now = Date.now()): LeaguePhase {
  if (league.settled || Date.parse(league.ends_at) <= now) return "ended";
  if (Date.parse(league.starts_at) > now) return "upcoming";
  return "live";
}

export function leagueShareUrl(code: string) {
  return `https://383ks.com/tregu/ligat?kodi=${encodeURIComponent(code)}`;
}

/** Supabase RPC errors carry our Albanian message; anything else gets a plain one. */
export function leagueError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  return /[ëçÇË]|Liga|lig/.test(message) ? message : "Diçka nuk shkoi. Provo përsëri.";
}
