import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const AUTO_DIR = path.join(process.cwd(), "data", "auto-articles");

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

  const filePath = path.join(AUTO_DIR, file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const articles = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Array<Record<string, unknown>>;
  const filtered = articles.filter((a) => a.id !== id);

  if (filtered.length === articles.length) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
