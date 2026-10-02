import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { DEFAULT_SPORT_LIQUIDITY, rescaleOutcomeQuantities } from "@/lib/tregu-liquidity.mjs";
import { sendPendingNewsMarketEmails } from "@/lib/tregu-creation-email";

export const dynamic = "force-dynamic";

type MarketClassification = "general_news" | "live_football" | "live_basketball" | "live_f1";
const MARKET_CLASSIFICATIONS: readonly MarketClassification[] = ["general_news", "live_football", "live_basketball", "live_f1"];

// PATCH { action: "approve" }              -> draft -> open
// PATCH { action: "close" }                -> open -> closed (betting stops, awaiting resolution)
// PATCH { action: "reopen" }               -> closed/resolved -> open (only while the book has zero trades)
// PATCH { action: "resolve", outcome }     -> resolves + pays out winners via RPC
// PATCH { action: "seed", initialProb }    -> reseed LMSR opening odds (only before the first trade)
// PATCH { question, description, ... }     -> plain field edit (draft markets only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    {
      action?: "approve" | "close" | "resolve" | "seed" | "reopen" | "adjust_odds" | "update_image";
      outcome?: "PO" | "JO";
      initialProb?: number;
      deltaPoints?: number;
      reason?: string;
      sourceUrl?: string;
      marketImageUrl?: string;
      marketImageAlt?: string;
      marketImageSourceUrl?: string;
      market_type?: "binary" | "two_outcome" | "three_outcome" | "f1_race_winner";
      market_classification?: MarketClassification;
      [key: string]: unknown;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Trup i pavlefshëm" }, { status: 400 });

  if (body.action === "update_image") {
    const imageUrl = String(body.marketImageUrl ?? "").trim();
    const sourceUrl = String(body.marketImageSourceUrl ?? "").trim();
    const alt = String(body.marketImageAlt ?? "").trim();
    if (!/^https:\/\/\S+$/i.test(imageUrl) || !/^https:\/\/\S+$/i.test(sourceUrl) || alt.length < 3) {
      return NextResponse.json({ error: "Jep URL HTTPS të pamjes, burimin HTTPS dhe përshkrimin e subjektit." }, { status: 400 });
    }
    const { data, error } = await admin.from("markets")
      .update({ market_image_url: imageUrl, market_image_alt: alt, market_image_source_url: sourceUrl, market_image_credit: null })
      .eq("id", id).eq("market_classification", "general_news").in("status", ["draft", "open"])
      .select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Tregu i lajmit nuk u gjet." }, { status: 404 });
    return NextResponse.json({ market: data });
  }

  if (body.action === "adjust_odds") {
    const points = body.deltaPoints;
    const reason = String(body.reason ?? "").trim();
    const sourceUrl = String(body.sourceUrl ?? "").trim();
    if (typeof points !== "number" || !Number.isFinite(points) || points === 0 || Math.abs(points) > 98 || reason.length < 20 || !/^https:\/\/\S+$/i.test(sourceUrl)) {
      return NextResponse.json({ error: "Jep një ndryshim jo-zero deri në 98 pikë, arsyen dhe një lidhje HTTPS me burimin." }, { status: 400 });
    }
    const { data, error } = await admin.rpc("adjust_admin_news_odds", {
      p_market_id: id, p_delta_points: points, p_reason: reason, p_source_url: sourceUrl,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, adjustment: Array.isArray(data) ? data[0] : data });
  }

  if (body.action === "approve") {
    const { data: draft, error: draftError } = await admin.from("markets").select("category, b, q_yes, q_no, outcome_quantities, market_classification, market_type, live_event, sport_outcomes, market_image_url, market_image_source_url").eq("id", id).eq("status", "draft").maybeSingle();
    if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 });
    if (!draft) return NextResponse.json({ error: "Drafti nuk u gjet" }, { status: 404 });
    if (draft.market_classification === "general_news" && String(draft.category).toLowerCase() !== "sport" && (!/^https:\/\//i.test(String(draft.market_image_url ?? "")) || !/^https:\/\//i.test(String(draft.market_image_source_url ?? "")))) {
      return NextResponse.json({ error: "Shto një fotografi HTTPS me burim para publikimit të tregut të lajmeve." }, { status: 400 });
    }
    const liveEvent = draft.live_event as Record<string, unknown> | null;
    const sportOutcomes = Array.isArray(draft.sport_outcomes)
      ? draft.sport_outcomes as Array<{ key?: unknown }>
      : [];
    const expectedFootballOutcomes = draft.market_type === "two_outcome"
      ? 2
      : draft.market_type === "three_outcome"
        ? 3
        : 0;
    const footballTeamsConfigured =
      Boolean(String(liveEvent?.home_team ?? "").trim()) &&
      Boolean(String(liveEvent?.away_team ?? "").trim());
    const footballFormat = liveEvent?.football_format as Record<string, unknown> | undefined;
    const validFootballFormat =
      footballFormat?.marketIntent === "match_result" ||
      footballFormat?.marketIntent === "to_qualify";
    if (
      draft.market_classification === "live_football" &&
      (
        liveEvent?.provider !== "espn" ||
        !String(liveEvent.event_id ?? "").trim() ||
        !String(liveEvent.league ?? "").trim() ||
        !footballTeamsConfigured ||
        expectedFootballOutcomes === 0 ||
        sportOutcomes.length !== expectedFootballOutcomes ||
        sportOutcomes.some((outcome) => !String(outcome.key ?? "").trim()) ||
        !validFootballFormat ||
        (draft.market_type === "two_outcome" && footballFormat?.marketIntent !== "to_qualify")
      )
    ) {
      return NextResponse.json({ error: "Live Football kërkon provider ESPN, event, dy skuadra, format faze dhe 2 ose 3 rezultate që përputhen me tregun." }, { status: 400 });
    }
    if (draft.market_classification === "live_f1" && draft.market_type === "f1_race_winner" && (liveEvent?.provider !== "formula1_dashboard" || !/^[A-Za-z0-9_-]+$/.test(String(liveEvent.event_id ?? "")) || !Array.isArray((draft as Record<string, unknown>).sport_outcomes) || ((draft as Record<string, unknown>).sport_outcomes as unknown[]).length < 20)) {
      return NextResponse.json({ error: "F1 Race Winner kërkon Formula 1 Dashboard event_id dhe 20–22 pilotë para miratimit." }, { status: 400 });
    }
    if (draft.market_classification === "live_f1" && draft.market_type !== "f1_race_winner" && (draft.market_type !== "binary" || liveEvent?.provider !== "formula1_dashboard" || !/^[A-Za-z0-9_-]+$/.test(String(liveEvent.event_id ?? "")) || !/^[A-Z]{3}$/.test(String(liveEvent.driver_code ?? "").toUpperCase()))) {
      return NextResponse.json({ error: "Live F1 kërkon treg binar dhe Formula 1 Dashboard event_id/race_id me driver_code me 3 shkronja para miratimit." }, { status: 400 });
    }
    const currentLiquidity = Number(draft.b);
    const shouldRaiseLiquidity = String(draft.category).toLowerCase() === "sport" && currentLiquidity < DEFAULT_SPORT_LIQUIDITY;
    const liquidityRatio = shouldRaiseLiquidity ? DEFAULT_SPORT_LIQUIDITY / Math.max(1, currentLiquidity) : 1;
    const liquidityPatch = shouldRaiseLiquidity ? {
      b: DEFAULT_SPORT_LIQUIDITY,
      q_yes: Number(draft.q_yes ?? 0) * liquidityRatio,
      q_no: Number(draft.q_no ?? 0) * liquidityRatio,
      outcome_quantities: draft.outcome_quantities
        ? rescaleOutcomeQuantities(draft.outcome_quantities, currentLiquidity)
        : draft.outcome_quantities,
    } : {};
    const { data, error } = await admin
      .from("markets")
      .update({ ...liquidityPatch, status: "open" })
      .eq("id", id)
      .eq("status", "draft")
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((data.market_classification ?? "general_news") === "general_news" && String(data.category).toLowerCase() !== "sport") {
      try { await sendPendingNewsMarketEmails({ marketId: id, limit: 1 }); }
      catch (emailError) { console.error("Market approval email remains queued:", String(emailError)); }
    }
    return NextResponse.json({ market: data });
  }

  if (body.action === "close") {
    const { data, error } = await admin
      .from("markets")
      .update({ status: "closed" })
      .eq("id", id)
      .eq("status", "open")
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ market: data });
  }

  if (body.action === "reopen") {
    const { data: reopening, error: reopeningError } = await admin.from("markets")
      .select("category, market_classification, market_image_url, market_image_source_url")
      .eq("id", id).in("status", ["closed", "resolved"]).maybeSingle();
    if (reopeningError) return NextResponse.json({ error: reopeningError.message }, { status: 500 });
    if (!reopening) return NextResponse.json({ error: "Tregu nuk u gjet" }, { status: 404 });
    if (reopening.market_classification === "general_news" && String(reopening.category).toLowerCase() !== "sport" && (!/^https:\/\//i.test(String(reopening.market_image_url ?? "")) || !/^https:\/\//i.test(String(reopening.market_image_source_url ?? "")))) {
      return NextResponse.json({ error: "Shto një fotografi HTTPS me burim para rihapjes së tregut." }, { status: 400 });
    }
    // A resolved market with trades has already paid out — reopening it would
    // let winners double-dip, so only untouched books can come back.
    const { count, error: tradeErr } = await admin
      .from("market_trades")
      .select("id", { count: "exact", head: true })
      .eq("market_id", id);
    if (tradeErr) return NextResponse.json({ error: tradeErr.message }, { status: 500 });
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "Tregu ka tregtime — nuk mund të rihapet" }, { status: 409 });
    }
    const { data, error } = await admin
      .from("markets")
      .update({ status: "open" })
      .eq("id", id)
      .in("status", ["closed", "resolved"])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ market: data });
  }

  if (body.action === "seed") {
    if (typeof body.initialProb !== "number" || !Number.isFinite(body.initialProb)) {
      return NextResponse.json({ error: "initialProb duhet të jetë numër" }, { status: 400 });
    }
    // Reseeding after real money has traded would silently reprice open
    // positions, so it's only allowed while the book is untouched.
    const { count, error: tradeErr } = await admin
      .from("market_trades")
      .select("id", { count: "exact", head: true })
      .eq("market_id", id);
    if (tradeErr) return NextResponse.json({ error: tradeErr.message }, { status: 500 });
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "Tregu ka tregtime — nuk mund të rivendosen gjasat" }, { status: 409 });
    }
    const { data: seedMarket, error: seedMarketError } = await admin
      .from("markets")
      .select("category")
      .eq("id", id)
      .maybeSingle();
    if (seedMarketError) return NextResponse.json({ error: seedMarketError.message }, { status: 500 });
    if (!seedMarket) return NextResponse.json({ error: "Tregu nuk u gjet" }, { status: 404 });
    const p = Math.min(0.98, Math.max(0.02, body.initialProb));
    const b = String(seedMarket.category).toLowerCase() === "sport" ? DEFAULT_SPORT_LIQUIDITY : 100;
    const diff = b * Math.log(p / (1 - p));
    const { data, error } = await admin
      .from("markets")
      .update({
        q_yes: Math.round(Math.max(0, diff) * 100) / 100,
        q_no: Math.round(Math.max(0, -diff) * 100) / 100,
        b,
      })
      .eq("id", id)
      .in("status", ["draft", "open"])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ market: data });
  }

  if (body.action === "resolve" && body.market_type && body.market_type !== "binary") {
    // Sport fallback for a final no provider will publish: lock the winner,
    // then pay through the same idempotent settlement the oracle uses.
    if (typeof body.outcome !== "string" || !body.outcome) {
      return NextResponse.json({ error: "Zgjidh fituesin" }, { status: 400 });
    }
    const { error } = await admin.rpc("admin_resolve_sport_market", {
      p_market_id: id, p_outcome: body.outcome,
      p_evidence: [], p_reasoning: "Rezultati zyrtar u vendos nga administratori.",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: settlementError } = await admin.rpc("settle_due_sport_markets");
    if (settlementError) return NextResponse.json({ error: settlementError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resolve") {
    if (body.outcome !== "PO" && body.outcome !== "JO") {
      return NextResponse.json({ error: "Rezultati duhet të jetë PO ose JO" }, { status: 400 });
    }
    const { data: market, error: marketError } = await admin.from("markets")
      .select("market_classification,market_type,status")
      .eq("id", id).maybeSingle();
    if (marketError) return NextResponse.json({ error: marketError.message }, { status: 500 });
    if (!market) return NextResponse.json({ error: "Tregu nuk u gjet" }, { status: 404 });
    const isNews = (market.market_classification ?? "general_news") === "general_news" && (market.market_type ?? "binary") === "binary";
    const reason = String(body.reason ?? "").trim();
    const sourceUrl = String(body.sourceUrl ?? "").trim();
    if (isNews && (reason.length < 20 || !/^https:\/\/\S+$/i.test(sourceUrl))) {
      return NextResponse.json({ error: "Zgjidhja e lajmit kërkon arsye konkrete dhe lidhje HTTPS me rezultatin." }, { status: 400 });
    }
    const { error } = isNews
      ? await admin.rpc("resolve_admin_news_market", { p_market_id: id, p_outcome: body.outcome, p_reason: reason, p_source_url: sourceUrl })
      : await admin.rpc("resolve_market", { p_market_id: id, p_outcome: body.outcome });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const marketType = body.market_type;
  const marketClassification = body.market_classification;
  if (marketClassification !== undefined && !MARKET_CLASSIFICATIONS.includes(marketClassification)) {
    return NextResponse.json({ error: "Klasifikimi i tregut është i pavlefshëm" }, { status: 400 });
  }
  if (marketType !== undefined && !["binary", "two_outcome", "three_outcome", "f1_race_winner"].includes(marketType)) {
    return NextResponse.json({ error: "Lloji i tregut është i pavlefshëm" }, { status: 400 });
  }

  const editableDraftFields = new Set([
    "question", "description", "resolution_criteria", "resolution_rules", "resolution_source",
    "category", "closes_at", "source_article_slugs", "pre_match_analysis", "live_event",
    "sport_outcomes", "outcome_quantities", "reference_probabilities", "outcomes",
    "market_type", "market_classification",
  ]);
  const unexpected = Object.keys(body).filter((key) => !editableDraftFields.has(key));
  if (unexpected.length) {
    return NextResponse.json({ error: `Fushë e palejuar për draftin: ${unexpected.join(", ")}` }, { status: 400 });
  }
  const fields = body;
  // `outcomes` is constrained by `market_type` in the database. Keep this
  // update atomic so an admin can switch a draft without leaving it invalid.
  const outcomeSchema = {
    binary: ["PO", "JO"],
    two_outcome: ["ARGENTINA", "SPAIN"],
    three_outcome: ["ENGLAND", "DRAW", "ARGENTINA"],
  } as const;
  const draftFields = marketType === "f1_race_winner" ? fields : marketType ? { ...fields, outcomes: outcomeSchema[marketType as keyof typeof outcomeSchema] } : fields;
  const { data, error } = await admin
    .from("markets")
    .update(draftFields)
    .eq("id", id)
    .eq("status", "draft")
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ market: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const { error } = await admin.from("markets").delete().eq("id", id).eq("status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
