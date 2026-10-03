type StandingLike = { is_me?: boolean; profit?: number | null; rank?: number | null };
export type Projection = { from: number; to: number };
export function projectRank(standings: StandingLike[] | null | undefined, add: number): Projection | null;
export function projectionLabel(projection: Projection | null): string | null;
export type Split = { total: number; by: Record<string, { picks: number; pct: number }> };
export function splitFor(rows: { market_id: string; outcome: string; picks: number }[] | null | undefined, marketId: string): Split;
export function crowdLine(split: Split | null, myOutcome: string | null | undefined, label: string): string | null;
export type RivalPick = { rival_name: string; rival_rank: number; i_lead: boolean; market_id: string; outcome: string };
export function rivalLine(
  rival: RivalPick | null | undefined,
  myOutcome: string | null | undefined,
  labelOf: (key: string) => string
): { tone: "same" | "split"; text: string } | null;
export function deckOrder<T extends { result?: string; my_outcome?: string | null; lock_at: string }>(rows: T[] | null | undefined, now?: number): T[];
