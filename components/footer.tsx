"use client";

import Link from "next/link";
import { CATEGORY_COLORS } from "@/lib/category-colors";

const FOOTER_CATEGORIES = [
  { label: "Politikë", href: "/kategori/politike" },
  { label: "Ekonomi", href: "/kategori/ekonomi" },
  { label: "Botë", href: "/kategori/bote" },
  { label: "Siguri", href: "/kategori/siguri" },
  { label: "Teknologji", href: "/kategori/teknologji" },
  { label: "Showbiz", href: "/kategori/showbiz" },
  { label: "Sport", href: "/kategori/sport" },
  { label: "Kulturë", href: "/kategori/kulture" },
  { label: "Shoqëri", href: "/kategori/shoqeri" },
];

const COMPANY_LINKS = [
  { label: "Rreth nesh", href: "/rreth-nesh" },
  { label: "Kontakti", href: "/kontakt" },
  { label: "Karriera", href: "/karriera" },
  { label: "Privatësia", href: "/privatesia" },
  { label: "Kushtet", href: "/kushtet" },
];

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.53V6.79a4.85 4.85 0 01-1.01-.1z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const SOCIAL = [
  { label: "Instagram", handle: "@383media", Icon: InstagramIcon },
  { label: "TikTok", handle: "@383media", Icon: TikTokIcon },
  { label: "Facebook", handle: "383 Media", Icon: FacebookIcon },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "#1A1A1A",
        padding: "80px 24px 0",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

        {/* 4-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
            gap: "48px",
            marginBottom: "60px",
          }}
        >

          {/* Col 1 — Brand + newsletter + social icons */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "16px" }}>
              <span style={{ fontSize: "36px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1 }}>
                383
              </span>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FF4422", display: "inline-block", marginBottom: "5px" }} />
            </div>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", margin: "0 0 28px", fontWeight: 400, maxWidth: "280px", lineHeight: 1.75 }}>
              Lajmet kryesore ndërkombëtare, të filtruar dhe analizuar çdo ditë për Kosovën.
            </p>

            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", margin: "0 0 10px" }}>
              REGJISTROHU PËR NJOFTIME
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
              <input
                type="email"
                placeholder="Email-i juaj..."
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "100px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.07)",
                  color: "#fff",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "inherit",
                  minWidth: 0,
                }}
              />
              <button
                style={{
                  padding: "10px 20px",
                  borderRadius: "100px",
                  background: "#FF4422",
                  color: "#fff",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                →
              </button>
            </div>

            <div style={{ display: "flex", gap: "14px" }}>
              {SOCIAL.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  style={{ color: "rgba(255,255,255,0.35)", transition: "color 0.2s ease", display: "inline-flex" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#FF4422")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)")}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Categories */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", margin: "0 0 20px" }}>
              KATEGORITË
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
              {FOOTER_CATEGORIES.map((cat) => {
                const color = CATEGORY_COLORS[cat.label] ?? "#FF4422";
                return (
                  <Link
                    key={cat.href}
                    href={cat.href}
                    style={{
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      color,
                      transition: "opacity 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.65")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                  >
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                    {cat.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Col 3 — Company */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", margin: "0 0 20px" }}>
              KOMPANIA
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
              {COMPANY_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.45)",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#FFFFFF")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Col 4 — Contact + social handles */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", margin: "0 0 20px" }}>
              KONTAKTI
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px", marginBottom: "32px" }}>
              <a
                href="mailto:info@383media.com"
                style={{ textDecoration: "none", fontSize: "14px", color: "rgba(255,255,255,0.45)", fontWeight: 500, transition: "color 0.2s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#FF4422")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)")}
              >
                info@383media.com
              </a>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                🇽🇰 Prishtinë, Kosovë
              </span>
            </div>

            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", margin: "0 0 16px" }}>
              RRJETET SOCIALE
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
              {SOCIAL.map(({ label, handle, Icon }) => (
                <a
                  key={label}
                  href="#"
                  style={{
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#FF4422")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)")}
                >
                  <Icon />
                  {handle}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            padding: "24px 0 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: "12px",
          }}
        >
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", margin: 0 }}>
            © {new Date().getFullYear()} 383 Media · Të gjitha të drejtat e rezervuara
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.12)", margin: 0 }}>
            Kodifikuar me ♥ në Prishtinë
          </p>
        </div>
      </div>
    </footer>
  );
}
