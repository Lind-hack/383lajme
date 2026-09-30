// The daily bonus odds, mirrored from tregu_daily_bonus_amount() in
// supabase/migrations/0091_tregu_daily_streak.sql. The database rolls the real
// amount; this copy only lets the page show the reader their odds, and lets the
// tests check the table adds up. Change both together.

export const BONUS_MIN = 10;
export const JACKPOT = 25;
const WEIGHTS = [18, 16, 14, 12, 10, 8, 5.5, 4.5, 3.5, 2.5, 1.8, 1.3, 1.0, 0.7, 0.5]; // 10..24

/** Jackpot chance for a claim that lands on `streak`: 2% on day 1, 6% from day 7. */
export function jackpotChance(streak) {
  const step = Math.min(Math.max(Math.trunc(Number(streak) || 1), 1), 7) - 1;
  return 0.02 + step * (0.04 / 6);
}

/** Probability of each amount 10..25 for a claim that lands on `streak`. */
export function bonusOdds(streak) {
  const step = Math.min(Math.max(Math.trunc(Number(streak) || 1), 1), 7) - 1;
  const lift = 1 + step * 0.06;
  const jackpot = jackpotChance(streak);
  const weights = WEIGHTS.map((w, i) => w * (i >= 8 ? lift : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const odds = {};
  weights.forEach((w, i) => {
    odds[BONUS_MIN + i] = (w / total) * (1 - jackpot);
  });
  odds[JACKPOT] = jackpot;
  return odds;
}

/** Same roll as the database, for tests: `roll` uniform in [0, 1). */
export function bonusAmount(streak, roll) {
  const jackpot = jackpotChance(streak);
  if (roll < jackpot) return JACKPOT;
  const step = Math.min(Math.max(Math.trunc(Number(streak) || 1), 1), 7) - 1;
  const lift = 1 + step * 0.06;
  const weights = WEIGHTS.map((w, i) => w * (i >= 8 ? lift : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = ((roll - jackpot) / (1 - jackpot)) * total;
  for (let i = 0; i < weights.length; i++) {
    if (pick < weights[i]) return BONUS_MIN + i;
    pick -= weights[i];
  }
  return JACKPOT - 1;
}
