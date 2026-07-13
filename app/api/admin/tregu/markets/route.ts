import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { slugifyQuestion } from "@/lib/tregu";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await admin.from("markets").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ markets: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as
    | {
        question?: string;
        description?: string;
        category?: string;
        closesInDays?: number;
        sourceSlugs?: string[];
        aiGenerated?: boolean;
        status?: "draft" | "open";
        resolutionRules?: string;
        resolutionSource?: string;
      }
    | null;

  if (!body?.question?.trim() || !body?.category) {
    return NextResponse.json({ error: "Pyetja dhe kategoria janë të detyrueshme" }, { status: 400 });
  }

  const slug = slugifyQuestion(body.question) || `treg-${Date.now()}`;
  const closesAt = new Date(Date.now() + (body.closesInDays ?? 30) * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("markets")
    .insert({
      slug,
      question: body.question.trim(),
      description: body.description?.trim() || null,
      category: body.category,
      status: body.status ?? "draft",
      source_article_slugs: body.sourceSlugs ?? [],
      ai_generated: body.aiGenerated ?? false,
      resolution_rules: body.resolutionRules?.trim() || null,
      resolution_source: body.resolutionSource?.trim() || null,
      closes_at: closesAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ market: data });
}
