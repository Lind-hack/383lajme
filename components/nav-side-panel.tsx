"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, MapPin, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { NAV_LINKS } from "./navbar";
import {
  InfoCard,
  InfoCardContent,
  InfoCardTitle,
  InfoCardDescription,
  InfoCardMedia,
  InfoCardFooter,
  InfoCardDismiss,
  InfoCardAction,
} from "./ui/info-card";

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

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NavSidePanel({ open, onClose }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [catsOpen, setCatsOpen] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Supabase auth (same pattern as user-menu.tsx)
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient();
    supabaseRef.current = supabase;

    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user))
      .catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Esc to close + body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  async function handleSignOut() {
    onClose();
    await supabaseRef.current?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Dim overlay */}
      <div
        className={`side-panel-overlay${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        className={`side-panel${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "20px 22px 24px",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#9C9C9C",
              }}
            >
              Menu
            </span>
            <button
              onClick={onClose}
              aria-label="Mbyll menunë"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                border: "1.5px solid #E8E3DB",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#111",
                flexShrink: 0,
              }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Categories — collapsible animated dropdown */}
          <button
            onClick={() => setCatsOpen((v) => !v)}
            aria-expanded={catsOpen}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: 0,
              marginBottom: "10px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#C4BDB1",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          >
            <span>Kategoritë</span>
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              style={{
                transform: catsOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
                color: "#FF4422",
              }}
            />
          </button>
          <AnimatePresence initial={false}>
            {catsOpen && (
              <motion.nav
                key="cats"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  overflow: "hidden",
                }}
              >
                {NAV_LINKS.map((link) => {
                  const active =
                    pathname === link.href || pathname?.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      className="glossy-orange side-panel-link"
                      aria-current={active ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </motion.nav>
            )}
          </AnimatePresence>

          {/* Kosovo tag */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "20px",
              paddingTop: "20px",
              borderTop: "1px solid #E8E3DB",
              color: "#6B6B6B",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <MapPin size={14} strokeWidth={2.5} color="#FF4422" />
            <span>KOSOVË</span>
          </div>

          {/* Bottom area (pinned): tutorial card + profile/auth */}
          <div style={{ marginTop: "auto", paddingTop: "28px" }}>
            {/* How-to-use tutorial card (hover to expand the walkthrough video) */}
            <div style={{ marginBottom: "16px" }}>
              <InfoCard
                dismissType="forever"
                storageKey="383-tutorial-dismissed"
                className="border-[#E8E3DB]"
              >
                <InfoCardContent>
                  <InfoCardTitle className="text-[#111]">
                    Si të përdoret 383
                  </InfoCardTitle>
                  <InfoCardDescription className="text-[#9C9C9C]">
                    Shfletoni kategoritë, ruani lajme dhe personalizoni.
                  </InfoCardDescription>
                  <InfoCardMedia
                    media={[
                      {
                        // TODO: swap for a real 383 walkthrough clip
                        type: "video",
                        src: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
                        autoPlay: true,
                        loop: true,
                        muted: true,
                      },
                    ]}
                  />
                  <InfoCardFooter className="text-[#9C9C9C]">
                    <InfoCardDismiss className="text-[#9C9C9C]">
                      Mbylle
                    </InfoCardDismiss>
                    <InfoCardAction>
                      <Link
                        href="/rreth-nesh"
                        onClick={onClose}
                        className="flex flex-row items-center gap-1 underline text-[#FF4422]"
                      >
                        Mëso më shumë <ExternalLink size={12} />
                      </Link>
                    </InfoCardAction>
                  </InfoCardFooter>
                </InfoCardContent>
              </InfoCard>
            </div>

            {user ? (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1.5px solid #E8E3DB",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      background: "#FF4422",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "15px",
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(user)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
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
                        fontSize: "12px",
                        color: "#999",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/profili");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "100px",
                      border: "1.5px solid rgba(17,17,17,0.18)",
                      background: "transparent",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#111",
                      cursor: "pointer",
                      fontFamily: "var(--font-manrope), sans-serif",
                    }}
                  >
                    Profili im
                  </button>
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "100px",
                      border: "1.5px solid rgba(229,62,62,0.3)",
                      background: "transparent",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#e53e3e",
                      cursor: "pointer",
                      fontFamily: "var(--font-manrope), sans-serif",
                    }}
                  >
                    Dil
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link
                  href="/hyr"
                  onClick={onClose}
                  className="btn-outline"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "11px 16px",
                    borderRadius: "100px",
                    border: "1.5px solid rgba(17,17,17,0.2)",
                    background: "transparent",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#111",
                    textDecoration: "none",
                  }}
                >
                  Hyr
                </Link>
                <Link
                  href="/hyr?tab=regjistrohu"
                  onClick={onClose}
                  className="btn-primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "11px 16px",
                    borderRadius: "100px",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#fff",
                    textDecoration: "none",
                  }}
                >
                  Regjistrohu
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
