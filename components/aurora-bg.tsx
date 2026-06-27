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
        contain: "layout style paint",
      }}
    >
      {/* Orange blob — top-left */}
      <div
        className="float-blob"
        style={{
          position: "absolute",
          top: "-100px",
          left: "-150px",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,68,34,0.11) 0%, rgba(255,68,34,0.035) 45%, transparent 70%)",
          filter: "blur(55px)",
          animation: "float-1 22s ease-in-out infinite alternate",
        }}
      />
      {/* Blue blob — top-right */}
      <div
        className="float-blob"
        style={{
          position: "absolute",
          top: "-80px",
          right: "-100px",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,71,255,0.09) 0%, rgba(0,71,255,0.03) 45%, transparent 70%)",
          filter: "blur(50px)",
          animation: "float-2 18s ease-in-out infinite alternate",
        }}
      />
      {/* Emerald blob — center */}
      <div
        className="float-blob"
        style={{
          position: "absolute",
          top: "30%",
          left: "30%",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,166,81,0.065) 0%, rgba(0,166,81,0.02) 45%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float-3 26s ease-in-out infinite alternate",
        }}
      />
      {/* Violet blob — bottom-left */}
      <div
        className="float-blob"
        style={{
          position: "absolute",
          bottom: "-100px",
          left: "8%",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.09) 0%, rgba(124,58,237,0.025) 45%, transparent 70%)",
          filter: "blur(50px)",
          animation: "float-4 20s ease-in-out infinite alternate",
        }}
      />
      {/* Rose blob — bottom-right */}
      <div
        className="float-blob"
        style={{
          position: "absolute",
          bottom: "-80px",
          right: "5%",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(233,30,140,0.09) 0%, rgba(233,30,140,0.025) 45%, transparent 70%)",
          filter: "blur(48px)",
          animation: "float-1 18s ease-in-out 4s infinite alternate",
        }}
      />
    </div>
  );
}
