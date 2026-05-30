"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AuthModal from "./auth-modal";

type Tab = "hyr" | "regjistrohu";

function getInitials(user: User): string {
  const name = user.user_metadata?.full_name as string | undefined;
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return (user.email ?? "?").slice(0, 2).toUpperCase();
}

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modal, setModal] = useState<Tab | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If env vars are missing, show logged-out UI (buttons still visible, just non-functional)
    if (!url || !key) {
      setReady(true);
      return;
    }

    const supabase = createClient();
    supabaseRef.current = supabase;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user);
        setReady(true);
      })
      .catch(() => {
        // Network/config error — still show logged-out UI
        setReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  async function handleSignOut() {
    setDropdownOpen(false);
    await supabaseRef.current?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!ready) return <div style={{ width: "72px" }} />;

  if (!user) {
    return (
      <>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setModal("hyr")}
            style={{
              padding: "7px 16px",
              borderRadius: "100px",
              border: "1.5px solid rgba(17,17,17,0.2)",
              background: "transparent",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              color: "#111",
              fontFamily: "var(--font-manrope), sans-serif",
              letterSpacing: "0.03em",
            }}
          >
            Hyr
          </button>
          <button
            onClick={() => setModal("regjistrohu")}
            style={{
              padding: "7px 16px",
              borderRadius: "100px",
              border: "none",
              background: "#111",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              color: "#fff",
              fontFamily: "var(--font-manrope), sans-serif",
              letterSpacing: "0.03em",
            }}
          >
            Regjistrohu
          </button>
        </div>
        {modal && <AuthModal defaultTab={modal} onClose={() => setModal(null)} />}
      </>
    );
  }

  const initials = getInitials(user);

  return (
    <>
      <div ref={dropdownRef} style={{ position: "relative" }}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#FF4422",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 800,
            color: "#fff",
            fontFamily: "var(--font-manrope), sans-serif",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
          title={user.user_metadata?.full_name ?? user.email ?? ""}
        >
          {initials}
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              background: "#fff",
              border: "1.5px solid #E8E3DB",
              borderRadius: "14px",
              padding: "6px",
              minWidth: "180px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
              zIndex: 100,
            }}
          >
            <div
              style={{
                padding: "10px 12px 8px",
                borderBottom: "1px solid #F0ECE6",
                marginBottom: "4px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#111",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.user_metadata?.full_name ?? "Profili"}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "#999",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.email}
              </p>
            </div>
            <button
              onClick={() => {
                setDropdownOpen(false);
                router.push("/profili");
              }}
              style={menuItemStyle}
            >
              Profili im
            </button>
            <button onClick={handleSignOut} style={{ ...menuItemStyle, color: "#e53e3e" }}>
              Dil
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 600,
  color: "#111",
  cursor: "pointer",
  fontFamily: "var(--font-manrope), sans-serif",
};
