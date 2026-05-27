import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const AUTO_DIR = path.join(process.cwd(), "data", "auto-articles");

async function isAuthed(req: NextRequest): Promise<boolean> {
  // cookie auth (admin panel)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_auth")?.value ?? "";
  if (ADMIN_SECRET && sessionCookie === ADMIN_SECRET) return true;
  // URL secret auth (legacy email links)
  const urlSecret = req.nextUrl.searchParams.get("secret") ?? "";
  if (ADMIN_SECRET && urlSecret === ADMIN_SECRET) return true;
  return false;
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, file, title, excerpt } = (await request.json()) as {
    id?: string;
    file?: string;
    title?: string;
    excerpt?: string;
  };

  if (!id || !file) {
    return NextResponse.json({ error: "Missing id or file" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(file)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.join(AUTO_DIR, file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const articles = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Array<Record<string, unknown>>;
  const idx = articles.findIndex((a) => a.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (title !== undefined) articles[idx].title = title;
  if (excerpt !== undefined) articles[idx].excerpt = excerpt;

  fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), "utf-8");

  return NextResponse.json({ ok: true, article: articles[idx] });
}
