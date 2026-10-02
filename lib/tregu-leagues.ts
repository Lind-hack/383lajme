/** Leagues: a prediction game on top of Tregu (migration 0089). Members make
 *  one free pick per market; a correct pick earns 100 minus the outcome's
 *  probability when picked. Public leagues are 383's, private ones run on
 *  their members' entry fees plus a 383 bonus. A reader's own public league
 *  (migration 0095) is a private one that is `listed`: same pot, but anyone
 *  can find and join it. */

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
  /** The caller's points (the column kept its old name). */
  my_profit?: number | null;
  settled: boolean;
  description?: string | null;
  rules?: string | null;
  emblem?: string | null;
  color?: string | null;
  cover_url?: string | null;
  sponsor?: string | null;
  /** The sponsor's logo and site (migration 0090). */
  sponsor_logo?: string | null;
  sponsor_url?: string | null;
  scope_kind?: LeagueScopeKind | null;
  scope_value?: string | null;
  faces?: string[] | null;
  featured?: boolean;
  feature_order?: number;
  /** A reader's public league: findable and joinable by anyone (0095). */
  listed?: boolean;
};

/** One card on the floor, from tregu_leagues_hub() (migration 0095). */
export type HubLeague = LeagueSummary & {
  section: "mine" | "official" | "open";
  created_at: string;
  my_points: number | null;
  my_rank_change: number;
  /** Points to pass third; 0 on the podium; null when not ranked yet. */
  gap_to_podium: number | null;
  ranks_ready: boolean;
  top3: { rank: number; name: string; points: number; me: boolean }[] | null;
  day_king: string | null;
  day_king_points: number | null;
  /** Pickable markets locking in the next 24 hours, and how many are picked. */
  open_count: number;
  picked_count: number;
  next_lock_at: string | null;
  /** Members who picked in the last 24 hours. */
  active_today: number;
};

/** A tregu_league_search() result. */
export type SearchLeague = Pick<
  LeagueSummary,
  "id" | "name" | "kind" | "listed" | "starts_at" | "ends_at" | "entry_fee" | "prizes" | "pot" | "members" | "max_members" |
  "is_member" | "emblem" | "color" | "scope_kind" | "scope_value"
> & { active_today: number };

export type LeagueStanding = {
  rank: number;
  display_name: string;
  /** Points (the column kept its old name). */
  profit: number;
  is_me: boolean;
  is_creator: boolean;
  today_profit?: number;
  /** Correct picks. */
  trades?: number;
  streak?: number;
  joined_at?: string;
  /** Opaque per-league id to challenge this member (never the account id). */
  member_key?: string;
  /** Places gained since the start of today (negative: lost). */
  rank_change?: number;
  duel_wins?: number;
};

export type Duel = {
  id: string;
  league_id: string;
  league_name: string;
  status: "pending" | "active" | "settled" | "declined" | "expired";
  stake: number;
  i_am_challenger: boolean;
  rival: string;
  created_at: string;
  ends_at: string | null;
  my_net: number;
  rival_net: number;
  won: boolean | null;
};

/** One outcome on the pick board, with its live probability (0..1). */
export type PickOption = { key: string; label: string; color?: string | null; logo?: string | null; prob: number | null };

/** A market on a league's pick board (tregu_league_board). */
export type BoardRow = {
  market_id: string;
  slug: string;
  question: string;
  market_type: string;
  lock_at: string;
  status: string;
  result_outcome: string | null;
  options: PickOption[] | null;
  my_outcome: string | null;
  my_points: number | null;
  result: "open" | "locked" | "won" | "lost" | "void";
};

/** Points a correct pick earns at this probability: 100 minus it, 1..99.
 *  Mirrors tregu_league_pick(). */
export function pickPoints(probability: number | null | undefined): number {
  const p = Math.min(0.99, Math.max(0.01, Number(probability) || 0.5));
  return Math.max(1, Math.min(99, Math.round(100 * (1 - p))));
}

/** Duel stakes: 0 to 50 coins each. */
export const DUEL_STAKES = [0, 10, 25, 50] as const;

/** The create sheet's icons and colours. A public league may only use these
 *  icons (tregu_listed_emblems() in 0095 holds the same list). */
export const LEAGUE_EMOJIS = ["🏆", "🦅", "🔥", "⚡", "👑", "🎯", "🚀", "💎", "🐺", "⚽", "🏀", "🏎️"] as const;
export const LEAGUE_COLORS = ["#F2C14E", "#FF4422", "#E41E20", "#0047FF", "#00A651", "#7C3AED", "#EC4899", "#0EA5E9"] as const;

