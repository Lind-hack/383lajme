import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { draftMarketsFromNews, slugifyQuestion } from "@/lib/tregu";

export const dynamic = "force-dynamic";

// Admin-triggered: ask Groq to propose new markets from today's news.
// Inserted as status="draft" — nothing goes live until an admin approves it
// via PATCH /api/admin/tregu/markets/[id] { action: "approve" }.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  let drafted;
  try {
    drafted = await draftMarketsFromNews(5);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const rows = drafted.map((d) => ({
    slug: `${slugifyQuestion(d.question) || "treg"}-${Date.now().toString(36)}`,
    question: d.question,
    description: d.description ?? null,
    category: d.category,
    status: "draft" as const,
    source_article_slugs: d.source_slugs ?? [],
    ai_generated: true,
    resolution_rules: d.resolution_rules?.trim() || null,
    resolution_source: d.resolution_source?.trim() || null,
    closes_at: new Date(Date.now() + (d.closes_in_days ?? 30) * 86_400_000).toISOString(),
  }));

  if (rows.length === 0) return NextResponse.json({ markets: [] });

  const { data, error } = await admin.from("markets").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ markets: data ?? [] });
}
