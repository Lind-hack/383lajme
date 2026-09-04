import type { Metadata } from "next";
import "./admin.css";

/**
 * The admin shell.
 *
 * Only two jobs: scope the workspace tokens with .admin-root so nothing leaks
 * into the site, and keep the panel out of search results. Auth is not decided
 * here -- each page checks it for itself, because a layout is not a security
 * boundary and a route that trusted one would be exposed the moment it were
 * reached another way.
 */

export const metadata: Metadata = {
  title: "383 Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
