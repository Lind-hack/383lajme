import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, mintAdminSession } from "@/lib/admin-session";
import { totpEnabled, verifyTotp } from "@/lib/admin-totp";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

/** Whether this deployment asks for a second factor, for the login form. */
export async function GET() {
  return NextResponse.json({ totp: totpEnabled() });
}

export async function POST(request: NextRequest) {
  const { password, code } = (await request.json().catch(() => ({}))) as {
    password?: string;
    code?: string;
  };

  if (!ADMIN_SECRET || password !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Fjalëkalim i gabuar" }, { status: 401 });
  }

  // The second factor is required only once a secret exists, so shipping this
  // cannot lock anyone out of their own dashboard before they have enrolled.
  if (totpEnabled()) {
    const secret = (process.env.ADMIN_TOTP_SECRET ?? "").trim();
    if (!verifyTotp(code, secret)) {
      // Deliberately the same shape as a wrong password, and returned only
      // after the password has already been checked: a distinct message would
      // confirm to anyone guessing that the password itself was right.
      return NextResponse.json({ error: "Kodi i verifikimit është i pasaktë" }, { status: 401 });
    }
  }

  const res = NextResponse.json({ ok: true });
  // A signed, expiring token -- never the secret itself.
  res.cookies.set(ADMIN_COOKIE, mintAdminSession(ADMIN_SECRET), ADMIN_COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
