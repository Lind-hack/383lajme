"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/navbar";
import { EASE, DUR, FONT } from "@/lib/tokens";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tab = "hyr" | "regjistrohu";

export default function HyrPage() {
  return (
    <Suspense>
      <HyrForm />
    </Suspense>
  );
}

function HyrForm() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") === "regjistrohu" ? "regjistrohu" : "hyr") as Tab;

  const [tab, setTab] = useState<Tab>(initialTab);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const router = useRouter();
  const supabaseRef = useRef<SupabaseClient | null>(null);

  function getSupabase(): SupabaseClient | null {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace("/");
    });
  }, [router]);

  function resetForm() {
    setError("");
    setFullName("");
    setEmail("");
    setPassword("");
  }

  async function handleEmailAuth() {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Auth not configured.");
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
        router.push("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
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

  function inputStyle(name: string): React.CSSProperties {
    const isFocused = focused === name;
    return {
      width: "100%",
      padding: "12px 14px",
      borderRadius: "var(--radius-sm)",
      border: `1.5px solid ${isFocused ? "#FF4422" : "#E8E3DB"}`,
      fontSize: "14px",
      fontFamily: "var(--font-manrope), sans-serif",
      outline: "none",
      background: "#FAFAF8",
      color: "#111",
      boxSizing: "border-box",
      transition: "border-color 150ms ease, box-shadow 150ms ease",
      boxShadow: isFocused ? "0 0 0 3px rgba(255,68,34,0.12)" : "none",
    };
  }

  const oauthButtonStyle: React.CSSProperties = {
    padding: "11px 14px",
    borderRadius: "var(--radius-sm)",
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
    width: "100%",
  };

  return (
    <>
      <Navbar />
      <div
        style={{
          minHeight: "100vh",
          background: "#F9F6F1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          paddingTop: "calc(var(--nav-h) + 16px)",
          fontFamily: "var(--font-manrope), sans-serif",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.reveal, ease: EASE }}
          style={{
            background: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            padding: "40px 44px",
            width: "100%",
            maxWidth: "440px",
            boxShadow: "var(--shadow-2)",
            border: "1.5px solid #E8E3DB",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 900, color: "#111", letterSpacing: "-0.04em" }}>383</span>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF4422", display: "inline-block", marginBottom: "3px" }} />
          </div>

          {/* Greeting */}
          <p style={{ fontFamily: FONT.serif, fontStyle: "italic", fontWeight: 500, fontSize: "22px", color: "#6B6B6B", margin: "0 0 28px", lineHeight: 1.3 }}>
            Mirë se erdhe.
          </p>

          {/* Tabs — framer layoutId active pill */}
          <div
            style={{
              display: "flex",
              background: "#EEEAE4",
              borderRadius: "var(--radius-sm)",
              padding: "3px",
              marginBottom: "24px",
              position: "relative",
            }}
          >
            {(["hyr", "regjistrohu"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); resetForm(); }}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "calc(var(--radius-sm) - 3px)",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: "transparent",
                  color: tab === t ? "#111" : "#888",
                  position: "relative",
                  zIndex: 1,
                  transition: "color 150ms ease",
                }}
              >
                {tab === t && (
                  <motion.div
                    layoutId="tab-pill"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#fff",
                      borderRadius: "calc(var(--radius-sm) - 3px)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      zIndex: -1,
                    }}
                    transition={{ duration: DUR.base, ease: EASE }}
                  />
                )}
                {t === "hyr" ? "Hyr" : "Regjistrohu"}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <AnimatePresence>
              {tab === "regjistrohu" && (
                <motion.div
                  key="fullname"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DUR.base, ease: EASE }}
                  style={{ overflow: "hidden" }}
                >
                  <input
                    type="text"
                    placeholder="Emri i plotë"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onFocus={() => setFocused("fullname")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("fullname")}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={inputStyle("email")}
              onKeyDown={(e) => { if (e.key === "Enter") handleEmailAuth(); }}
            />
            <input
              type="password"
              placeholder="Fjalëkalimi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              style={inputStyle("password")}
              onKeyDown={(e) => { if (e.key === "Enter") handleEmailAuth(); }}
            />

            {/* Fixed-height error slot — prevents layout shift */}
            <div style={{ minHeight: "20px" }}>
              {error && (
                <p style={{ color: "#e53e3e", fontSize: "13px", margin: 0 }}>{error}</p>
              )}
            </div>

            <motion.button
              onClick={handleEmailAuth}
              disabled={loading}
              whileHover={loading ? {} : { y: -2, boxShadow: "0 6px 20px rgba(255,68,34,0.25)" }}
              whileTap={loading ? {} : { scale: 0.98 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{
                padding: "13px",
                borderRadius: "var(--radius-sm)",
                background: "#FF4422",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: loading ? 0.7 : 1,
                width: "100%",
              }}
            >
              {loading ? "..." : tab === "hyr" ? "Hyr" : "Regjistrohu"}
            </motion.button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
              <span style={{ fontSize: "12px", color: "#aaa", fontWeight: 600 }}>OSE</span>
              <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
            </div>

            {/* Google */}
            <motion.button
              onClick={() => handleOAuth("google")}
              disabled={loading}
              whileHover={loading ? {} : { y: -2 }}
              whileTap={loading ? {} : { scale: 0.98 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={oauthButtonStyle}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Hyr me Google
            </motion.button>

            {/* Facebook */}
            <motion.button
              onClick={() => handleOAuth("facebook")}
              disabled={loading}
              whileHover={loading ? {} : { y: -2 }}
              whileTap={loading ? {} : { scale: 0.98 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={oauthButtonStyle}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect width="18" height="18" rx="4" fill="#1877F2" />
                <path d="M12.5 9H10.5V15H8V9H6.5V7H8V5.5C8 4.12 8.88 3 10.5 3H12.5V5H11C10.72 5 10.5 5.22 10.5 5.5V7H12.5L12 9H10.5Z" fill="white" />
              </svg>
              Hyr me Facebook
            </motion.button>
          </div>

          {/* Back link with lucide ArrowLeft */}
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <motion.button
              onClick={() => router.push("/")}
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#999",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Kthehu te faqja kryesore
            </motion.button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
