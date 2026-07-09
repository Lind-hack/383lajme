import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// PATCH { status: "approved" | "paid" | "rejected", notes? }
// "rejected" refunds the coins back to the user.
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
    | { status?: "approved" | "paid" | "rejected"; notes?: string }
    | null;

  if (!body?.status) return NextResponse.json({ error: "Statusi mungon" }, { status: 400 });

  const { data: existing, error: fetchErr } = await admin
    .from("withdrawal_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !existing) return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });

  if (body.status === "rejected" && existing.status !== "rejected") {
    const { error: refundErr } = await admin.rpc("increment_profile_coins", {
      p_user_id: existing.user_id,
      p_amount: existing.coins_amount,
    });
    if (refundErr) return NextResponse.json({ error: refundErr.message }, { status: 500 });

    await admin.from("transactions").insert({
      user_id: existing.user_id,
      type: "withdrawal",
      amount: existing.coins_amount,
      meta: { note: "Rimbursim - kërkesa u refuzua", withdrawal_request_id: id },
    });
  }

  const { data, error } = await admin
    .from("withdrawal_requests")
    .update({ status: body.status, admin_notes: body.notes ?? existing.admin_notes, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ withdrawal: data });
}
