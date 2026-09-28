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
  description?: string | null;
  rules?: string | null;
  emblem?: string | null;
  color?: string | null;
  cover_url?: string | null;
  sponsor?: string | null;
  scope_kind?: LeagueScopeKind | null;
  scope_value?: string | null;
  faces?: string[] | null;
};

export type LeagueStanding = {
  rank: number;
  display_name: string;
  profit: number;
  is_me: boolean;
  is_creator: boolean;
  today_profit?: number;
  trades?: number;
  streak?: number;
  joined_at?: string;
};

export type LeagueFeedItem = {
  kind: "close" | "join";
  display_name: string;
  amount: number;
  question: string | null;
  slug: string | null;
  at: string;
};

export const LEAGUE_DURATIONS = [1, 3, 7, 14, 30] as const;
export const DURATION_LABEL: Record<number, string> = { 1: "1 ditë", 3: "3 ditë", 7: "1 javë", 14: "2 javë", 30: "1 muaj" };
/** Private entry fees: 10 to 10 000 coins (migration 0086). */
export const LEAGUE_FEES = [10, 50, 100, 500, 1000, 5000, 10000] as const;
export const LEAGUE_FEE_MIN = 10;
export const LEAGUE_FEE_MAX = 10000;
/** Every public league costs this to enter. */
export const PUBLIC_LEAGUE_FEE = 10;

/** Public prizes: 75% of the leaderboard prize for the league's length —
 *  the weekly board up to seven days, the monthly board beyond. */
export function publicLeaguePrizes(days: number): number[] {
  const base = days <= 7 ? [125, 75, 40] : [500, 300, 150];
  return base.map((prize) => Math.round(prize * 0.75));
}

export type LeagueScopeKind = "all" | "category" | "competition" | "f1";

export type LeagueScope = {
  kind: LeagueScopeKind;
  value: string | null;
  label: string;
  emblem: string;
  color: string;
};

/** Themes a public league can take: only trades in that slice count. */
export const LEAGUE_SCOPES: LeagueScope[] = [
  { kind: "all", value: null, label: "Të gjitha tregjet", emblem: "🏆", color: "#FF4422" },
  { kind: "category", value: "kosove", label: "Kosovë", emblem: "/images/categories/kosove.svg", color: "#0047FF" },
  { kind: "category", value: "shqiperi", label: "Shqipëri", emblem: "/images/categories/shqiperi.svg", color: "#E41E20" },
  { kind: "category", value: "ekonomi", label: "Ekonomi", emblem: "📈", color: "#00A651" },
  { kind: "category", value: "bote", label: "Botë", emblem: "🌍", color: "#F59E0B" },
  { kind: "competition", value: "uefa.champions", label: "Champions League", emblem: "/logos/uefachampionsleague.svg", color: "#263CC9" },
  { kind: "competition", value: "uefa.europa", label: "Europa League", emblem: "/logos/uefaeuropaleague.svg", color: "#B95408" },
  { kind: "competition", value: "uefa.europa.conf", label: "Conference League", emblem: "/logos/uefaeuroconferenceleague.svg", color: "#13843C" },
  { kind: "competition", value: "uefa.nations", label: "Nations League", emblem: "/logos/uefanationsleague.webp", color: "#2D4A7C" },
  { kind: "competition", value: "eng.1", label: "Premier League", emblem: "/logos/premierleague.svg", color: "#360D3A" },
  { kind: "competition", value: "esp.1", label: "La Liga", emblem: "/logos/laliga.svg", color: "#FF4B44" },
  { kind: "competition", value: "ita.1", label: "Serie A", emblem: "/logos/seriea.svg", color: "#0873F9" },
  { kind: "competition", value: "ger.1", label: "Bundesliga", emblem: "/logos/bundesliga.svg", color: "#D10214" },
  { kind: "competition", value: "fbk.kosovo", label: "Superliga e Kosovës", emblem: "🏀", color: "#A8380F" },
  { kind: "competition", value: "nba", label: "NBA", emblem: "/logos/nba.svg", color: "#17408B" },
  { kind: "f1", value: null, label: "Formula 1", emblem: "/logos/f1.svg", color: "#E10600" },
];

export function scopeOf(league: Pick<LeagueSummary, "scope_kind" | "scope_value">): LeagueScope {
  return (
    LEAGUE_SCOPES.find((scope) => scope.kind === (league.scope_kind ?? "all") && scope.value === (league.scope_value ?? null)) ??
    LEAGUE_SCOPES[0]
  );
}

/** A league's accent: its own colour, else its theme's. */
export function leagueColor(league: Pick<LeagueSummary, "color" | "scope_kind" | "scope_value" | "kind">): string {
  if (league.color && /^#[0-9A-Fa-f]{6}$/.test(league.color)) return league.color;
  return league.kind === "private" ? "#F2C14E" : scopeOf(league).color;
}

/** An emblem is either an image path/URL or a short emoji/text mark. */
export function isImageEmblem(emblem: string | null | undefined): emblem is string {
  return Boolean(emblem && (emblem.startsWith("/") || emblem.startsWith("http")));
}
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

/** What 1st/2nd/3rd win if it ended now: private leagues split their pot;
 *  public leagues pay 383's fixed prizes plus the entry-fee pot. */
export function leaguePrizes(league: Pick<LeagueSummary, "kind" | "prizes" | "pot" | "members">): number[] {
  const pot = Number(league.pot) || 0;
  if (league.kind === "public") {
    const fixed = (league.prizes ?? []).map(Number);
    const share = potSplit(pot, 3);
    return fixed.map((prize, index) => prize + (share[index] ?? 0)).filter((prize) => prize > 0);
  }
  return potSplit(pot, league.members);
}

/** Everything on the table: the three prizes added up. */
export function leaguePurse(league: Pick<LeagueSummary, "kind" | "prizes" | "pot" | "members">): number {
  return leaguePrizes(league).reduce((sum, prize) => sum + prize, 0);
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
