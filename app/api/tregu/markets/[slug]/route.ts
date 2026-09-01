import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";
import { lmsrSportOutcomePrices } from "@/lib/tregu-client";
import { getArticlesBySlugs } from "@/lib/db";
import { parseEvent, slugKey } from "@/lib/tregu-groups";
import { fetchF1LiveLiteLeaderboard } from "@/lib/f1-live-lite";
import { resolveMarketMedia } from "@/lib/tregu-market-media.mjs";
import { outcomeColor } from "@/lib/tregu-hub-market.mjs";
import { publicProfileName } from "@/lib/profile-hub.mjs";

export const dynamic = "force-dynamic";

interface ArticleMediaRow {
  slug: string;
  title?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  source?: string | null;
  url?: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: market, error } = await supabase
    .from("markets")
    .select("*")
    .eq("slug", slug)
    .in("status", ["open", "closed", "resolved"])
    .single();

  if (error || !market) {
    return NextResponse.json({ error: "Tregu nuk u gjet" }, { status: 404 });
  }

  const [{ data: snapshots }, { data: trades }, { data: activity }, { data: related }, holdersRes, commentsRes] =
    await Promise.all([
      supabase
        .from("market_snapshots")
        .select("*")
        .eq("market_id", market.id)
        .order("created_at", { ascending: true })
        .limit(200),
      // Full trade tape (ascending) — the chart's price history.
      supabase
        .from("market_trades")
        // `*` is backward-compatible while migration 0039 adds the optional
        // multi-outcome price vector used by football charts.
        .select("*")
        .eq("market_id", market.id)
        .order("created_at", { ascending: true })
        .limit(500),
      // Most recent trades with trader display names — the activity feed.
      supabase
        .from("market_trades")
        .select("id, action, side, coins, shares, price_yes, created_at, profiles(display_name, is_anonymous)")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("markets")
        .select("slug, question, category, q_yes, q_no, b, closes_at, sport_outcomes")
        .eq("category", market.category)
        .eq("status", "open")
        .neq("id", market.id)
        .order("updated_at", { ascending: false })
        .limit(3),
      // Public holder board — SECURITY DEFINER RPC (0004) past the owner-only
      // positions RLS. Returns [] gracefully if the migration hasn't run yet.
      supabase.rpc("market_top_holders", { p_market_id: market.id, p_limit: 30 }),
      supabase
        .from("market_comments")
        .select("id, body, created_at, user_id, profiles(display_name, is_anonymous)")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const evidenceSlugs = (snapshots ?? []).flatMap((snapshot) =>
    (Array.isArray(snapshot.evidence) ? snapshot.evidence : [])
      .map((item: unknown) => String((item as { slug?: string } | null)?.slug ?? ""))
      .filter(Boolean)
  );
  const wantedArticleSlugs = [...new Set([
    ...(Array.isArray(market.source_article_slugs) ? market.source_article_slugs.map(String) : []),
    ...evidenceSlugs,
  ])];
  const exactArticlesRes = wantedArticleSlugs.length
    ? await supabase
        .from("news_articles")
        .select("slug, title, image_url, category, source, url")
        .in("slug", wantedArticleSlugs)
    : { data: [] as ArticleMediaRow[], error: null };
  const exactArticles = exactArticlesRes.error
    ? []
    : ((exactArticlesRes.data ?? []) as ArticleMediaRow[]);
  const exactSlugs = new Set(exactArticles.map((article) => article.slug));
  const missingSlugs = wantedArticleSlugs.filter((articleSlug) => !exactSlugs.has(articleSlug));
  const fallbackArticles = missingSlugs.length
    ? await getArticlesBySlugs(missingSlugs)
    : [];
  const articleCandidates: ArticleMediaRow[] = [...exactArticles, ...fallbackArticles];
  const articleBySlug = new Map(articleCandidates.map((article) => [article.slug, article]));
  const snapshotsWithEvidence = (snapshots ?? []).map((snapshot) => {
    const rawEvidence: unknown[] = Array.isArray(snapshot.evidence) ? snapshot.evidence : [];
    const evidence = rawEvidence.map((raw) => {
      const item = (raw ?? {}) as { slug?: string; title?: string; source?: string; url?: string; imageUrl?: string };
      const article = item.slug ? articleBySlug.get(item.slug) : undefined;
      return {
        ...item,
        title: item.title || article?.title || "Lajm i verifikuar që ndikoi në treg",
        source: item.source || article?.source || "Burim i verifikuar",
        url: item.url || article?.url,
        imageUrl: item.imageUrl || article?.imageUrl || article?.image_url || undefined,
      };
    });
    return { ...snapshot, evidence };
  });

  const holders = ((holdersRes.data ?? []) as {
    display_name: string;
    side: string;
    shares: number;
    coins_staked: number;
  }[]).map((h) => ({
    name: h.display_name || "Anonim",
    side: h.side,
    shares: Number(h.shares),
    coinsStaked: Number(h.coins_staked),
  }));

  const comments = ((commentsRes.data ?? []) as unknown as {
    id: string;
    body: string;
    created_at: string;
    user_id: string;
    profiles: { display_name: string | null; is_anonymous: boolean | null } | null;
  }[]).map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    name: publicProfileName(c.profiles, "Anonim"),
  }));

  let position = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: positions } = await supabase
      .from("positions")
      .select("*")
      .eq("market_id", market.id)
      .eq("user_id", user.id);
    position = positions ?? [];
  }

  const currentProb = lmsrPriceYes(market.q_yes, market.q_no, market.b);

  // Weekly delta: current price vs the last known price from >= 7 days ago
  // (trade tape first, snapshots as fallback for pre-0003 markets).
  const weekAgo = Date.now() - 7 * 86_400_000;
  const history = [
    ...(snapshots ?? []).map((s) => ({ t: new Date(s.created_at).getTime(), p: s.market_prob })),
    ...(trades ?? []).map((t) => ({ t: new Date(t.created_at).getTime(), p: t.price_yes })),
  ].sort((a, b) => a.t - b.t);
  const before = history.filter((h) => h.t <= weekAgo);
  const baseline = before.length > 0 ? before[before.length - 1].p : history[0]?.p ?? null;
  const weeklyDelta = baseline === null ? null : currentProb - baseline;

  const traders = new Set(
    (activity ?? []).map((t) => JSON.stringify(t.profiles)).filter(Boolean)
  );
  // Distinct traders across the full tape needs user ids; the public feed only
  // carries display names, so count distinct via a dedicated head query.
  const { count: tradeCount } = await supabase
    .from("market_trades")
    .select("id", { count: "exact", head: true })
    .eq("market_id", market.id);

  // Multi-outcome event: sibling books share the "<Event>: <Outcome>?" title.
  // Ship every sibling's timestamped snapshot series so the event chart can
  // draw real 5-minute cron points instead of index-based sparklines.
  let event: {
    title: string;
    outcomes: { slug: string; question: string; prob: number; series: { t: number; p: number }[] }[];
  } | null = null;
  const parsed = parseEvent(market.question);
  if (parsed) {
    const { data: candidates } = await supabase
      .from("markets")
      .select("id, slug, question, q_yes, q_no, b, status, created_at, updated_at")
      .in("status", ["open", "closed"])
      .limit(60);
    const key = slugKey(parsed.title);
    const siblings = (candidates ?? []).filter((m) => {
      const p = parseEvent(m.question);
      return p !== null && slugKey(p.title) === key;
    });
    if (siblings.length >= 2) {
      const ids = siblings.map((s) => s.id);
      const { data: sibSnaps } = await supabase
        .from("market_snapshots")
        .select("market_id, market_prob, created_at")
        .in("market_id", ids)
        .order("created_at", { ascending: true })
        .limit(1000);
      event = {
        title: parsed.title,
        outcomes: siblings.map((s) => {
          const prob = lmsrPriceYes(s.q_yes, s.q_no, s.b);
          const series = (sibSnaps ?? [])
            .filter((r) => r.market_id === s.id)
            .map((r) => ({ t: new Date(r.created_at).getTime(), p: Number(r.market_prob) }));
          const persistedAt = new Date(s.updated_at ?? s.created_at).getTime();
          if (Number.isFinite(persistedAt)) series.push({ t: persistedAt, p: prob });
          return { slug: s.slug, question: s.question, prob, series };
        }),
      };
    }
  }

  const currentEventTitle = parseEvent(market.question)?.title;
  // Outcome siblings are represented by the one grouped event card; do not
  // repeat them as separate "related" trades on an outcome detail page.
  const relatedWithProb = (related ?? [])
    .filter((m) => parseEvent(m.question)?.title !== currentEventTitle)
    .map((m) => ({
    slug: m.slug,
    question: m.question,
    category: m.category,
    prob: lmsrPriceYes(m.q_yes, m.q_no, m.b),
    volume: m.q_yes + m.q_no,
    closesAt: m.closes_at,
    sportOutcomes: Array.isArray(m.sport_outcomes) ? m.sport_outcomes : null,
  }));

  let football = null;
  if (
    market.market_classification === "live_football" &&
    (market.market_type === "two_outcome" || market.market_type === "three_outcome") &&
    Array.isArray(market.sport_outcomes) &&
    market.sport_outcomes.length >= 2 &&
    market.sport_outcomes.length <= 3 &&
    market.outcome_quantities &&
    typeof market.outcome_quantities === "object"
  ) {
    const prices = lmsrSportOutcomePrices({
      sport_outcomes: market.sport_outcomes,
      outcome_quantities: market.outcome_quantities,
      b: Number(market.b),
    });
    const { data: oracleEvents } = await supabase
      .from("sport_oracle_events")
      .select("reference_probabilities, official_state, created_at")
      .eq("market_id", market.id)
      .order("created_at", { ascending: true })
      .limit(500);
    const nowT = new Date(market.updated_at ?? market.created_at).getTime();
    const palette = ["#C92F2F", "#7A7A78", "#2E70C9"];
    const storedFormat =
      market.live_event?.football_format &&
      typeof market.live_event.football_format === "object"
        ? market.live_event.football_format
        : null;
    const format = {
      competitionKind: String(storedFormat?.competitionKind ?? "league"),
      stageKind: String(storedFormat?.stageKind ?? "league"),
      stageLabel: String(storedFormat?.stageLabel ?? market.live_event?.stage ?? "Ndeshje"),
      leg: Number(storedFormat?.leg ?? market.live_event?.leg) || null,
      marketIntent: String(
        storedFormat?.marketIntent ??
          (market.sport_outcomes.length === 2 ? "to_qualify" : "match_result")
      ),
      outcomeMode: market.sport_outcomes.length === 2 ? "two_way" : "three_way",
      drawAllowed: market.sport_outcomes.some(
        (outcome: { key?: string }) => String(outcome.key).toLowerCase() === "draw"
      ),
      decisive: Boolean(
        storedFormat?.decisive ?? market.sport_outcomes.length === 2
      ),
      resolutionBasis: String(
        storedFormat?.resolutionBasis ??
          (market.sport_outcomes.length === 2
            ? "aggregate_then_extra_time_then_penalties"
            : "regulation_time_90_minutes")
      ),
    };
    football = {
      outcomes: market.sport_outcomes.map(
        (
          outcome: {
            key?: string;
            label?: string;
            team?: string;
            color?: string;
            team_color?: string;
            team_colour?: string;
            logo?: string;
          },
          index: number
        ) => {
          const key = String(outcome.key ?? `outcome-${index + 1}`);
          const isDraw = key.toLowerCase() === "draw" || /baraz|draw/i.test(String(outcome.label ?? ""));
          const teamName = String(outcome.team ?? outcome.label ?? "");
          const knownTeamColor = /argentin/i.test(teamName)
            ? "#2E70C9"
            : /spanj|spain/i.test(teamName)
              ? "#C92F2F"
              : /angl|england/i.test(teamName)
                ? "#C8102E"
                : key.toLowerCase() === "away"
                  ? "#2E70C9"
                  : key.toLowerCase() === "home"
                    ? "#C92F2F"
                    : palette[index % palette.length];
          const series = [
            ...(trades ?? []).flatMap((row) => {
              const values = row.outcome_prices as Record<string, unknown> | null;
              const probability = Number(values?.[key]);
              return Number.isFinite(probability)
                ? [{ t: new Date(row.created_at).getTime(), p: probability }]
                : [];
            }),
            ...(oracleEvents ?? []).flatMap((row) => {
              const values = row.reference_probabilities as Record<string, unknown> | null;
              const probability = Number(values?.[key]);
              return Number.isFinite(probability)
                ? [{ t: new Date(row.created_at).getTime(), p: probability }]
                : [];
            }),
          ]
            .filter((point) => Number.isFinite(point.t))
            .sort((a, b) => a.t - b.t);
          series.push({ t: nowT, p: Number(prices[key] ?? 1 / market.sport_outcomes.length) });
          return {
            key,
            label: String(outcome.label ?? outcome.team ?? key),
            team: outcome.team ? String(outcome.team) : undefined,
            logo: outcome.logo ? String(outcome.logo) : undefined,
            color: outcomeColor({
              ...outcome,
              key,
              label: String(outcome.label ?? outcome.team ?? key),
              color: isDraw
                ? "#7A7A78"
                : outcome.color ?? outcome.team_color ?? outcome.team_colour ?? knownTeamColor,
            }, index),
            probability: Number(prices[key] ?? 1 / market.sport_outcomes.length),
            series,
          };
        }
      ),
      format,
      liveState: market.live_score_state ?? oracleEvents?.at(-1)?.official_state ?? null,
      refreshMs: 1_000,
    };
  }

  let f1 = null;
  if (market.market_type === "f1_race_winner" && Array.isArray(market.sport_outcomes)) {
    const isChampionship = market.live_event?.event_kind === "championship";
    let board = market.live_score_state ?? null;
    const isArchived = market.status === "closed" || market.status === "resolved";
    if (!isArchived && !isChampionship) {
      try { board = await fetchF1LiveLiteLeaderboard(); } catch { /* cached audited timing remains the fallback */ }
    }
    if (isArchived && !board) {
      board = { race: { status: "ARCHIVED" }, rows: [] };
    }
    // Prefer a stored official slot, then a verified pre-race board. Older
    // archives did not persist either, so retain their original 22-driver
    // ordering as a deterministic historical grid instead of rendering empty.
    const positions = board?.race?.status === "INACTIVE"
      ? new Map((board.rows ?? []).map((row: { driver_code?: string; position?: number }) => [row.driver_code, row.position]))
      : new Map<string | undefined, number | undefined>();
    const snapshotHistory = (snapshots ?? []).flatMap((snapshot: { created_at?: string; oracle_kind?: string; evidence?: unknown[] }) => {
      const evidence = Array.isArray(snapshot.evidence) ? snapshot.evidence[0] as { probabilities?: unknown; timing?: { race?: { current_lap?: number; status?: string } } } : null;
      return snapshot.oracle_kind === "f1_vector" && evidence && typeof evidence.probabilities === "object" && evidence.probabilities !== null ? [{ createdAt: snapshot.created_at ?? "", probabilities: evidence.probabilities as Record<string, number>, lap: evidence.timing?.race?.current_lap, status: evidence.timing?.race?.status }] : [];
    });
    const tradeHistory = (trades ?? []).flatMap((trade: { created_at?: string; outcome_prices?: unknown }) =>
      trade.outcome_prices && typeof trade.outcome_prices === "object"
        ? [{ createdAt: trade.created_at ?? "", probabilities: trade.outcome_prices as Record<string, number>, status: "TRADE" }]
        : []
    );
    const openingProbabilities = market.reference_probabilities && typeof market.reference_probabilities === "object"
      ? [{ createdAt: market.created_at, probabilities: market.reference_probabilities as Record<string, number>, status: "OPEN" }]
      : [];
    const latest = lmsrSportOutcomePrices({
      sport_outcomes: market.sport_outcomes,
      outcome_quantities: market.outcome_quantities,
      b: Number(market.b),
    });
    const history = [
      ...openingProbabilities,
      ...snapshotHistory,
      ...tradeHistory,
      { createdAt: market.updated_at ?? market.created_at, probabilities: latest, status: "CURRENT" },
    ].filter((point) => Number.isFinite(Date.parse(point.createdAt))).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    f1 = {
      outcomes: market.sport_outcomes.map(
        (
          row: {
            key?: string;
            label?: string;
            team?: string;
            team_colour?: string;
            team_color?: string;
            headshot_url?: string;
            grid_position?: number;
            championship_position?: number;
            championship_points?: number;
            latest_race_position?: number | null;
            latest_race_points?: number;
            weekend_points?: number;
            gap_to_leader?: number;
            gap_change?: number;
            position_change?: number;
          },
          index: number
        ) => {
          const storedPosition = Number(row.grid_position);
          const boardPosition = Number(positions.get(row.key));
          const gridPosition = Number.isInteger(storedPosition) && storedPosition > 0
            ? storedPosition
            : Number.isInteger(boardPosition) && boardPosition > 0
              ? boardPosition
              : index + 1;
          return {
            key: row.key,
            label: row.label,
            team: row.team,
            team_colour: row.team_colour ?? row.team_color,
            headshot_url: row.headshot_url,
            grid_position: gridPosition,
            probability: Number(latest[row.key ?? ""] ?? 0),
            championship_position: row.championship_position,
            championship_points: row.championship_points,
            latest_race_position: row.latest_race_position,
            latest_race_points: row.latest_race_points,
            weekend_points: row.weekend_points,
            gap_to_leader: row.gap_to_leader,
            gap_change: row.gap_change,
            position_change: row.position_change,
          };
        }
      ),
      timing: isChampionship ? null : board,
      history,
      championship: isChampionship ? {
        season: market.live_event?.season,
        ...(market.live_score_state?.championship ?? {}),
      } : null,
    };
  }
  return NextResponse.json({
    market: {
      ...market,
      description: typeof market.description === "string" ? market.description.replace(/OpenF1/gi, "të dhëna zyrtare F1") : market.description,
      market_prob: currentProb,
      market_media: resolveMarketMedia(market, articleCandidates),
    }, f1,
    event, football,
    snapshots: snapshotsWithEvidence,
    trades: trades ?? [],
    activity: ((activity ?? []) as unknown as {
      profiles: { display_name: string | null; is_anonymous: boolean | null } | null;
      [key: string]: unknown;
    }[]).map((trade) => ({
      ...trade,
      profiles: { display_name: publicProfileName(trade.profiles) },
    })),
    related: relatedWithProb,
    weeklyDelta,
    tradeCount: tradeCount ?? 0,
    tradersApprox: traders.size,
    position,
    holders,
    comments,
  });
}
