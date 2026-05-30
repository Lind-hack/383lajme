import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readArticlesFromDisk, writeArticles } from "@/lib/github-articles";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

async function isAuthed(req: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_auth")?.value ?? "";
  if (ADMIN_SECRET && sessionCookie === ADMIN_SECRET) return true;
  const urlSecret = req.nextUrl.searchParams.get("secret") ?? "";
  if (ADMIN_SECRET && urlSecret === ADMIN_SECRET) return true;
  return false;
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, file, title, excerpt, imageUrl, body } = (await request.json()) as {
    id?: string;
    file?: string;
    title?: string;
    excerpt?: string;
    imageUrl?: string;
    body?: string;
  };

  if (!id || !file) {
    return NextResponse.json({ error: "Missing id or file" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const articles = readArticlesFromDisk(file);
  if (articles.length === 0) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const idx = articles.findIndex((a) => a.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (title !== undefined) articles[idx].title = title;
  if (excerpt !== undefined) articles[idx].excerpt = excerpt;
  if (imageUrl !== undefined) articles[idx].image_url = imageUrl;
  if (body !== undefined) articles[idx].body = body;

  try {
    await writeArticles(file, articles);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, article: articles[idx] });
}
