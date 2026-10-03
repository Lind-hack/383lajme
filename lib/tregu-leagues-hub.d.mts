export type CardTone = "due" | "done" | "idle" | "upcoming" | "join" | "ended";

/** The fields of a tregu_leagues_hub() row these helpers read. */
export type HubLike = {
  starts_at: string;
  ends_at: string;
  settled?: boolean | null;
  is_member?: boolean | null;
  open_count?: number | null;
  picked_count?: number | null;
  next_lock_at?: string | null;
  my_rank?: number | null;
  my_points?: number | null;
  my_rank_change?: number | null;
  gap_to_podium?: number | null;
  ranks_ready?: boolean | null;
  active_today?: number | null;
  members?: number | null;
};

export function cardStatus(row: HubLike, now?: number): { tone: CardTone; label: string };
export function stripStatus(row: HubLike, now?: number): { tone: CardTone; label: string; short: string };
export function sortMine<T extends HubLike>(rows: T[] | null | undefined, now?: number): T[];
export function podiumLine(row: HubLike): { rank: number | null; change: number; points: number; note: string } | null;
export function leaveCopy(
  league: {
    entry_fee?: number | null;
    members?: number | null;
    pot?: number | null;
    starts_at?: string | null;
    joined_at?: string | null;
    has_picks?: boolean | null;
  },
  now?: number
): { refund: number; text: string };
export function picksDueCopy(data: Record<string, unknown> | null | undefined): { title: string; body: string };
