import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// PATCH { action: "approve" }              -> draft -> open
// PATCH { action: "close" }                -> open -> closed (betting stops, awaiting resolution)
// PATCH { action: "resolve", outcome }     -> resolves + pays out winners via RPC
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
    | { action?: "approve" | "close" | "resolve"; outcome?: "PO" | "JO"; [key: string]: unknown }
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

  if (body.action === "resolve") {
    if (body.outcome !== "PO" && body.outcome !== "JO") {
      return NextResponse.json({ error: "Rezultati duhet të jetë PO ose JO" }, { status: 400 });
    }
    const { error } = await admin.rpc("resolve_market", { p_market_id: id, p_outcome: body.outcome });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
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
