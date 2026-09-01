import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWithdrawalRequestNotification } from "@/lib/tregu-live-email";

export const dynamic = "force-dynamic";

// Withdrawals are requested here (deducts coins immediately, atomically, via
// the request_withdrawal RPC) but paid out manually by an admin — see
// app/api/admin/tregu/withdrawals/route.ts. This is intentional: automated
// real-money payout requires gambling licensing / KYC we don't have.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { payoutMethod?: string } | null;
  if (!body?.payoutMethod?.trim()) {
    return NextResponse.json({ error: "Shto mënyrën e pagesës (PayPal ose IBAN)" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_payout_method: body.payoutMethod.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let notificationSent = false;
  try {
    await sendWithdrawalRequestNotification({ requestId: String(data), userEmail: user.email });
    notificationSent = true;
  } catch (notificationError) {
    console.error("Withdrawal request was saved but its review email failed", notificationError);
  }

  return NextResponse.json({ ok: true, requestId: data, notificationSent });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ withdrawals: data ?? [] });
}
