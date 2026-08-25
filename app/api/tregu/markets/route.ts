import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";
import { lmsrSportOutcomePrices } from "@/lib/tregu-client";
import { resolveMarketMedia } from "@/lib/tregu-market-media.mjs";
import { publicProfileName } from "@/lib/profile-hub.mjs";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SPARK_POINTS = 28;

interface TapeRow {
  market_id: string;
  price_yes: number;
  coins?: number | null;
  outcome_prices?: Record<string, number> | null;
  created_at: string;
}

interface SnapRow {
  market_id: string;
  market_prob: number;
  created_at: string;
}

interface SportOracleRow {
  market_id: string;
  reference_probabilities: Record<string, number> | null;
  created_at: string;
}

interface ArticleMediaRow {
  slug: string;
  title?: string | null;
  image_url?: string | null;
  category?: string | null;
  source?: string | null;
  url?: string | null;
}

export async function GET(request: NextRequest) {
  const generatedAt = new Date();
  const supabase = await createClient();
  const category = request.nextUrl.searchParams.get("category");
  const status = request.nextUrl.searchParams.get("status") ?? "open";

  let query = supabase
    .from("markets")
    .select("*")
    .order("closes_at", { ascending: true });

  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["open", "closed", "resolved"]);
  }
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const ids = rows.map((m) => m.id);
  const sourceSlugs = [...new Set(
    rows.flatMap((market) =>
      Array.isArray(market.source_article_slugs)
        ? market.source_article_slugs.map(String).filter(Boolean)
        : []
    )
  )];

  // One tape query for every listed market (sparklines + weekly deltas), the
  // 5-minute cron snapshots (books move between trades, and most books have
  // few or no trades — without snapshots every sparkline collapses to a dot),
  // and one short public feed — the hub's proof the floor is alive.
  const [tapeRes, snapRes, sportOracleRes, feedRes, articleRes] = await Promise.all([
    ids.length
      ? supabase
          .from("market_trades")
          .select("market_id, price_yes, coins, outcome_prices, created_at")
          .in("market_id", ids)
          // Keep the freshest global window under the cap, then restore
          // chronological order below. An ascending capped query silently
          // discarded the newest movements once the floor grew past 4k rows.
          .order("created_at", { ascending: false })
          .limit(6000)
      : Promise.resolve({ data: [] as TapeRow[], error: null }),
    ids.length
      ? supabase
          .from("market_snapshots")
          .select("market_id, market_prob, created_at")
          .in("market_id", ids)
          .order("created_at", { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [] as SnapRow[], error: null }),
    ids.length
      ? supabase
          .from("sport_oracle_events")
          .select("market_id, reference_probabilities, created_at")
          .in("market_id", ids)
          .order("created_at", { ascending: false })
          .limit(4000)
      : Promise.resolve({ data: [] as SportOracleRow[], error: null }),
    supabase
      .from("market_trades")
      .select("action, side, coins, price_yes, created_at, profiles(display_name, is_anonymous), markets(question, slug)")
      .order("created_at", { ascending: false })
      .limit(10),
    sourceSlugs.length
      ? supabase
          .from("news_articles")
          .select("slug, title, image_url, category, source, url")
          .in("slug", sourceSlugs)
      : Promise.resolve({ data: [] as ArticleMediaRow[], error: null }),
  ]);

  // Media is supplementary. A news-table failure must never block prices;
  // the resolver supplies an owned category fallback for editorial markets.
  const articleMedia = articleRes.error
    ? []
    : ((articleRes.data ?? []) as ArticleMediaRow[]);

  const byMarket = new Map<string, TapeRow[]>();
  for (const t of ([...((tapeRes.data ?? []) as TapeRow[])].reverse())) {
    const arr = byMarket.get(t.market_id);
    if (arr) arr.push(t);
    else byMarket.set(t.market_id, [t]);
  }

  // Fetched newest-first to keep the freshest window under the row cap;
  // reversed here so each market's snapshot tape reads oldest-first.
  const bySnap = new Map<string, SnapRow[]>();
  for (const s of ((snapRes.data ?? []) as SnapRow[]).reverse()) {
    const arr = bySnap.get(s.market_id);
    if (arr) arr.push(s);
    else bySnap.set(s.market_id, [s]);
  }

  const bySportOracle = new Map<string, SportOracleRow[]>();
  for (const row of ([...((sportOracleRes.data ?? []) as SportOracleRow[])].reverse())) {
    const arr = bySportOracle.get(row.market_id);
    if (arr) arr.push(row);
    else bySportOracle.set(row.market_id, [row]);
  }

  const weekAgo = Date.now() - WEEK_MS;

  const markets = rows.map((m) => {
    const prob = lmsrPriceYes(m.q_yes, m.q_no, m.b);
    const tape = byMarket.get(m.id) ?? [];

    // Trades and cron snapshots record the same book price; interleaved by
    // time they form the fullest tape either source can offer.
    const merged = [
      ...tape.map((t) => ({ t: new Date(t.created_at).getTime(), p: t.price_yes })),
      ...(bySnap.get(m.id) ?? []).map((s) => ({ t: new Date(s.created_at).getTime(), p: Number(s.market_prob) })),
      // The persisted book state is a real point. Use its own update time,
      // never request time, so polling cannot manufacture a moving tail.
      { t: new Date(m.updated_at ?? m.created_at).getTime(), p: prob },
    ]
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
      .sort((a, b) => a.t - b.t);
    const exactMerged = [...new Map(merged.map((point) => [point.t, point])).values()];

    // Weekly delta: current prob vs the last known price at/before 7 days ago
    // (or the earliest point if the market is younger than a week).
    let delta7d: number | null = null;
    if (exactMerged.length > 0) {
      let anchor = exactMerged[0].p;
      for (const pt of exactMerged) {
        if (pt.t <= weekAgo) anchor = pt.p;
        else break;
      }
      delta7d = prob - anchor;
    }

    // Downsample the tape to a fixed-width sparkline, ending at the latest
    // persisted market state rather than manufacturing a request-time point.
    const prices = exactMerged.map((pt) => pt.p);
    let spark: number[];
    if (prices.length <= SPARK_POINTS) {
      spark = prices;
    } else {
      spark = [];
      for (let i = 0; i < SPARK_POINTS; i++) {
        spark.push(prices[Math.round((i * (prices.length - 1)) / (SPARK_POINTS - 1))]);
      }
    }

    const history = exactMerged.map((point) => ({
      created_at: new Date(point.t).toISOString(),
      probability: point.p,
    }));
    const sportOutcomes = Array.isArray(m.sport_outcomes) ? m.sport_outcomes : [];
    const hasCompactOutcomeBook =
      (m.market_type === "two_outcome" || m.market_type === "three_outcome") &&
      sportOutcomes.length >= 2 &&
      sportOutcomes.length <= 3 &&
      m.outcome_quantities &&
      typeof m.outcome_quantities === "object";
    const outcomeProbabilities = hasCompactOutcomeBook
      ? lmsrSportOutcomePrices({
          sport_outcomes: sportOutcomes,
          outcome_quantities: m.outcome_quantities,
          b: Number(m.b),
        })
      : null;
    const outcomeHistory = hasCompactOutcomeBook && outcomeProbabilities
      ? Object.fromEntries(
          sportOutcomes.map((outcome: { key?: string }, index: number) => {
            const key = String(outcome.key ?? `outcome-${index + 1}`);
            const points = [
              ...tape.flatMap((trade) => {
                const p = Number(trade.outcome_prices?.[key]);
                return Number.isFinite(p)
                  ? [{ t: new Date(trade.created_at).getTime(), p }]
                  : [];
              }),
              ...(bySportOracle.get(m.id) ?? []).flatMap((event) => {
                const p = Number(event.reference_probabilities?.[key]);
                return Number.isFinite(p)
                  ? [{ t: new Date(event.created_at).getTime(), p }]
                  : [];
              }),
              {
                t: new Date(m.updated_at ?? m.created_at).getTime(),
                p: Number(outcomeProbabilities[key] ?? 1 / sportOutcomes.length),
              },
            ]
              .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
              .sort((a, b) => a.t - b.t);
            const deduped = [...new Map(points.map((point) => [point.t, point])).values()];
            return [
              key,
              deduped.map((point) => ({
                created_at: new Date(point.t).toISOString(),
                probability: point.p,
              })),
            ];
          })
        )
      : null;

    const sourceTimes = [
      new Date(m.updated_at ?? m.created_at).getTime(),
      ...tape.map((row) => new Date(row.created_at).getTime()),
      ...(bySnap.get(m.id) ?? []).map((row) => new Date(row.created_at).getTime()),
      ...(bySportOracle.get(m.id) ?? []).map((row) => new Date(row.created_at).getTime()),
    ].filter(Number.isFinite);

    return {
      ...m,
      market_prob: prob,
      spark,
      delta7d: hasCompactOutcomeBook ? null : delta7d,
      trade_count: tape.length,
      trade_volume: tape.reduce((sum, row) => sum + Math.max(0, Number(row.coins ?? 0)), 0),
      last_data_at: sourceTimes.length
        ? new Date(Math.max(...sourceTimes)).toISOString()
        : m.updated_at ?? m.created_at,
      history,
      outcome_probabilities: outcomeProbabilities,
      outcome_history: outcomeHistory,
      market_media: resolveMarketMedia(m, articleMedia),
    };
  });

  const activity = ((feedRes.data ?? []) as unknown as {
    action: string;
    side: string;
    coins: number;
    price_yes: number;
    created_at: string;
    profiles: { display_name: string | null; is_anonymous: boolean | null } | null;
    markets: { question: string; slug: string } | null;
  }[]).map((t) => ({
    name: publicProfileName(t.profiles),
    action: t.action,
    side: t.side,
    coins: Number(t.coins),
    priceYes: Number(t.price_yes),
    createdAt: t.created_at,
    question: t.markets?.question ?? "",
    slug: t.markets?.slug ?? "",
  }));

  return NextResponse.json(
    { markets, activity, generated_at: generatedAt.toISOString() },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
