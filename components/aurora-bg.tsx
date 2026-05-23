"use client";

export default function TextureBg() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Orange blob — top-left */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          left: "-150px",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,68,34,0.22) 0%, rgba(255,68,34,0.07) 45%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float-1 14s ease-in-out infinite alternate",
        }}
      />
      {/* Blue blob — top-right */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-100px",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,71,255,0.18) 0%, rgba(0,71,255,0.06) 45%, transparent 70%)",
          filter: "blur(70px)",
          animation: "float-2 11s ease-in-out infinite alternate",
        }}
      />
      {/* Emerald blob — center */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "30%",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,166,81,0.13) 0%, rgba(0,166,81,0.04) 45%, transparent 70%)",
          filter: "blur(80px)",
          animation: "float-3 16s ease-in-out infinite alternate",
        }}
      />
      {/* Violet blob — bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: "-100px",
          left: "8%",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.05) 45%, transparent 70%)",
          filter: "blur(70px)",
          animation: "float-4 13s ease-in-out infinite alternate",
        }}
      />
      {/* Rose blob — bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: "-80px",
          right: "5%",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(233,30,140,0.18) 0%, rgba(233,30,140,0.05) 45%, transparent 70%)",
          filter: "blur(65px)",
          animation: "float-1 10s ease-in-out 4s infinite alternate",
        }}
      />
    </div>
  );
}
