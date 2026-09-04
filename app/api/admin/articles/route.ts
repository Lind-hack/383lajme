import { type NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  deleteArticle,
  getArticleForEdit,
  updateArticle,
  type ArticlePatch,
} from "@/lib/admin/articles";

/**
 * Article writes for the admin panel.
 *
 * This route used to edit `data/auto-articles/*.json` through
 * lib/github-articles.ts. That store is the outage fallback lib/db.ts reads
 * only when Supabase is unreachable, and it shares zero slugs with the rows
 * the site renders -- so every delete made here changed nothing in production.
 * It now writes `news_articles`, which is what the site reads.
 *
 * Auth was also a private copy of the old cookie-equals-password check, with
 * `?secret=` included. Two copies of an auth rule is one rule that gets
 * hardened and one that does not, which is exactly what happened here.
 */

/**
 * One article with its body, fetched when the editor opens.
 *
 * The body is deliberately not in the list payload -- 1.5 MB of it across the
 * archive is what made the old panel slow -- so the editor asks for the one it
 * is about to edit.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id mungon" }, { status: 400 });

  const article = await getArticleForEdit(id);
  if (!article) return NextResponse.json({ error: "Artikulli nuk u gjet" }, { status: 404 });
  return NextResponse.json({ article });
}

const MAX_TITLE = 300;
const MAX_EXCERPT = 2000;
const MAX_BODY = 200_000;

function tooLong(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > max;
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Trup i pavlefshëm JSON" }, { status: 400 });
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id mungon" }, { status: 400 });

  if (tooLong(payload.title, MAX_TITLE)) {
    return NextResponse.json({ error: "Titulli është shumë i gjatë" }, { status: 400 });
  }
  if (tooLong(payload.excerpt, MAX_EXCERPT)) {
    return NextResponse.json({ error: "Përshkrimi është shumë i gjatë" }, { status: 400 });
  }
  if (tooLong(payload.body, MAX_BODY)) {
    return NextResponse.json({ error: "Teksti është shumë i gjatë" }, { status: 400 });
  }

  // Only copy fields that were actually sent. An absent key must leave the
  // column alone; `imageUrl: null` is a deliberate clear and does not.
  const patch: ArticlePatch = {};
  if (typeof payload.title === "string") patch.title = payload.title;
  if (typeof payload.excerpt === "string") patch.excerpt = payload.excerpt;
  if (typeof payload.body === "string") patch.body = payload.body;
  if (typeof payload.category === "string") patch.category = payload.category;
  if (typeof payload.featured === "boolean") patch.featured = payload.featured;
  if ("imageUrl" in payload) {
    const raw = payload.imageUrl;
    patch.imageUrl = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Asgjë për të ruajtur" }, { status: 400 });
  }

  const result = await updateArticle(id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id mungon" }, { status: 400 });

  const result = await deleteArticle(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
