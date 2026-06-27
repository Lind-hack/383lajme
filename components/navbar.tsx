"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import UserMenu from "./user-menu";
import NavSidePanel from "./nav-side-panel";

export const NAV_LINKS = [
  { label: "Politikë", href: "/kategori/politike" },
  { label: "Ekonomi", href: "/kategori/ekonomi" },
  { label: "Botë", href: "/kategori/bote" },
  { label: "Siguri", href: "/kategori/siguri" },
  { label: "Teknologji", href: "/kategori/teknologji" },
  { label: "Showbiz", href: "/kategori/showbiz" },
  { label: "Sport", href: "/kategori/sport" },
];

export function KosovoTag() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        color: "#6B6B6B",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}
    >
      <MapPin size={13} strokeWidth={2.5} color="#FF4422" />
      <span>KOSOVË</span>
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "#F9F6F1",
        borderBottom: scrolled ? "1px solid #E8E3DB" : "1px solid transparent",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.06)" : "none",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
          height: "64px",
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
          }}
        >
          <span
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#111111",
              letterSpacing: "-0.04em",
              lineHeight: 1,
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
          {scrolled ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: DUR.slow, ease: EASE }}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}
            >
              {/* Spacer pushes the hamburger to the right */}
              <div style={{ flex: 1, minWidth: 0 }} />
              <button
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
                  gap: "6px",
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="nav-pill">
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Desktop only: Kosovo + auth pinned right (mobile auth now lives in the side panel) */}
              <div className="nav-auth-desktop">
                <KosovoTag />
                <UserMenu />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NavSidePanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
