// The pick board as a game: where a pick would move you, how the league
// split, what your rival did. Pure, so node --test covers it.

/**
 * Your place if this pick lands and nothing else changes: everyone with more
 * points than your new total stays above you. Ties keep their order (the
 * standings break them by who got there first), so a tie does not pass.
 */
export function projectRank(standings, add) {
  const rows = Array.isArray(standings) ? standings : [];
  const me = rows.find((row) => row?.is_me);
  if (!me) return null;
  const mine = Number(me.profit) || 0;
  const next = mine + (Number(add) || 0);
  const above = rows.filter((row) => !row.is_me && (Number(row.profit) || 0) >= next).length;
  return { from: Number(me.rank) || rows.indexOf(me) + 1, to: above + 1 };
}

/** "#6 → #3", or "mban #1", or null when it would not move you. */
export function projectionLabel(projection) {
  if (!projection) return null;
  if (projection.to < projection.from) return `#${projection.from} → #${projection.to}`;
  if (projection.from === 1) return "mban #1";
  return null;
}

/** How the league split on one market: outcome → { picks, pct }, plus the total. */
export function splitFor(rows, marketId) {
  const mine = (Array.isArray(rows) ? rows : []).filter((row) => row?.market_id === marketId);
  const total = mine.reduce((sum, row) => sum + (Number(row.picks) || 0), 0);
  const by = {};
  for (const row of mine) {
    const picks = Number(row.picks) || 0;
    by[row.outcome] = { picks, pct: total ? Math.round((picks / total) * 100) : 0 };
  }
  return { total, by };
}

/** The line under your pick: with the crowd, against it, or nearly alone. */
export function crowdLine(split, myOutcome, label) {
  if (!split || !myOutcome || split.total < 2) return null;
  const mine = split.by[myOutcome];
  if (!mine) return null;
  const others = mine.picks - 1;
  if (others <= 0) return `Vetëm ti zgjodhe ${label}. Nëse del, dallohesh nga gjithë liga.`;
  if (mine.pct <= 25) return `Vetëm ${others} ${others === 1 ? "tjetër zgjodhi" : "të tjerë zgjodhën"} ${label}. Nëse del, ia kalon shumicës.`;
  if (mine.pct >= 60) return `${mine.pct}% e ligës mendon si ti.`;
  return `${mine.pct}% e ligës zgjodhi ${label}.`;
}

/** The rival line: same way (no gap made) or opposite (this one decides). */
export function rivalLine(rival, myOutcome, labelOf) {
  if (!rival || !rival.outcome || !myOutcome) return null;
  const name = String(rival.rival_name ?? "Rivali");
  const where = rival.i_lead ? `pas teje, #${rival.rival_rank}` : `#${rival.rival_rank}, para teje`;
  if (rival.outcome === myOutcome) return { tone: "same", text: `${name} (${where}) zgjodhi njësoj. Këtu nuk ndaheni.` };
  return {
    tone: "split",
    text: `${name} (${where}) zgjodhi ${labelOf(rival.outcome)}. Ti ${labelOf(myOutcome)}: kjo ndeshje vendos.`,
  };
}

/** The deck's order: what locks soonest first. */
export function deckOrder(rows, now = Date.now()) {
  return [...(rows ?? [])]
    .filter((row) => row?.result === "open" && !row?.my_outcome && Date.parse(row.lock_at) > now)
    .sort((a, b) => Date.parse(a.lock_at) - Date.parse(b.lock_at));
}
