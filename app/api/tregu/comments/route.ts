import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST { marketId, body } — writes a market comment as the logged-in user.
// RLS (0004) enforces auth.uid() = user_id; this route just shapes the response.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Duhet të jesh i kyçur për të komentuar" }, { status: 401 });
  }

  let payload: { marketId?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }

  const marketId = String(payload.marketId ?? "");
  const body = String(payload.body ?? "").trim();
  if (!marketId || body.length < 1 || body.length > 500) {
    return NextResponse.json({ error: "Komenti duhet të ketë 1–500 karaktere" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("market_comments")
    .insert({ market_id: marketId, user_id: user.id, body })
    .select("id, body, created_at, user_id, profiles(display_name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profile = (data as unknown as { profiles: { display_name: string | null } | null }).profiles;
  return NextResponse.json({
    comment: {
      id: data.id,
      body: data.body,
      createdAt: data.created_at,
      userId: data.user_id,
      name: profile?.display_name ?? "Anonim",
    },
  });
}
