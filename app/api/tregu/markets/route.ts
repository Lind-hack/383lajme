import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";
import { lmsrSportOutcomePrices } from "@/lib/tregu-client";
import { resolveMarketMedia } from "@/lib/tregu-market-media.mjs";
import { publicProfileName } from "@/lib/profile-hub.mjs";
import { marketNewsTaxonomy, matchesNewsFilter } from "@/lib/tregu-news-taxonomy.mjs";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Supabase's REST layer returns at most this many rows per response, whatever .limit() asks for. */
const REST_PAGE = 1000;

/**
 * Newest-first rows up to `cap`, fetched in REST-sized pages.
 *
 * A single `.limit(4000)` came back with 1,000 rows: the REST layer truncates
 * every response to its own maximum, so the history caps below were never
 * really in force.
 */
async function newestRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  cap: number
): Promise<{ data: T[]; error: unknown }> {
  // Every page at once: one database round trip instead of one per 1000 rows.
  // Asked one after another, the tape's six pages alone held the floor (and
  // every card waiting on it) for well over a second.
  const ranges: [number, number][] = [];
  for (let from = 0; from < cap; from += REST_PAGE) ranges.push([from, Math.min(cap, from + REST_PAGE) - 1]);
  const pages = await Promise.all(ranges.map(([from, to]) => page(from, to)));
  const rows: T[] = [];
  for (let i = 0; i < pages.length; i++) {
    const { data, error } = pages[i];
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    const [from, to] = ranges[i];
    if (!data || data.length < to - from + 1) break;
  }
  return { data: rows, error: null };
}
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
  oracle_kind?: string | null;
  evidence?: unknown;
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

/**
 * Article photos for editorial markets, kept per server instance. They change
 * rarely, and asking for them needs the market rows first: a second database
 * round trip on every floor load just to learn nothing changed. A miss (or a
 * slug with no article) is re-asked after ten minutes.
 */
const ARTICLE_TTL_MS = 10 * 60_000;
const articleCache = new Map<string, { row: ArticleMediaRow | null; at: number }>();

async function articleMediaFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slugs: string[]
): Promise<ArticleMediaRow[]> {
  const now = Date.now();
  const missing = slugs.filter((slug) => {
    const hit = articleCache.get(slug);
    return !hit || now - hit.at > ARTICLE_TTL_MS;
  });
  if (missing.length) {
    const { data, error } = await supabase
      .from("news_articles")
      .select("slug, title, image_url, category, source, url")
      .in("slug", missing);
    // Media is supplementary. A news-table failure must never block prices;
    // the resolver supplies an owned category fallback for editorial markets.
    if (!error) {
      const found = new Map(((data ?? []) as ArticleMediaRow[]).map((row) => [row.slug, row]));
      for (const slug of missing) articleCache.set(slug, { row: found.get(slug) ?? null, at: now });
    }
  }
  return slugs.flatMap((slug) => {
    const row = articleCache.get(slug)?.row;
    return row ? [row] : [];
  });
}

