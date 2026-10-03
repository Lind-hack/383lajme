// League points v2 (migration 0097), mirrored for the page: what a pick
// earns, what the streak is worth, the explainer's numbers, and the road to
// 10€. The SQL is the source of truth; lib/tregu-points.test.mjs pins these
// to the same cases the migration rehearsal checks.

/** 🔥 Seria: the streak counts the pick itself. 3rd and 4th ×1.5, 5th+ ×2. */
export function streakMultiplier(streakIncludingCurrent) {
  const s = Number(streakIncludingCurrent) || 0;
  return s >= 5 ? 2 : s >= 3 ? 1.5 : 1;
}

/**
 * What one resolved pick earns. Wrong = 0 always. v1 leagues: the base
 * points. v2: base × streak × (⭐ ? 2 : 1), rounded like the SQL.
 */
export function effectivePoints({ points, correct, streakBefore = 0, boosted = false, rulesVersion = 1 }) {
  if (!correct) return 0;
  const base = Number(points) || 0;
  if ((Number(rulesVersion) || 1) < 2) return base;
  return Math.round(base * streakMultiplier((Number(streakBefore) || 0) + 1) * (boosted ? 2 : 1));
}

/** Base points for a correct pick at this probability: 100 minus it, 1..99. */
export function basePoints(probability) {
  // Unknown → 0.5; a real 0 clamps to 0.01 like the SQL (not to 0.5).
  const raw = probability == null || !Number.isFinite(Number(probability)) ? 0.5 : Number(probability);
  const p = Math.min(0.99, Math.max(0.01, raw));
  return Math.max(1, Math.min(99, Math.round(100 * (1 - p))));
}

/** The chip on the league page: the live streak and what the next correct pick earns. */
export function streakLine(streak) {
  const s = Math.max(0, Number(streak) || 0);
  const next = streakMultiplier(s + 1);
  if (s === 0) return "🔥 Seria: 3 të sakta rresht dhe e treta merr ×1.5";
  if (next === 1) return `🔥 ${s} në rresht · edhe ${3 - s} për ×1.5`;
  if (next === 1.5) return `🔥 ${s} në rresht · e saktë tjetër merr ×1.5`;
  return `🔥 ${s} në rresht · e saktë tjetër merr ×2`;
}

/** The explainer's example, with a real probability: favourite vs surprise. */
export function pointsExample(probability) {
  const fav = basePoints(probability);
  const surprise = basePoints(1 - (Number(probability) || 0.5));
  return { favourite: Math.min(fav, surprise), surprise: Math.max(fav, surprise) };
}

/** The 10€ road: the milestone just reached and the next one, with their lines. */
export const MILESTONES = [
  { at: 1000, goal: "1 000 Monedhat e para", line: "1 000 Monedha · rruga drejt 10€ nisi" },
  { at: 2500, goal: "një të katërtën e rrugës", line: "Një e katërta e rrugës për 10€" },
  { at: 5000, goal: "gjysmën e rrugës", line: "Gjysma e rrugës për 10€" },
  { at: 7500, goal: "tre të katërtat", line: "Tre të katërtat · 10€ janë afër" },
  { at: 10000, goal: "10€", line: "10 000 Monedha · 10€ janë të tuat" },
];

export function milestone(coins) {
  const c = Math.max(0, Number(coins) || 0);
  let reached = null;
  for (const m of MILESTONES) if (c >= m.at) reached = m;
  const next = MILESTONES.find((m) => c < m.at) ?? null;
  return { reached, next, toNext: next ? next.at - c : 0 };
}
