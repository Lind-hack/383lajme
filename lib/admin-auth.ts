import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "./admin-session";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

/**
 * Is this request an authenticated admin.
 *
 * Two things this deliberately no longer does.
 *
 * It no longer compares the cookie against ADMIN_SECRET, because that made the
 * cookie the password: holding it was equivalent to knowing the secret, and it
 * could be set by hand without ever meeting the login form -- so a second
 * factor guarding that form would have guarded nothing.
 *
 * It no longer accepts `?secret=` from the query string. A credential in a url
 * lands in server logs, browser history and the Referer header of every
 * outbound link on the page, and it was a second way past the login form.
 */
export async function isAdminAuthed(_req?: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value, ADMIN_SECRET);
}

/** For server components, which hold no NextRequest. */
export async function isAdminAuthedFromCookies(): Promise<boolean> {
  return isAdminAuthed();
}
