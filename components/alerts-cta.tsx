"use client";

import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { EASE, DUR } from "@/lib/tokens";

export default function AlertsCta() {
  const isMobile = useIsMobile();
  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: DUR.reveal, ease: EASE }}
        style={{
          background: "linear-gradient(135deg, #111111 0%, #1A1A1A 100%)",
          borderRadius: "24px",
          padding: "clamp(28px, 5vw, 48px) clamp(20px, 4vw, 40px)",
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Background glow */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-60px",
            right: "-40px",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(255,68,34,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "clamp(24px, 4vw, 48px)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Left: copy */}
          <div style={{ flex: 1, minWidth: "min(260px, 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#FF4422",
                  display: "inline-block",
                  boxShadow: "0 0 8px rgba(255,68,34,0.8)",
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  color: "#FF4422",
                }}
              >
                Njoftime të Menjëhershme
              </span>
            </div>

            <h2
              style={{
                fontSize: "22px",
                fontWeight: 800,
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
                margin: "0 0 12px",
              }}
            >
              Mos Humb Asnjë Lajm
            </h2>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.55)",
                margin: "0 0 28px",
              }}
            >
              Merr njoftime të menjëhershme kur bota flet për Kosovën — direkt në WhatsApp ose Telegram, në shqip.
            </p>

            {/* CTA buttons */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <motion.a
                href="#"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: DUR.base, ease: EASE }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "13px 22px",
                  borderRadius: "100px",
                  flex: "1 1 auto",
                  justifyContent: "center",
                  background: "#25D366",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  boxShadow: "0 4px 16px rgba(37,211,102,0.35)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp
              </motion.a>

              <motion.a
                href="#"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: DUR.base, ease: EASE }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "13px 22px",
                  borderRadius: "100px",
                  flex: "1 1 auto",
                  justifyContent: "center",
                  background: "#2AABEE",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  boxShadow: "0 4px 16px rgba(42,171,238,0.35)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Telegram
              </motion.a>
            </div>
          </div>

          {/* Right: message preview — hidden on mobile */}
          {!isMobile && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DUR.reveal, delay: 0.15, ease: EASE }}
              style={{ flexShrink: 0 }}
            >
              {/* Phone-like preview */}
              <div
                style={{
                  width: "280px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "20px",
                  padding: "20px",
                }}
              >
                {/* Bubble header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "14px",
                    paddingBottom: "14px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#FF4422",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#FFFFFF",
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF" }}>383 Lajme</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Bot · Online</div>
                  </div>
                </div>

                {/* Example notification bubble */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: "12px 12px 12px 4px",
                    padding: "12px 14px",
                    marginBottom: "8px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.6,
                      color: "rgba(255,255,255,0.75)",
                      margin: "0 0 6px",
                    }}
                  >
                    🔔 <strong style={{ color: "#FF4422" }}>LAJM I FUNDIT</strong>
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.6,
                      color: "rgba(255,255,255,0.75)",
                      margin: 0,
                    }}
                  >
                    [BBC] sapo publikoi për Kosovën — Takimet mes Kurtit dhe Vuçiçit rifillojnë pas ndërhyrjes së BE-së...
                  </p>
                </div>

                <div style={{ textAlign: "right" as const }}>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>09:14 ✓✓</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
