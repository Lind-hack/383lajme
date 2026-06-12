"use client";

import { BREAKING_ITEMS } from "@/lib/mock-data";

export default function BreakingTicker() {
  const items = [...BREAKING_ITEMS, ...BREAKING_ITEMS];

  return (
    <div
      style={{
        background: "#FF4422",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        height: "40px",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Label */}
      <div
        style={{
          flexShrink: 0,
          background: "rgba(0,0,0,0.2)",
          color: "#fff",
          fontWeight: 800,
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          padding: "0 18px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          zIndex: 2,
          position: "relative",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#fff",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        DREJTPËRSËDREJTI
      </div>

      {/* Scroll track */}
      <div style={{ overflow: "hidden", flex: 1, height: "100%", position: "relative" }}>
        <div
          className="ticker-track"
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            whiteSpace: "nowrap",
            willChange: "transform",
          }}
        >
          {items.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "0 36px",
                }}
              >
                {item}
              </span>
              <span
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.5)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
