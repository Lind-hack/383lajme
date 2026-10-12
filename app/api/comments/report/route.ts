import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_HIDE, isCommentId } from "@/lib/article-comments.mjs";

/**
 * POST { id } — a signed-in reader reports a comment. REPORT_HIDE reports from
 * different readers hide it until an editor looks (app/admin/komente).
 * → { status } of the comment afterwards.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let user = null;
  try {
    const supabase = await createClient();
    user = (await supabase.auth.getUser()).data?.user ?? null;
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ error: "Hyr në llogari për të raportuar." }, { status: 401 });

  let payload: { id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  }
  if (!isCommentId(payload?.id)) return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });

  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "S'mund të raportohet tani." }, { status: 503 });
  const { data, error } = await client.rpc("report_article_comment", { p_comment: payload.id, p_reporter: user.id, hide_at: REPORT_HIDE });
  if (error) {
    console.warn("[comments] report failed", error.message);
    return NextResponse.json({ error: "S'u raportua — provo sërish." }, { status: 500 });
  }
  return NextResponse.json({ status: typeof data === "string" ? data : null });
}
