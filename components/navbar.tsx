"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UserMenu from "./user-menu";

const NAV_LINKS = [
  { label: "Politikë", href: "/kategori/politike" },
  { label: "Ekonomi", href: "/kategori/ekonomi" },
  { label: "Botë", href: "/kategori/bote" },
  { label: "Siguri", href: "/kategori/siguri" },
  { label: "Teknologji", href: "/kategori/teknologji" },
  { label: "Showbiz", href: "/kategori/showbiz" },
  { label: "Sport", href: "/kategori/sport" },
];

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

        {/* Scrollable row: pills → Kosovo flag → auth buttons */}
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
            <Link
              key={link.href}
              href={link.href}
              style={{
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "7px 16px",
                borderRadius: "100px",
                background: "rgba(17,17,17,0.07)",
                color: "#111111",
                border: "1.5px solid rgba(17,17,17,0.12)",
                transition: "all 0.2s ease",
                display: "inline-block",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "#111111";
                el.style.color = "#ffffff";
                el.style.borderColor = "#111111";
                el.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(17,17,17,0.07)";
                el.style.color = "#111111";
                el.style.borderColor = "rgba(17,17,17,0.12)";
                el.style.transform = "scale(1)";
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* Kosovo flag — after all pills, scrolls with them */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#6B6B6B",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              whiteSpace: "nowrap",
              flexShrink: 0,
              marginLeft: "8px",
            }}
          >
            <span>🇽🇰</span>
            <span>KOSOVË</span>
          </div>

          {/* Auth buttons — at the far right end of the scroll */}
          <div style={{ flexShrink: 0 }}>
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
