"use client";

import Link from "next/link";
import { Heart, MapPin, MessageCircle, Send } from "lucide-react";
import { NAV_CATEGORIES } from "@/lib/category-map";
import { TELEGRAM_CHANNEL_URL, WHATSAPP_CHANNEL_URL } from "@/lib/channels";

const FOOTER_CATEGORIES = NAV_CATEGORIES.map(({ label, slug }) => ({
  label,
  href: `/kategori/${slug}`,
}));

// Everything that left the homepage at launch stays one tap away here.
const FEATURE_LINKS = [
  { label: "Për ty", href: "/per-ty" },
  { label: "Tregu", href: "/tregu" },
  { label: "Edicioni video", href: "/video" },
  { label: "Bota për Kosovën", href: "/bota-per-kosoven" },
  { label: "Kosova në xhep", href: "/visit" },
];

const COMPANY_LINKS = [
  { label: "Rreth nesh", href: "/rreth-nesh" },
  { label: "Kontakti", href: "/kontakt" },
  { label: "Privatësia", href: "/privatesia" },
  { label: "Kushtet", href: "/kushtet" },
];

// 383's real channels. The Instagram, TikTok and Facebook rows linked to "#"
// and went nowhere; they come back once those accounts have addresses.
const SOCIAL = [
  { label: "WhatsApp", handle: "Kanali në WhatsApp", href: WHATSAPP_CHANNEL_URL, Icon: MessageCircle },
  { label: "Telegram", handle: "@Lajmet383", href: TELEGRAM_CHANNEL_URL, Icon: Send },
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
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", margin: "0 0 28px", fontWeight: 400, maxWidth: "280px", lineHeight: 1.75 }}>
              Lajmet kryesore ndërkombëtare, të filtruar dhe analizuar çdo ditë për Kosovën.
              Llogaria juaj (me Google ose Facebook) përdoret vetëm për identifikim — emrin dhe
              email-in tuaj — dhe për të personalizuar përvojën tuaj në 383.
            </p>

            <Link href="/#newsletter" className="footer-link" style={{ display: "inline-block", marginBottom: "28px", fontSize: "14px", textDecoration: "underline", textUnderlineOffset: "4px" }}>
              Përmbledhja javore në email →
            </Link>

            <div style={{ display: "flex", gap: "14px" }}>
              {SOCIAL.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="footer-social"
                  style={{ display: "inline-flex" }}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Categories */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.65)", margin: "0 0 20px" }}>
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

          {/* Col 3 — Features, then the company pages */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.65)", margin: "0 0 20px" }}>
              VEÇORITË
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px", marginBottom: "32px" }}>
              {FEATURE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="footer-link"
                  style={{ textDecoration: "none", fontSize: "14px", fontWeight: 600 }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.65)", margin: "0 0 20px" }}>
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
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.65)", margin: "0 0 20px" }}>
              KONTAKTI
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px", marginBottom: "32px" }}>
              <a
                href="mailto:info@383ks.com"
                className="footer-contact"
                style={{ textDecoration: "none", fontSize: "14px", fontWeight: 500 }}
              >
                info@383ks.com
              </a>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                <MapPin size={14} strokeWidth={2} color="#FF4422" aria-hidden="true" />
                Prishtinë, Kosovë
              </span>
            </div>

            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.65)", margin: "0 0 16px" }}>
              RRJETET SOCIALE
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
              {SOCIAL.map(({ label, handle, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
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
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
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
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", margin: 0 }}>
            © {new Date().getFullYear()} 383 Media · Të gjitha të drejtat e rezervuara
          </p>
          <p style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "rgba(255,255,255,0.65)", margin: 0 }}>
            Kodifikuar me
            <Heart size={11} fill="#FF4422" color="#FF4422" aria-hidden="true" />
            në Prishtinë
          </p>
        </div>
      </div>
    </footer>
  );
}
