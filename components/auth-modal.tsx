"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tab = "hyr" | "regjistrohu";

export default function AuthModal({
  defaultTab = "hyr",
  onClose,
}: {
  defaultTab?: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  function getSupabase(): SupabaseClient | null {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null;
    }
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function resetForm() {
    setError("");
    setSuccess("");
    setFullName("");
    setEmail("");
    setPassword("");
  }

  async function handleEmailAuth() {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Auth not configured. Add Supabase env vars.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (tab === "regjistrohu") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        onClose();
        window.location.reload();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
        window.location.reload();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ndodhi një gabim.";
      if (msg.includes("Invalid login")) setError("Email ose fjalëkalim i gabuar.");
      else if (msg.includes("already registered") || msg.includes("User already registered"))
        setError("Ky email është regjistruar tashmë.");
      else if (msg.includes("Password should be"))
        setError("Fjalëkalimi duhet të ketë të paktën 6 karaktere.");
      else if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("email rate"))
        setError("Shumë kërkesa. Provo përsëri pas disa minutash.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "facebook") {
    const supabase = getSupabase();
    if (!supabase) return;
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        const msg = error.message;
        if (msg.includes("not enabled") || msg.includes("validation_failed"))
          setError(`Hyrja me ${provider === "google" ? "Google" : "Facebook"} nuk është aktivizuar ende.`);
        else setError(msg);
        setLoading(false);
      }
    } catch {
      setError("Ndodhi një gabim. Provo përsëri.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "10px",
    border: "1.5px solid #E8E3DB",
    fontSize: "14px",
    fontFamily: "var(--font-manrope), sans-serif",
    outline: "none",
    background: "#FAFAF8",
    color: "#111",
    boxSizing: "border-box",
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#F9F6F1",
          borderRadius: "20px",
          padding: "40px 44px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.12)",
          fontFamily: "var(--font-manrope), sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#111",
                letterSpacing: "-0.03em",
              }}
            >
              383
            </span>
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "#FF4422",
                display: "inline-block",
                marginBottom: "3px",
              }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#999",
              fontSize: "20px",
              lineHeight: 1,
              padding: "4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            background: "#EEEAE4",
            borderRadius: "10px",
            padding: "3px",
            marginBottom: "24px",
          }}
        >
          {(["hyr", "regjistrohu"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                resetForm();
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#111" : "#888",
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {t === "hyr" ? "Hyr" : "Regjistrohu"}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {tab === "regjistrohu" && (
            <input
              type="text"
              placeholder="Emri i plotë"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEmailAuth();
            }}
          />
          <input
            type="password"
            placeholder="Fjalëkalimi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEmailAuth();
            }}
          />

          {error && <p style={{ color: "#e53e3e", fontSize: "13px", margin: 0 }}>{error}</p>}
          {success && <p style={{ color: "#22863a", fontSize: "13px", margin: 0 }}>{success}</p>}

          <button
            onClick={handleEmailAuth}
            disabled={loading}
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#FF4422",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.7 : 1,
              marginTop: "4px",
            }}
          >
            {loading ? "..." : tab === "hyr" ? "Hyr" : "Regjistrohu"}
          </button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: "4px 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
            <span style={{ fontSize: "12px", color: "#aaa", fontWeight: 600 }}>OSE</span>
            <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
          </div>

          {/* OAuth buttons */}
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading}
            style={{
              padding: "11px 14px",
              borderRadius: "10px",
              border: "1.5px solid #E8E3DB",
              background: "#fff",
              color: "#111",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Hyr me Google
          </button>

          <button
            onClick={() => handleOAuth("facebook")}
            disabled={loading}
            style={{
              padding: "11px 14px",
              borderRadius: "10px",
              border: "1.5px solid #E8E3DB",
              background: "#fff",
              color: "#111",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect width="18" height="18" rx="4" fill="#1877F2" />
              <path
                d="M12.5 9H10.5V15H8V9H6.5V7H8V5.5C8 4.12 8.88 3 10.5 3H12.5V5H11C10.72 5 10.5 5.22 10.5 5.5V7H12.5L12 9H10.5Z"
                fill="white"
              />
            </svg>
            Hyr me Facebook
          </button>
        </div>
      </div>
    </div>
  );
}
