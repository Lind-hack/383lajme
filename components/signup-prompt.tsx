"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY = "383_signup_dismissed";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function SignupPrompt() {
  const [visible, setVisible] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function setupTimer() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return;
      } catch {
        // session check failed — show popup anyway
      }
      timer = setTimeout(() => setVisible(true), 3 * 60 * 1000);
    }

    setupTimer();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setVisible(false);
        if (timer) clearTimeout(timer);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }

  function handleSignup() {
    dismiss();
    router.push("/hyr?tab=regjistrohu");
  }

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 28px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />

      {/* Popup card — centered */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          width: "calc(100% - 48px)",
          maxWidth: "420px",
          background: "#FFFFFF",
          borderRadius: "20px",
          border: "1.5px solid #E8E3DB",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
          padding: "28px 28px 24px",
          fontFamily: "var(--font-manrope), sans-serif",
          animation: "slideUp 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#111", letterSpacing: "-0.04em" }}>383</span>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#FF4422", display: "inline-block", marginBottom: "3px" }} />
          </div>
          <button
            onClick={dismiss}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#999", lineHeight: 1, padding: "4px" }}
          >
            ×
          </button>
        </div>

        {/* Headline */}
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#111", lineHeight: 1.25 }}>
          Krijoni llogarinë tuaj falas
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#6B6B6B", lineHeight: 1.6 }}>
          Qëndroni të informuar dhe ndiqni lajmet që ju interesojnë.
        </p>

        {/* Benefits toggle */}
        <button
          onClick={() => setBenefitsOpen((o) => !o)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 700,
            color: benefitsOpen ? "#FF4422" : "#FF4422",
            padding: "0 0 12px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          Shiko përfitimet
          <span
            style={{
              fontSize: "10px",
              transition: "transform 0.2s ease",
              display: "inline-block",
              transform: benefitsOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </span>
        </button>

        {/* Benefits — orange glowing panel */}
        <div
          style={{
            overflow: "hidden",
            maxHeight: benefitsOpen ? "400px" : "0",
            transition: "max-height 0.3s ease",
            marginBottom: benefitsOpen ? "16px" : "0",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #FF4422 0%, #FF6B35 100%)",
              boxShadow: "0 8px 32px rgba(255, 68, 34, 0.45)",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {[
              ["💬", "Komento lajmet dhe debatohu me komunitetin"],
              ["🔔", "Njoftimet e fundit të personalizuara"],
              ["📚", "Ruaj artikujt që të interesojnë"],
              ["🗳️", "Voto në sondazhe dhe ndrysho bisedat"],
              ["🎯", "Feed i personalizuar sipas interesave tuaja"],
              ["🏆", "Badge ekskluzive për kontribuesit aktiv"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: "13px", color: "#fff", lineHeight: 1.5, fontWeight: 600 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleSignup}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "100px",
            background: "#FF4422",
            color: "#fff",
            border: "none",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            fontFamily: "var(--font-manrope), sans-serif",
            letterSpacing: "0.04em",
            marginBottom: "10px",
          }}
        >
          Regjistrohu tani
        </button>

        {/* Dismiss link */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: "#999",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          >
            Jo faleminderit
          </button>
        </div>
      </div>
    </>
  );
}
