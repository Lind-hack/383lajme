import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lmsrPriceYes } from "@/lib/tregu";
import { getArticles } from "@/lib/db";
import { parseEvent, slugKey } from "@/lib/tregu-groups";

export const dynamic = "force-dynamic";

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
        .select("id, action, side, coins, shares, price_yes, created_at")
        .eq("market_id", market.id)
        .order("created_at", { ascending: true })
        .limit(500),
      // Most recent trades with trader display names — the activity feed.
      supabase
        .from("market_trades")
        .select("id, action, side, coins, shares, price_yes, created_at, profiles(display_name)")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("markets")
        .select("slug, question, category, q_yes, q_no, b, closes_at")
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
        .select("id, body, created_at, user_id, profiles(display_name)")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const articleBySlug = new Map((await getArticles(500)).map((article) => [article.slug, article]));
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
        imageUrl: item.imageUrl || article?.imageUrl,
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
    profiles: { display_name: string | null } | null;
  }[]).map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    userId: c.user_id,
    name: c.profiles?.display_name ?? "Anonim",
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
      .select("id, slug, question, q_yes, q_no, b, status")
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
      const nowT = Date.now();
      event = {
        title: parsed.title,
        outcomes: siblings.map((s) => {
          const prob = lmsrPriceYes(s.q_yes, s.q_no, s.b);
          const series = (sibSnaps ?? [])
            .filter((r) => r.market_id === s.id)
            .map((r) => ({ t: new Date(r.created_at).getTime(), p: Number(r.market_prob) }));
          series.push({ t: nowT, p: prob });
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
  }));

  return NextResponse.json({
    market: { ...market, market_prob: currentProb },
    event,
    snapshots: snapshots ?? [],
    trades: trades ?? [],
    activity: activity ?? [],
    related: relatedWithProb,
    weeklyDelta,
    tradeCount: tradeCount ?? 0,
    tradersApprox: traders.size,
    position,
    holders,
    comments,
  });
}
