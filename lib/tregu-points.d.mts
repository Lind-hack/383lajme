export function streakMultiplier(streakIncludingCurrent: number): number;
export function effectivePoints(pick: {
  points: number;
  correct: boolean;
  streakBefore?: number;
  boosted?: boolean;
  rulesVersion?: number;
}): number;
export function basePoints(probability: number | null | undefined): number;
export function streakLine(streak: number | null | undefined): string;
export function pointsExample(probability: number | null | undefined): { favourite: number; surprise: number };
export type Milestone = { at: number; goal: string; line: string };
export const MILESTONES: Milestone[];
export function milestone(coins: number | null | undefined): { reached: Milestone | null; next: Milestone | null; toNext: number };
