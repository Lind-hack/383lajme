import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanDisplayName } from "@/lib/profile-hub.mjs";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  let payload: { displayName?: unknown; anonymous?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }

  const displayName = cleanDisplayName(payload.displayName);
  if (displayName.length < 2) {
    return NextResponse.json({ error: "Emri publik duhet të ketë së paku 2 karaktere" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("update_profile_settings", {
    p_display_name: displayName,
    p_is_anonymous: payload.anonymous === true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ profile });
}
