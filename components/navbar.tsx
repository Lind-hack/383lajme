"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import UserMenu from "./user-menu";
import { dateLine } from "@/lib/date-sq";

const NAV_LINKS = [
  { label: "Politikë", href: "/kategori/politike" },
  { label: "Ekonomi", href: "/kategori/ekonomi" },
  { label: "Botë", href: "/kategori/bote" },
  { label: "Siguri", href: "/kategori/siguri" },
  { label: "Teknologji", href: "/kategori/teknologji" },
  { label: "Showbiz", href: "/kategori/showbiz" },
  { label: "Sport", href: "/kategori/sport" },
];

function KosovoTag() {
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
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

        {/* Date strip — desktop only */}
        <span
          className="nav-date-strip"
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-fraunces), 'Fraunces', Georgia, serif",
            fontStyle: "italic",
            color: "#6B6B6B",
            whiteSpace: "nowrap",
            flexShrink: 0,
            letterSpacing: "0.01em",
            paddingLeft: "8px",
            borderLeft: "1px solid #E8E3DB",
          }}
        >
          {dateLine(new Date())}
        </span>

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

        {/* Mobile only: Kosovo + auth pinned right (outside scroll to avoid touch-action conflict) */}
        <div className="nav-auth-mobile">
          <KosovoTag />
          <UserMenu />
        </div>

        {/* Desktop only: Kosovo + auth pinned right */}
        <div className="nav-auth-desktop">
          <KosovoTag />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
