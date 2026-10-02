import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validEndpoint } from "@/lib/perty-morning.mjs";

export const dynamic = "force-dynamic";

/**
 * Turn the 07:00 morning push on or off for this browser.
 *
 * POST   { endpoint }  → on
 * DELETE { endpoint }  → off
 *
 * Guests can use it: the push address is all that is stored (no account, no
 * interests), and only addresses of real browser push services are accepted.
 */
async function endpointFrom(request: NextRequest) {
  try {
    const body = await request.json();
    return validEndpoint(body?.endpoint);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const endpoint = await endpointFrom(request);
  if (!endpoint) return NextResponse.json({ error: "Abonimi nuk vlen." }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  // A browser that turns it back on keeps its place: this morning is not sent twice.
  const { error } = await admin
    .from("perty_push_subscriptions")
    .upsert({ endpoint }, { onConflict: "endpoint", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ on: true });
}

export async function DELETE(request: NextRequest) {
  const endpoint = await endpointFrom(request);
  if (!endpoint) return NextResponse.json({ error: "Abonimi nuk vlen." }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const { error } = await admin.from("perty_push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ on: false });
}
