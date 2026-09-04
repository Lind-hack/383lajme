import type { Metadata } from "next";
import { isAdminAuthed } from "@/lib/admin-auth";
import AdminNav from "./_components/AdminNav";
import "./admin.css";

/**
 * The admin shell.
 *
 * Scopes the workspace tokens with .admin-root so nothing leaks into the site,
 * keeps the panel out of search results, and renders the one nav.
 *
 * The nav lives here rather than on each page because putting it per-page left
 * Sondazhi, Reagimi and the dosje queue with no way back: they were reachable
 * from the article list but their own headers linked nowhere, so the operator
 * had to use the browser's back button or retype a URL to leave them.
 *
 * The auth check is for that nav alone -- showing section links on the login
 * screen would be absurd. It is not a security boundary, and is not treated as
 * one: every page underneath still checks for itself, because a layout that
 * pages trusted would be bypassed the moment one were reached another way.
 */

export const metadata: Metadata = {
  title: "383 Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();

  return (
    <div className="admin-root">
      {authed && <AdminNav />}
      {children}
    </div>
  );
}
