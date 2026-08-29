import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getArticleBySlug, getArticleById } from "@/lib/db";

export const dynamic = "force-dynamic";

async function signedInClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await signedInClient();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });
  const { data, error } = await supabase
    .from("saved_articles")
    .select("article_id, slug, title, excerpt, category, source, image_url, published_at, saved_at")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ articles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await signedInClient();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  let payload: { articleId?: unknown; slug?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }

  const articleId = String(payload.articleId ?? "").trim();
  const slug = String(payload.slug ?? "").trim();
  let article = slug ? await getArticleBySlug(slug) : null;
  if (!article && articleId) article = await getArticleById(articleId);
  if (!article) return NextResponse.json({ error: "Artikulli nuk u gjet" }, { status: 404 });

  const { data, error } = await supabase
    .from("saved_articles")
    .upsert({
      user_id: user.id,
      article_id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt ?? "",
      category: article.category ?? "",
      source: article.source ?? "",
      image_url: article.imageUrl ?? null,
      published_at: article.publishedAt || null,
    }, { onConflict: "user_id,article_id" })
    .select("article_id, slug, title, excerpt, category, source, image_url, published_at, saved_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ article: data });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await signedInClient();
  if (!user) return NextResponse.json({ error: "Duhet të jesh i kyçur" }, { status: 401 });

  let payload: { articleId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }
  const articleId = String(payload.articleId ?? "").trim();
  if (!articleId) return NextResponse.json({ error: "Mungon artikulli" }, { status: 400 });

  const { error } = await supabase
    .from("saved_articles")
    .delete()
    .eq("user_id", user.id)
    .eq("article_id", articleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
