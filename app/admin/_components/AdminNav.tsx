"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  FolderSearch,
  LineChart,
  LogOut,
  MessageSquare,
  Vote,
} from "lucide-react";

/**
 * The one nav for the whole panel.
 *
 * The old header carried a single link, to Tregu. Dosje, Sondazhi and Reagimi
 * existed but could only be reached by typing the URL, which is why the dosje
 * queue went unreviewed. Every section is now one tap from every other.
 */

const SECTIONS = [
  { href: "/admin", label: "Artikuj", Icon: FileText },
  { href: "/admin/dosje", label: "Dosje", Icon: FolderSearch },
  { href: "/admin/tregu", label: "Tregu", Icon: LineChart },
  { href: "/admin/poll", label: "Sondazhi", Icon: Vote },
  { href: "/admin/reagimi", label: "Reagimi", Icon: MessageSquare },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  // "/admin" is a prefix of every section, so it matches only exactly.
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminNav({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
      window.location.href = "/admin";
    } catch {
      setLeaving(false);
    }
  }

  return (
    <header
      className="sticky top-0 z-40 border-b bg-[var(--a-panel)]/95 backdrop-blur-sm"
      style={{ borderColor: "var(--a-border)" }}
    >
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-3 sm:px-5">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-1.5 no-underline"
          title="Kthehu te faqja"
        >
          <span className="text-[19px] font-black tracking-tight text-[var(--a-ink)]">383</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--a-faint)]">
            Admin
          </span>
        </Link>

        {/* Desktop sections. On narrow screens these move to the row below so
            the header never turns into a squeeze of unreadable labels. */}
        <nav className="ml-2 hidden min-w-0 items-center gap-0.5 md:flex">
          {SECTIONS.map(({ href, label, Icon }) => {
            const current = isCurrent(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold no-underline transition-colors"
                style={{
                  background: current ? "var(--a-accent-wash)" : "transparent",
                  color: current ? "var(--a-accent-fill)" : "var(--a-muted)",
                }}
              >
                <Icon size={15} strokeWidth={2.1} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {right}
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="btn btn-sm btn-icon"
            title="Dil"
            aria-label="Dil"
          >
            <LogOut size={14} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile sections: one scrollable row of real targets, not a menu that
          costs a tap before the operator can move. */}
      <nav
        className="flex items-center gap-1 overflow-x-auto border-t px-2 py-1.5 md:hidden"
        style={{ borderColor: "var(--a-border)", scrollbarWidth: "none" }}
      >
        {SECTIONS.map(({ href, label, Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-2 text-[13px] font-semibold no-underline transition-colors"
              style={{
                background: current ? "var(--a-accent-wash)" : "transparent",
                color: current ? "var(--a-accent-fill)" : "var(--a-muted)",
              }}
            >
              <Icon size={15} strokeWidth={2.1} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
