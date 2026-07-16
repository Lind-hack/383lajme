// Multi-outcome events, Polymarket-style: one event = N linked binary
// markets, one per outcome. Betting an outcome = buying PO on that outcome's
// own LMSR book, so pricing/RPCs stay untouched.
//
// Grouping convention (no schema change needed): markets whose question reads
// "<Event title>: <Outcome>?" and share the same title form one event, e.g.
//   "Anglia – Argjentina: Fiton Anglia?"
//   "Anglia – Argjentina: Barazim?"
//   "Anglia – Argjentina: Fiton Argjentina?"
// A title needs 2+ open markets to count as an event — a lone "X: Y?" market
// stays a normal single card, so old questions can't group by accident.
import type { MiniMarket } from "@/components/tregu/market-mini-card";

export interface GroupOutcome extends MiniMarket {
  /** Short display label — "Fiton Anglia" → "Anglia". */
  label: string;
  color: string;
  /** Raw LMSR book price before cross-outcome normalization. */
  rawProb: number;
}

export interface MarketGroup {
  key: string;
  title: string;
  category: string;
  closesAt?: string;
  volume: number;
  /** Sorted by live probability, favourite first. */
  outcomes: GroupOutcome[];
}

// Assigned alphabetically by label so an outcome keeps its colour even when
// the probability ranking reshuffles mid-match.
const OUTCOME_COLORS = ["#E41E20", "#0047FF", "#6B6B6B", "#B45309", "#00854A"];

export function parseEvent(question: string): { title: string; outcome: string } | null {
  const m = question.match(/^(.{3,80}?):\s+(.{2,60}?)\s*\??$/);
  if (!m) return null;
  return { title: m[1].trim(), outcome: m[2].trim() };
}

/** "Fiton Anglia" → "Anglia"; "Barazim" stays "Barazim". */
export function shortLabel(outcome: string): string {
  return outcome.replace(/^fiton\s+/i, "").replace(/\s+fiton$/i, "").trim() || outcome;
}

export function slugKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function groupMarkets(minis: MiniMarket[]): {
  groups: MarketGroup[];
  singles: MiniMarket[];
} {
  const byKey = new Map<string, { title: string; members: { mini: MiniMarket; outcome: string }[] }>();
  for (const m of minis) {
    const p = parseEvent(m.question);
    if (!p) continue;
    const key = slugKey(p.title);
    if (!key) continue;
    const cur = byKey.get(key) ?? { title: p.title, members: [] };
    cur.members.push({ mini: m, outcome: p.outcome });
    byKey.set(key, cur);
  }

  const grouped = new Set<string>();
  const groups: MarketGroup[] = [];
  for (const [key, g] of byKey) {
    if (g.members.length < 2) continue;
    const colorOrder = [...g.members].sort((a, b) =>
      shortLabel(a.outcome).localeCompare(shortLabel(b.outcome), "sq")
    );
    const colorOf = new Map(colorOrder.map((m, i) => {
      const label = shortLabel(m.outcome).toLowerCase();
      const color = label === "spanja" ? "#ff5a52" : label === "argjentina" ? "#7bb6ff" : OUTCOME_COLORS[i % OUTCOME_COLORS.length];
      return [m.mini.slug, color];
    }));
    // Each outcome is an independent binary book, so raw PO prices can sum to
    // anything (e.g. 136%). Displayed odds are normalized to a 100% total —
    // trade execution still uses the raw book price.
    const rawSum = g.members.reduce((s, m) => s + m.mini.prob, 0);
    const outcomes: GroupOutcome[] = g.members
      .map((m) => ({
        ...m.mini,
        rawProb: m.mini.prob,
        prob: rawSum > 0 ? m.mini.prob / rawSum : 1 / g.members.length,
        label: shortLabel(m.outcome),
        color: colorOf.get(m.mini.slug)!,
      }))
      .sort((a, b) => b.prob - a.prob);
    for (const o of outcomes) grouped.add(o.slug);
    groups.push({
      key,
      title: g.title,
      category: g.members[0].mini.category,
      closesAt: g.members[0].mini.closesAt,
      volume: g.members.reduce((s, m) => s + (m.mini.volume ?? 0), 0),
      outcomes,
    });
  }
  groups.sort((a, b) => b.volume - a.volume);

  return { groups, singles: minis.filter((m) => !grouped.has(m.slug)) };
}

/** Find the event a single market belongs to, or null if it's a plain binary. */
export function groupForSlug(minis: MiniMarket[], slug: string): MarketGroup | null {
  const { groups } = groupMarkets(minis);
  return groups.find((g) => g.outcomes.some((o) => o.slug === slug)) ?? null;
}
