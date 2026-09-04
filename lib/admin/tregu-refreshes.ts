import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { adminTimestamp } from "./format";

/**
 * What the odds did, and what moved them.
 *
 * Everything needed already sits in market_snapshots -- when the reprice ran
 * (created_at), which market it repriced (market_id), where the price landed
 * (market_prob), what the model thought (ai_prob) and, in `evidence`, the exact
 * articles the scoring cited. None of it was ever surfaced, so a price that
 * moved looked like it moved for no reason.
 *
 * This rolls the snapshots up per market rather than listing them. There are
 * 14,755 of them and the reprice runs every couple of minutes, so a flat feed
 * is a firehose: measured over the most recent 1,000, only 45 markets appear at
 * all and only 25 of those actually changed price. "Which markets moved, when,
 * and on what evidence" is the question worth answering.
 */

/** PostgREST caps a single response at 1,000 rows, which is also plenty here. */
const WINDOW = 1000;

export type Evidence = { title: string | null; url: string | null; slug: string | null };

export type Refresh = {
  at: string;
  atLabel: string;
  marketProb: number;
  aiProb: number | null;
  volume: number;
  evidence: Evidence[];
};

export type MarketRefresh = {
  marketId: string;
  question: string;
  slug: string | null;
  status: string | null;
  category: string | null;

  /** Most recent reprice in the window. */
  latest: Refresh;
  /** The reprice before it, when the window contains one. */
  previous: Refresh | null;
  /** Oldest reprice in the window, for the run-length move. */
  first: Refresh;

  refreshCount: number;
  /** Signed change against the previous reprice; null when there is no previous. */
  stepDelta: number | null;
  /** Signed change across the whole window. */
  windowDelta: number;
  /** How far the model sat from the market at the latest reprice. */
  aiGap: number | null;
};

export type RefreshSummary = {
  markets: MarketRefresh[];
  snapshotsScanned: number;
  windowFrom: string | null;
  windowTo: string | null;
  movedCount: number;
  error: string | null;
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Evidence is operator-facing text that arrived from a scraper, so it is
 * treated as data throughout: entries are shaped defensively and a missing
 * title is kept as null for the UI to label rather than being invented here.
 * Live rows already contain `{"title": null}`.
 */
function normalizeEvidence(raw: unknown): Evidence[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item) => {
    const e = (item ?? {}) as Record<string, unknown>;
    return {
      title: typeof e.title === "string" && e.title.trim() ? e.title : null,
      url: typeof e.url === "string" && e.url.startsWith("http") ? e.url : null,
      slug: typeof e.slug === "string" && e.slug ? e.slug : null,
    };
  });
}

function toRefresh(row: Record<string, unknown>): Refresh {
  const at = String(row.created_at ?? "");
  return {
    at,
    atLabel: adminTimestamp(at),
    marketProb: Number(row.market_prob ?? 0),
    // Sport markets are priced by the scraper rather than by Groq, so ai_prob
    // is legitimately null on most recent rows. It must not read as zero.
    aiProb: row.ai_prob == null ? null : Number(row.ai_prob),
    volume: Number(row.volume ?? 0),
    evidence: normalizeEvidence(row.evidence),
  };
}

export type RefreshSort = "moved" | "recent";

export async function marketRefreshes(sort: RefreshSort = "moved"): Promise<RefreshSummary> {
  const empty: RefreshSummary = {
    markets: [],
    snapshotsScanned: 0,
    windowFrom: null,
    windowTo: null,
    movedCount: 0,
    error: null,
  };
  const supabase = client();
  if (!supabase) return { ...empty, error: "Supabase nuk është konfiguruar." };

  const { data, error } = await supabase
    .from("market_snapshots")
    .select("market_id,market_prob,ai_prob,volume,evidence,created_at")
    .order("created_at", { ascending: false })
    .limit(WINDOW);

  if (error) return { ...empty, error: error.message };
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return empty;

  // Rows arrive newest-first, so the first seen per market is its latest.
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const id = String(row.market_id ?? "");
    if (!id) continue;
    const bucket = grouped.get(id);
    if (bucket) bucket.push(row);
    else grouped.set(id, [row]);
  }

  const ids = [...grouped.keys()];
  const { data: marketRows } = await supabase
    .from("markets")
    .select("id,question,slug,status,category")
    .in("id", ids);

  const markets = new Map(
    ((marketRows ?? []) as Array<Record<string, unknown>>).map((m) => [String(m.id), m]),
  );

  const out: MarketRefresh[] = [];
  for (const [marketId, snaps] of grouped) {
    const latest = toRefresh(snaps[0]);
    const previous = snaps.length > 1 ? toRefresh(snaps[1]) : null;
    const first = toRefresh(snaps[snaps.length - 1]);
    const market = markets.get(marketId);

    out.push({
      marketId,
      question: market ? String(market.question ?? "") : "(tregu nuk u gjet)",
      slug: market?.slug ? String(market.slug) : null,
      status: market?.status ? String(market.status) : null,
      category: market?.category ? String(market.category) : null,
      latest,
      previous,
      first,
      refreshCount: snaps.length,
      stepDelta: previous ? latest.marketProb - previous.marketProb : null,
      windowDelta: latest.marketProb - first.marketProb,
      aiGap: latest.aiProb == null ? null : latest.aiProb - latest.marketProb,
    });
  }

  if (sort === "recent") {
    out.sort((a, b) => b.latest.at.localeCompare(a.latest.at));
  } else {
    // Biggest mover first; a market that did not move is not news.
    out.sort((a, b) => Math.abs(b.windowDelta) - Math.abs(a.windowDelta));
  }

  const times = rows.map((r) => String(r.created_at ?? "")).filter(Boolean);
  return {
    markets: out,
    snapshotsScanned: rows.length,
    windowFrom: times.length ? adminTimestamp(times[times.length - 1]) : null,
    windowTo: times.length ? adminTimestamp(times[0]) : null,
    movedCount: out.filter((m) => Math.abs(m.windowDelta) > 0.001).length,
    error: null,
  };
}

/** Every reprice for one market in the window, newest first. */
export async function marketRefreshHistory(
  marketId: string,
  limit = 60,
): Promise<{ question: string; slug: string | null; refreshes: Refresh[]; error: string | null }> {
  const supabase = client();
  if (!supabase) {
    return { question: "", slug: null, refreshes: [], error: "Supabase nuk është konfiguruar." };
  }

  const [{ data: snaps, error }, { data: market }] = await Promise.all([
    supabase
      .from("market_snapshots")
      .select("market_id,market_prob,ai_prob,volume,evidence,created_at")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("markets").select("question,slug").eq("id", marketId).maybeSingle(),
  ]);

  if (error) return { question: "", slug: null, refreshes: [], error: error.message };

  const m = (market ?? {}) as Record<string, unknown>;
  return {
    question: String(m.question ?? ""),
    slug: m.slug ? String(m.slug) : null,
    refreshes: ((snaps ?? []) as Array<Record<string, unknown>>).map(toRefresh),
    error: null,
  };
}
