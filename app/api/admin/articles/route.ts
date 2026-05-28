import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readArticlesFromDisk, writeArticles } from "@/lib/github-articles";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

async function isAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_auth")?.value ?? "";
  return Boolean(ADMIN_SECRET && session === ADMIN_SECRET);
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id   = request.nextUrl.searchParams.get("id")   ?? "";
  const file = request.nextUrl.searchParams.get("file") ?? "";

  if (!id || !/^\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(file)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const articles = readArticlesFromDisk(file);
  if (articles.length === 0) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const filtered = articles.filter((a) => a.id !== id);
  if (filtered.length === articles.length) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  try {
    await writeArticles(file, filtered);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
