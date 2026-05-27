import { type NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

export async function POST(request: NextRequest) {
  const { password } = (await request.json()) as { password?: string };

  if (!ADMIN_SECRET || password !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Fjalëkalim i gabuar" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_auth", ADMIN_SECRET, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_auth");
  return res;
}
