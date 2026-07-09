import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_auth")?.value ?? "";
  if (ADMIN_SECRET && session === ADMIN_SECRET) return true;
  const urlSecret = req.nextUrl.searchParams.get("secret") ?? "";
  if (ADMIN_SECRET && urlSecret === ADMIN_SECRET) return true;
  return false;
}
