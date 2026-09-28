import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The VAPID public key a browser needs to subscribe to push. Public by design. */
export async function GET() {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ key: null }, { status: 503 });
  const { data } = await admin.from("tregu_app_secrets").select("value").eq("key", "vapid_public").maybeSingle();
  return NextResponse.json({ key: data?.value ?? null }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
