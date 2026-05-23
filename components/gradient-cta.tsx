"use client";

import { motion } from "framer-motion";

export default function GradientCta() {
  return (
    <section
      style={{
        background: "linear-gradient(135deg, #FF4422, #E41E20, #FF6B35, #FF4422)",
        backgroundSize: "300% 300%",
        animation: "gradient-shift 6s ease infinite",
        padding: "80px 24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Large italic headline */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
            marginBottom: "20px",
            marginTop: 0,
          }}
        >
          QËNDRO I INFORMUAR
        </p>
        <h2
          style={{
            fontSize: "clamp(36px, 6vw, 80px)",
            fontWeight: 800,
            lineHeight: 1.05,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            margin: "0 0 32px",
          }}
        >
          Bota flet{" "}
          <span
            style={{
              fontStyle: "italic",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            për Kosovën.
          </span>
        </h2>

        <p
          style={{
            fontSize: "18px",
            color: "rgba(255,255,255,0.75)",
            maxWidth: "480px",
            margin: "0 auto 40px",
            lineHeight: 1.6,
            fontWeight: 400,
          }}
        >
          Lajmet kryesore ndërkombëtare, të filtruar dhe analizuar çdo ditë.
        </p>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
          whileTap={{ scale: 0.98 }}
          style={{
            background: "#FFFFFF",
            color: "#FF4422",
            border: "none",
            borderRadius: "100px",
            padding: "16px 40px",
            fontSize: "14px",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Regjistrohu →
        </motion.button>
      </motion.div>
    </section>
  );
}
