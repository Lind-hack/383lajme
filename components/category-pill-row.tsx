"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { CATEGORY_COLORS, DEFAULT_COLOR } from "@/lib/category-colors";

const CATEGORIES = [
  { label: "Të gjitha", href: "/", color: "#111111" },
  { label: "Politikë", href: "/kategori/politike" },
  { label: "Ekonomi", href: "/kategori/ekonomi" },
  { label: "Botë", href: "/kategori/bote" },
  { label: "Siguri", href: "/kategori/siguri" },
  { label: "Sport", href: "/kategori/sport" },
  { label: "Teknologji", href: "/kategori/teknologji" },
  { label: "Kulturë", href: "/kategori/kulture" },
  { label: "Shoqëri", href: "/kategori/shoqeri" },
  { label: "Showbiz", href: "/kategori/showbiz" },
];

export default function CategoryPillRow() {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("Të gjitha");

  return (
    <div style={{ position: "relative" }}>
      <div ref={constraintsRef} style={{ overflow: "hidden" }}>
        <motion.div
          drag="x"
          dragConstraints={constraintsRef}
          dragElastic={0.1}
          style={{
            display: "flex",
            gap: "8px",
            cursor: "grab",
            userSelect: "none",
            paddingBottom: "4px",
          }}
          whileDrag={{ cursor: "grabbing" }}
        >
          {CATEGORIES.map((cat) => {
            const color = cat.color ?? (CATEGORY_COLORS[cat.label] || DEFAULT_COLOR);
            const isActive = active === cat.label;
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);

            return (
              <Link
                key={cat.label}
                href={cat.href}
                onClick={() => setActive(cat.label)}
                style={{ textDecoration: "none", flexShrink: 0 }}
              >
                <motion.span
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 20px",
                    borderRadius: "100px",
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
                    background: isActive ? color : `rgba(${r},${g},${b},0.1)`,
                    color: isActive ? "#FFFFFF" : color,
                    border: `1.5px solid ${isActive ? color : `rgba(${r},${g},${b},0.25)`}`,
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: isActive ? "#FFFFFF" : color,
                      flexShrink: 0,
                    }}
                  />
                  {cat.label}
                </motion.span>
              </Link>
            );
          })}
        </motion.div>
      </div>

      {/* Fade-out edges */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "60px",
          height: "100%",
          background: "linear-gradient(to right, transparent, #F9F6F1)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
