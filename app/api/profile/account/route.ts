import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  let payload: { confirmation?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }
  if (String(payload.confirmation ?? "").trim().toUpperCase() !== "FSHIJE") {
    return NextResponse.json({ error: "Shkruaj FSHIJE për të konfirmuar" }, { status: 400 });
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
