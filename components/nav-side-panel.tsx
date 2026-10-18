"use client";

import NewsletterCard from "@/components/newsletter-card";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./theme/theme-toggle";
import styles from "./nav-side-panel.module.css";
import {
  ArrowUpRight,
  ChevronDown,
  Globe2,
  MapPinned,
  Newspaper,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import type { User } from "@supabase/supabase-js";
import { NAV_LINKS } from "./navbar";


function getInitials(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined;
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return (user.email ?? "?").slice(0, 2).toUpperCase();
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NavSidePanel({ open, onClose }: Props) {
  const { user, ready } = useAuthUser();
  const [catsOpen, setCatsOpen] = useState(true);
  const panelRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Modal keyboard handling, focus containment, scroll lock and background isolation.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const isolatedElements: Array<{
      element: HTMLElement;
      wasInert: boolean;
      ariaHidden: string | null;
    }> = [];
    let branch: HTMLElement | null = panel;

    while (branch?.parentElement) {
      const parentElement: HTMLElement = branch.parentElement;
      Array.from(parentElement.children).forEach((candidate) => {
        if (
          !(candidate instanceof HTMLElement) ||
          candidate === branch ||
          candidate === overlayRef.current
        ) return;
        isolatedElements.push({
          element: candidate,
          wasInert: candidate.inert,
          ariaHidden: candidate.getAttribute("aria-hidden"),
        });
        candidate.inert = true;
        candidate.setAttribute("aria-hidden", "true");
      });
      branch = parentElement;
      if (parentElement === document.body) break;
    }

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.inert && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      isolatedElements.forEach(({ element, wasInert, ariaHidden }) => {
        element.inert = wasInert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      const previousFocus = previousFocusRef.current;
      window.setTimeout(() => previousFocus?.focus(), 0);
    };
  }, [open]);

  async function handleSignOut() {
    onClose();
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Dim overlay */}
      <div
        ref={overlayRef}
        className={`side-panel-overlay${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={panelRef}
        className={`side-panel${open ? " open" : ""}`}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "20px 22px 0",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#9C9C9C",
              }}
            >
              Menu
            </span>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Mbyll menunë"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                border: "1.5px solid #E8E3DB",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#111",
                flexShrink: 0,
              }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className={`side-panel-account ${styles.account}`}>
            {!ready ? (
              <span role="status" className={styles.loading}>Po kontrollohet hyrja…</span>
            ) : user ? (
              <div className={styles.profile}>
                <div className={styles.identity}>
                  <span className={styles.avatar} aria-hidden data-no-translate>{getInitials(user)}</span>
                  <div className={styles.userDetails}>
                    <strong data-no-translate>{user.user_metadata?.full_name ?? "Profili"}</strong>
                    <span data-no-translate>{user.email}</span>
                  </div>
                </div>
                <div className={styles.accountActions}>
                  <Link href="/profili" onClick={onClose} className={styles.accountButton}>Profili im</Link>
                  <button type="button" onClick={handleSignOut} className={`${styles.accountButton} ${styles.signOut}`}>Dil</button>
                </div>
              </div>
            ) : (
              <div className={styles.accountActions}>
                <Link href="/hyr" onClick={onClose} className={styles.accountButton}>Hyr</Link>
                <Link href="/hyr?tab=regjistrohu" onClick={onClose} className={`${styles.accountButton} ${styles.register}`}>Regjistrohu</Link>
              </div>
            )}
          </div>

          <div
            className="side-panel-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overscrollBehavior: "contain",
              paddingBottom: "24px",
            }}
          >
          {/* Categories — collapsible animated dropdown */}
          <button
            onClick={() => setCatsOpen((v) => !v)}
            aria-expanded={catsOpen}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: 0,
              marginBottom: "10px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#C4BDB1",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          >
            <span>Kategoritë</span>
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              style={{
                transform: catsOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
                color: "#FF4422",
              }}
            />
          </button>
          <AnimatePresence initial={false}>
            {catsOpen && (
              <motion.nav
                key="cats"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  overflow: "hidden",
                }}
              >
                {NAV_LINKS.map((link) => {
                  const active =
                    pathname === link.href || pathname?.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      className="side-panel-link glossy-orange"
                      aria-current={active ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </motion.nav>
            )}
          </AnimatePresence>

          <nav className={styles.features} aria-label="Veçoritë e 383">
            {[
              { href: "/visit", title: "Kosova në xhep", description: "Qytetet, kufiri dhe ndihma pranë teje", Icon: MapPinned, variant: styles.visit },
              { href: "/bota-per-kosoven", title: "Bota për Kosovën", description: "Si shkruan shtypi i huaj për Kosovën", Icon: Globe2, variant: styles.world },
              { href: "/per-ty", title: "Për ty", description: "Gazeta jote, nga ajo që lexon", Icon: Newspaper, variant: styles.forYou },
            ].map(({ href, title, description, Icon, variant }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`${styles.feature} ${variant}`}
                aria-current={pathname === href || pathname?.startsWith(href + "/") ? "page" : undefined}
              >
                <span className={styles.featureIcon} aria-hidden="true"><Icon size={25} strokeWidth={1.7} /></span>
                <span className={styles.featureCopy}>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </span>
                <ArrowUpRight className={styles.featureArrow} aria-hidden="true" size={16} strokeWidth={2} />
              </Link>
            ))}
          </nav>

          {/* Tregu — standalone feature group, kept apart from the news
              categories above. Same label treatment as "Kategoritë". */}
          <div
            style={{
              marginTop: "22px",
              paddingTop: "20px",
              borderTop: "1px solid #E8E3DB",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: "10px",
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#C4BDB1",
                fontFamily: "var(--font-manrope), sans-serif",
              }}
            >
              Tregu
            </span>
            <Link
              href="/tregu"
              onClick={onClose}
              className="side-panel-link side-panel-tregu glossy-orange"
              aria-current={
                pathname?.startsWith("/tregu") && pathname !== "/tregu/portofoli"
                  ? "page"
                  : undefined
              }
            >
              <span className="side-panel-tregu-dot" aria-hidden />
              Tregu
            </Link>
            {user && (
              <Link
                href="/tregu/portofoli"
                onClick={onClose}
                className="side-panel-tregu-sub"
                aria-current={pathname === "/tregu/portofoli" ? "page" : undefined}
              >
                Portofoli im
              </Link>
            )}
          </div>

          <NewsletterCard compact onNavigate={onClose} />

          <div className="side-panel-appearance"><ThemeToggle /></div>
          </div>
        </div>
      </aside>
    </>
  );
}
