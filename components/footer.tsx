"use client";

import Link from "next/link";
import { ArrowRight, Facebook, Heart, Instagram, MapPin } from "lucide-react";

const FOOTER_CATEGORIES = [
  { label: "Politikë", href: "/kategori/politike" },
  { label: "Ekonomi", href: "/kategori/ekonomi" },
  { label: "Botë", href: "/kategori/bote" },
  { label: "Siguri", href: "/kategori/siguri" },
  { label: "Teknologji", href: "/kategori/teknologji" },
  { label: "Showbiz", href: "/kategori/showbiz" },
];

const COMPANY_LINKS = [
  { label: "Rreth nesh", href: "/rreth-nesh" },
  { label: "Kontakti", href: "/kontakt" },
  { label: "Karriera", href: "/karriera" },
  { label: "Privatësia", href: "/privatesia" },
  { label: "Kushtet", href: "/kushtet" },
];

function InstagramIcon() {
  return <Instagram size={18} strokeWidth={2} aria-hidden="true" />;
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.53V6.79a4.85 4.85 0 01-1.01-.1z" />
    </svg>
  );
}

function FacebookIcon() {
  return <Facebook size={18} strokeWidth={2} aria-hidden="true" />;
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
          className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{ marginBottom: "60px" }}
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
                  borderRadius: "var(--radius-pill)",
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
                className="footer-submit"
                aria-label="Regjistrohu"
                style={{
                  padding: "10px 20px",
                  borderRadius: "var(--radius-pill)",
                  background: "#FF4422",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "14px" }}>
              {SOCIAL.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="footer-social"
                  style={{ display: "inline-flex" }}
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
              {FOOTER_CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="footer-link"
                  style={{
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {cat.label}
                </Link>
              ))}
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
                  className="footer-link"
                  style={{
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
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
                className="footer-contact"
                style={{ textDecoration: "none", fontSize: "14px", fontWeight: 500 }}
              >
                info@383media.com
              </a>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                <MapPin size={14} strokeWidth={2} color="#FF4422" aria-hidden="true" />
                Prishtinë, Kosovë
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
                  className="footer-social"
                  style={{
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
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
          <p style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "rgba(255,255,255,0.12)", margin: 0 }}>
            Kodifikuar me
            <Heart size={11} fill="#FF4422" color="#FF4422" aria-hidden="true" />
            në Prishtinë
          </p>
        </div>
      </div>
    </footer>
  );
}
