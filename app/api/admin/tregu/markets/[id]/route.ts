import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type MarketClassification = "general_news" | "live_football" | "live_f1";
const MARKET_CLASSIFICATIONS: readonly MarketClassification[] = ["general_news", "live_football", "live_f1"];

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
    | {
        action?: "approve" | "close" | "resolve" | "seed" | "reopen";
        outcome?: "PO" | "JO";
        initialProb?: number;
        market_classification?: MarketClassification;
        [key: string]: unknown;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Trup i pavlefshëm" }, { status: 400 });

  if (body.action === "approve") {
    const { data, error } = await admin
      .from("markets")
      .update({ status: "open" })
      .eq("id", id)
      .eq("status", "draft")
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    const p = Math.min(0.98, Math.max(0.02, body.initialProb));
    const b = 100;
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

  if (body.action === "resolve") {
    if (body.outcome !== "PO" && body.outcome !== "JO") {
      return NextResponse.json({ error: "Rezultati duhet të jetë PO ose JO" }, { status: 400 });
    }
    const { error } = await admin.rpc("resolve_market", { p_market_id: id, p_outcome: body.outcome });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const marketClassification = body.market_classification;
  if (marketClassification !== undefined && !MARKET_CLASSIFICATIONS.includes(marketClassification)) {
    return NextResponse.json({ error: "Klasifikimi i tregut është i pavlefshëm" }, { status: 400 });
  }

  const { action: _a, outcome: _o, ...fields } = body;
  const { data, error } = await admin
    .from("markets")
    .update(fields)
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