export const LEAGUE_DURATIONS = [1, 3, 7, 14, 30] as const;
export const DURATION_LABEL: Record<number, string> = { 1: "1 ditë", 3: "3 ditë", 7: "1 javë", 14: "2 javë", 30: "1 muaj" };
/** Private entry fees: 10 to 10 000 coins (migration 0086). */
export const LEAGUE_FEES = [10, 50, 100, 500, 1000, 5000, 10000] as const;
export const LEAGUE_FEE_MIN = 10;
export const LEAGUE_FEE_MAX = 10000;
/** Every public league costs this to enter. */
export const PUBLIC_LEAGUE_FEE = 10;

/** Suggested public prizes: the full leaderboard prize for the league's
 *  length — the weekly board up to seven days, the monthly board beyond. The
 *  admin can change them before anyone joins. */
export function publicLeaguePrizes(days: number): number[] {
  const base = days <= 7 ? [125, 75, 40] : [500, 300, 150];
  return [...base];
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

/** Mirrors tregu_league_family(): which leagues count as "the same kind" for copying picks. */
export function leagueFamilyLabel(kind: string | null | undefined, value: string | null | undefined): string {
  if (!kind || kind === "all") return "me të gjitha tregjet";
  if (kind === "f1") return "e Formula 1";
  if (kind === "competition") return value && ["nba", "fbk.kosovo", "fiba.world"].includes(value) ? "e basketbollit" : "e futbollit";
  const label = LEAGUE_SCOPES.find((scope) => scope.kind === kind && scope.value === value)?.label;
  return label ? `e kategorisë ${label}` : "të të njëjtit lloj";
}

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

/** 383's top-up on a private pot, by length: up to a week +15%, two weeks
 *  +25%, longer +40% (migration 0090). Mirrors tregu_private_bonus_pct(). */
export function privateBonusPct(days: number): number {
  return days <= 7.5 ? 15 : days <= 15 ? 25 : 40;
}

export function leagueDays(league: Pick<LeagueSummary, "starts_at" | "ends_at">): number {
  return (Date.parse(league.ends_at) - Date.parse(league.starts_at)) / 86_400_000;
}

/** The pot's split, renormalised like the settlement does. */
export function potSplit(pot: number, members: number): number[] {
  const winners = Math.min(3, Math.max(0, members));
  if (pot <= 0 || winners === 0) return [];
  const shares = [50, 30, 20].slice(0, winners);
  const total = shares.reduce((a, b) => a + b, 0);
  const amounts = shares.map((share) => Math.floor((pot * share) / total));
  amounts[0] += pot - amounts.reduce((a, b) => a + b, 0);
  return amounts;
}

type PrizeLeague = Pick<LeagueSummary, "kind" | "prizes" | "pot" | "members" | "starts_at" | "ends_at">;

/** A private pot with 383's bonus on top. */
export function privatePurse(pot: number, days: number): number {
  return pot + Math.floor((pot * privateBonusPct(days)) / 100);
}

/** What 1st/2nd/3rd win if three members score: private leagues split their
 *  pot plus 383's bonus; public leagues pay 383's prizes plus the fee pot. */
export function leaguePrizes(league: PrizeLeague): number[] {
  const pot = Number(league.pot) || 0;
  if (league.kind === "public") {
    const fixed = (league.prizes ?? []).map(Number);
    const share = potSplit(pot, 3);
    return [0, 1, 2].map((index) => (fixed[index] ?? 0) + (share[index] ?? 0)).filter((prize) => prize > 0);
  }
  return potSplit(privatePurse(pot, leagueDays(league)), Math.min(3, league.members));
}

/** Everything on the table: the three prizes added up. */
export function leaguePurse(league: PrizeLeague): number {
  return leaguePrizes(league).reduce((sum, prize) => sum + prize, 0);
}

export type LeaguePhase = "upcoming" | "live" | "ended";

export function leaguePhase(league: Pick<LeagueSummary, "starts_at" | "ends_at" | "settled">, now = Date.now()): LeaguePhase {
  if (league.settled || Date.parse(league.ends_at) <= now) return "ended";
  if (Date.parse(league.starts_at) > now) return "upcoming";
  return "live";
}

/** The invite link: the Tregu floor opens the join sheet with this code. */
export function leagueShareUrl(code: string) {
  return `https://383ks.com/tregu?kodi=${encodeURIComponent(code)}#ligat`;
}

/** Supabase RPC errors carry our Albanian message; anything else gets a plain one. */
export function leagueError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  return /[ëçÇË]|Liga|lig/.test(message) ? message : "Diçka nuk shkoi. Provo përsëri.";
}
