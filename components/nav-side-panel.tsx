"use client";

import NewsletterCard from "@/components/newsletter-card";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./theme/theme-toggle";
import ToniGaugeIcon from "@/components/toni-gauge-icon";
import {
  ArrowUpRight,
  ChevronDown,
  Plane,
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

          <div className="side-panel-account">
            {!ready ? (
              <span role="status">Po kontrollohet hyrja…</span>
            ) : user ? (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1.5px solid #E8E3DB",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      background: "#FF4422",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "15px",
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}
                  >
                    <span data-no-translate>{getInitials(user)}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#111",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span data-no-translate>{user.user_metadata?.full_name ?? "Profili"}</span>
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "#999",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span data-no-translate>{user.email}</span>
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/profili");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "100px",
                      border: "1.5px solid rgba(17,17,17,0.18)",
                      background: "transparent",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#111",
                      cursor: "pointer",
                      fontFamily: "var(--font-manrope), sans-serif",
                    }}
                  >
                    Profili im
                  </button>
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "100px",
                      border: "1.5px solid rgba(229,62,62,0.3)",
                      background: "transparent",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#e53e3e",
                      cursor: "pointer",
                      fontFamily: "var(--font-manrope), sans-serif",
                    }}
                  >
                    Dil
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                <Link
                  href="/hyr"
                  onClick={onClose}
                  className="btn-outline"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "11px 16px",
                    borderRadius: "100px",
                    border: "1.5px solid rgba(17,17,17,0.2)",
                    background: "transparent",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#111",
                    textDecoration: "none",
                  }}
                >
                  Hyr
                </Link>
                <Link
                  href="/hyr?tab=regjistrohu"
                  onClick={onClose}
                  className="btn-primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "11px 16px",
                    borderRadius: "100px",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#fff",
                    textDecoration: "none",
                  }}
                >
                  Regjistrohu
                </Link>
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

          {/* Kosova në xhep (visitor guide): a distinct utility destination between
              editorial categories and the Tregu product. */}
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
              Për vizitorët
            </span>
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href="/visit"
                className="side-panel-feature"
                onClick={onClose}
                aria-current={pathname?.startsWith("/visit") ? "page" : undefined}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  minHeight: "76px",
                  padding: "14px",
                  overflow: "hidden",
                  border: pathname?.startsWith("/visit")
                    ? "1px solid #FF4422"
                    : "1px solid #D8CEC2",
                  borderRadius: "14px",
                  backgroundColor: "#EEE6DA",
                  backgroundImage: "url('/visit/atlas-texture.webp')",
                  backgroundSize: "330px auto",
                  backgroundPosition: "center",
                  boxShadow: "0 10px 28px rgba(46, 35, 24, 0.1)",
                  color: "#171614",
                  textDecoration: "none",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    width: "1px",
                    height: "110px",
                    right: "58px",
                    top: "-17px",
                    background: "rgba(23, 22, 20, 0.12)",
                    transform: "rotate(3deg)",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "42px",
                    height: "42px",
                    flexShrink: 0,
                    border: "1px solid rgba(23, 22, 20, 0.2)",
                    borderRadius: "11px",
                    background: "rgba(255, 253, 249, 0.72)",
                    color: "#FF4422",
                    transform: "rotate(-4deg)",
                  }}
                >
                  <Plane size={20} strokeWidth={2.2} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 800,
                      lineHeight: 1.25,
                    }}
                  >
                    Kosova në xhep
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#665F57",
                      fontSize: "10px",
                      fontWeight: 650,
                      lineHeight: 1.35,
                    }}
                  >
                    Kosovë + Shqipëri: udhëtimi dhe ndihma
                  </span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  size={18}
                  strokeWidth={2.2}
                  style={{ flexShrink: 0 }}
                />
              </Link>
            </motion.div>
          </div>

          {/* Toni — a standing index, not a news category and not a visitor
              utility. It gets the same standalone treatment as Tregu rather
              than sitting under "Për vizitorët", which is about travelling. */}
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
              Toni
            </span>
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href="/bota-per-kosoven"
                className="side-panel-feature"
                onClick={onClose}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "13px",
                  overflow: "hidden",
                  padding: "14px 16px",
                  border: "1px solid rgba(23, 22, 20, 0.12)",
                  borderRadius: "14px",
                  backgroundColor: "#F7F3EC",
                  boxShadow: "0 10px 28px rgba(46, 35, 24, 0.08)",
                  color: "#171614",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "42px",
                    height: "42px",
                    flexShrink: 0,
                    border: "1px solid rgba(23, 22, 20, 0.2)",
                    borderRadius: "11px",
                    background: "rgba(255, 253, 249, 0.72)",
                    color: "#FF4422",
                    transform: "rotate(4deg)",
                  }}
                >
                  <ToniGaugeIcon size={20} strokeWidth={2.2} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 800,
                      lineHeight: 1.25,
                    }}
                  >
                    Toni ndaj Kosovës
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#665F57",
                      fontSize: "10px",
                      fontWeight: 650,
                      lineHeight: 1.35,
                    }}
                  >
                    Si po shkruan bota për Kosovën, sipas shtetit
                  </span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  size={18}
                  strokeWidth={2.2}
                  style={{ flexShrink: 0 }}
                />
              </Link>
            </motion.div>
          </div>

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
