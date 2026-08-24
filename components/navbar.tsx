"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import UserMenu from "./user-menu";
import NavBalance from "./nav-balance";
import NavSidePanel from "./nav-side-panel";
import CoinToast from "./tregu/coin-toast";
import SearchOverlay from "./search-overlay";
import { treguHeroBehindChrome } from "@/components/tregu/video-hero";
import { NAV_CATEGORIES } from "@/lib/category-map";

/** Derived from lib/category-map, so the navbar, the side panel (which imports
 *  this), the footer and the pill row cannot drift apart. Order and membership
 *  are changed in one place. */
export const NAV_LINKS = NAV_CATEGORIES.map(({ label, slug }) => ({
  label,
  href: `/kategori/${slug}`,
}));

export function KosovoTag() {
  return (
    <div
      className="kosovo-tag"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        color: "#44413D",
        fontSize: "13px",
        fontWeight: 800,
        letterSpacing: "0.07em",
        whiteSpace: "nowrap",
      }}
    >
      <MapPin size={15} strokeWidth={2.5} color="#FF4422" />
      <span>KOSOVË</span>
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  // On /tregu the dark overlay holds until the hero actually ends — not at
  // 80px, which left a cream bar cutting across the video mid-hero.
  const [heroUp, setHeroUp] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
      // On /tregu the dark overlay holds until the hero actually ends — not
      // at 80px, which left a cream bar cutting across the video mid-hero.
      setHeroUp(pathname === "/tregu" && treguHeroBehindChrome(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Below 768px the inline category row can't fit alongside the logo, so the
  // collapsed hamburger layout is used regardless of scroll position — the
  // full nav previously only collapsed on scroll, which left mobile visitors
  // with a clipped, non-obviously-scrollable category row and no way to
  // reach login/signup until they scrolled 80px.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const collapsed = scrolled || isMobile;
  // On the Tregu hub the header melts into the full-screen video hero until
  // the user scrolls: transparent background, ink text flipped to white
  // (color overrides live in globals.css under header[data-overlay]).
  const overlay = pathname === "/tregu" && heroUp;

  return (
    <header
      data-overlay={overlay ? "true" : undefined}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: overlay ? "transparent" : "#F9F6F1",
        borderBottom: overlay
          ? "1px solid transparent"
          : scrolled
            ? "1px solid #E8E3DB"
            : "1px solid rgba(17,17,17,0.08)",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.06)" : "none",
        transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
          padding: "0 clamp(20px, 2vw, 32px)",
          height: "72px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {/* Logo — always visible, never scrolls away */}
        <Link
          href="/"
          className="logo-mark"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "baseline",
            gap: "4px",
            flexShrink: 0,
            marginRight: "24px",
          }}
        >
          <span
            style={{
              fontSize: "34px",
              fontWeight: 800,
              color: overlay ? "#FFFFFF" : "#111111",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              transition: "color 0.3s ease",
            }}
          >
            383
          </span>
          <span
            className="logo-dot"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#FF4422",
              display: "inline-block",
              marginBottom: "4px",
              flexShrink: 0,
            }}
          />
        </Link>

        {/* Crossfade between the full nav and the collapsed hamburger so the
            two states slide/fade into each other instead of popping. */}
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: DUR.slow, ease: EASE }}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}
            >
              {/* Spacer pushes the controls to the right */}
              <div style={{ flex: 1, minWidth: 0 }} />
              {/* Search survives the collapse. It is the one thing that can
                  stand in for the categories that just disappeared, so burying
                  it inside the hamburger would cost the most at exactly the
                  moment the nav has the least. */}
              <button
                type="button"
                className="nav-search-btn"
                onClick={() => setSearchOpen(true)}
                aria-label="Kërko"
                style={{ marginRight: "8px" }}
              >
                <Search size={19} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <button
                className="nav-menu-btn"
                onClick={() => setMenuOpen(true)}
                aria-label="Hap menunë"
                aria-expanded={menuOpen}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1.5px solid #E8E3DB",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <span className="hamburger-bar" aria-hidden />
                <span className="hamburger-bar" aria-hidden />
                <span className="hamburger-bar" aria-hidden />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: DUR.slow, ease: EASE }}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}
            >
              {/* Scrollable nav pills */}
              <div
                className="nav-scroll"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {NAV_LINKS.map((link) => {
                  const active =
                    pathname === link.href ||
                    pathname?.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="nav-pill"
                      aria-current={active ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              <button
                type="button"
                className="nav-search-btn"
                onClick={() => setSearchOpen(true)}
                aria-label="Kërko"
                title="Kërko  ⌘K"
              >
                <Search size={19} strokeWidth={2.5} aria-hidden="true" />
              </button>

              {/* Tregu — prediction markets, pinned so it never scrolls out of the category row */}
              <Link
                href="/tregu"
                className="nav-tregu-link"
                data-active={pathname?.startsWith("/tregu") ? "true" : undefined}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#00A651",
                    boxShadow: "0 0 0 0 rgba(0,166,81,0.7)",
                    animation: "tregu-pulse 2s infinite",
                    flexShrink: 0,
                  }}
                />
                Tregu
              </Link>

              {/* Desktop only: Kosovo + auth pinned right (mobile auth now lives in the side panel) */}
              <div className="nav-auth-desktop">
                <KosovoTag />
                <NavBalance />
                <UserMenu />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NavSidePanel open={menuOpen} onClose={() => setMenuOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CoinToast />
    </header>
  );
}