export async function GET(request: NextRequest) {
  const generatedAt = new Date();
  // Server-Timing: where a slow floor load spends its time, readable in the
  // browser's network panel or with curl -I.
  const started = performance.now();
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

  // History is fetched for the books a chart can show. The trading floor used
  // to ask for status=all and keep only open books, but the three history
  // queries below are one newest-first window shared by every listed market —
  // and 366 settled markets, their live games alone worth thousands of oracle
  // rows, filled that window. On 2026-09-27 all 30 open sport books reached the
  // floor with one point each, so every card drew flat lines. A settled market
  // still comes back, just without history, unless settled markets are what
  // the caller asked for.
  const historyStatuses = status === "all" ? ["open", "closed"] : [status];

  // One tape query for every listed market (sparklines + weekly deltas), the
  // 5-minute cron snapshots (books move between trades, and most books have
  // few or no trades — without snapshots every sparkline collapses to a dot).
  //
  // Without a category the listed markets are exactly the markets in
  // `historyStatuses`, so the database filters through the market join and the
  // history runs alongside the market query: one round trip, not two. A
  // category is decided here in code, so that request filters by the ids of
  // the markets it kept, after they arrive. (The inner join is always there:
  // every history row belongs to a market, so with ids it filters nothing.)
  const loadHistory = (ids: string[] | null) => {
    const [column, values] = ids ? ["market_id", ids] : ["markets.status", historyStatuses];
    if (ids && !ids.length) {
      return Promise.resolve([
        { data: [] as TapeRow[], error: null },
        { data: [] as SnapRow[], error: null },
        { data: [] as SportOracleRow[], error: null },
      ] as const);
    }
    return Promise.all([
      newestRows<TapeRow>((from, to) => supabase
          .from("market_trades")
          .select("market_id, price_yes, coins, outcome_prices, created_at, markets!inner(status)")
          .in(column, values)
          // Keep the freshest global window under the cap, then restore
          // chronological order below. An ascending capped query silently
          // discarded the newest movements once the floor grew past 4k rows.
          .order("created_at", { ascending: false })
          .range(from, to), 6000),
      newestRows<SnapRow>((from, to) => supabase
          .from("market_snapshots")
          .select("market_id, market_prob, oracle_kind, evidence, created_at, markets!inner(status)")
          .in(column, values)
          .order("created_at", { ascending: false })
          .range(from, to), 2000),
      newestRows<SportOracleRow>((from, to) => supabase
          .from("sport_oracle_events")
          .select("market_id, reference_probabilities, created_at, markets!inner(status)")
          .in(column, values)
          .order("created_at", { ascending: false })
          .range(from, to), 4000),
    ] as const);
  };

  // The hub's proof the floor is alive: one short public feed of the latest trades.
  const feedPromise = supabase
    .from("market_trades")
    .select("action, side, coins, price_yes, created_at, profiles(display_name, is_anonymous), markets(question, slug, sport_outcomes)")
    .order("created_at", { ascending: false })
    .limit(10);
  const earlyHistory = category ? null : loadHistory(null);
  // Settled before the early return below, so an error there leaves no
  // rejected promise behind.
  earlyHistory?.catch(() => {});

  const { data, error } = await query;
  const marketsMs = performance.now() - started;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).filter((market) => matchesNewsFilter(market, category));
  const sourceSlugs = [...new Set(
    rows.flatMap((market) =>
      Array.isArray(market.source_article_slugs)
        ? market.source_article_slugs.map(String).filter(Boolean)
        : []
    )
  )];

  const [[tapeRes, snapRes, sportOracleRes], feedRes, articleMedia] = await Promise.all([
    earlyHistory ?? loadHistory(rows.filter((m) => status !== "all" || m.status !== "resolved").map((m) => m.id)),
    feedPromise,
    articleMediaFor(supabase, sourceSlugs),
  ]);
  const dbMs = performance.now() - started;

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
    const hasF1OutcomeBook =
      m.market_type === "f1_race_winner" &&
      sportOutcomes.length >= 20 &&
      sportOutcomes.length <= 22 &&
      m.outcome_quantities &&
      typeof m.outcome_quantities === "object";
    const hasOutcomeBook = hasCompactOutcomeBook || hasF1OutcomeBook;
    const outcomeProbabilities = hasOutcomeBook
      ? lmsrSportOutcomePrices({
          sport_outcomes: sportOutcomes,
          outcome_quantities: m.outcome_quantities,
          b: Number(m.b),
        })
      : null;
    const outcomeHistory = hasOutcomeBook && outcomeProbabilities
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
              ...(bySnap.get(m.id) ?? []).flatMap((snapshot) => {
                if (snapshot.oracle_kind !== "f1_vector") return [];
                const evidence = Array.isArray(snapshot.evidence) ? snapshot.evidence[0] : snapshot.evidence;
                const p = Number((evidence as { probabilities?: Record<string, number> } | null)?.probabilities?.[key]);
                return Number.isFinite(p)
                  ? [{ t: new Date(snapshot.created_at).getTime(), p }]
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
      news_geography: marketNewsTaxonomy(m).geography,
      news_topic: marketNewsTaxonomy(m).topic,
      market_prob: prob,
      spark,
      delta7d: hasOutcomeBook ? null : delta7d,
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
    markets: { question: string; slug: string; sport_outcomes: { key?: string; label?: string }[] | null } | null;
  }[]).map((t) => ({
    name: publicProfileName(t.profiles),
    action: t.action,
    side: t.side,
    // Sport books trade outcome keys ("home", "away", a driver code); the
    // tape shows the outcome's own label instead of the raw key.
    sideLabel: (Array.isArray(t.markets?.sport_outcomes) ? t.markets.sport_outcomes : []).find((o) => o?.key === t.side)?.label ?? null,
    coins: Number(t.coins),
    priceYes: Number(t.price_yes),
    createdAt: t.created_at,
    question: t.markets?.question ?? "",
    slug: t.markets?.slug ?? "",
  }));

  return NextResponse.json(
    { markets, activity, generated_at: generatedAt.toISOString() },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Server-Timing": `markets;dur=${marketsMs.toFixed(0)}, db;dur=${dbMs.toFixed(0)}, total;dur=${(performance.now() - started).toFixed(0)}`,
      },
    }
  );
}
