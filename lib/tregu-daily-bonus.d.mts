export const BONUS_MIN: number;
export const JACKPOT: number;
export function jackpotChance(streak: number): number;
export function bonusOdds(streak: number): Record<number, number>;
export function bonusAmount(streak: number, roll: number): number;
