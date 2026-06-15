"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        padding: "11px 32px",
        borderRadius: "100px",
        border: "1.5px solid rgba(229,62,62,0.4)",
        background: "transparent",
        color: "#e53e3e",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "var(--font-manrope), sans-serif",
        letterSpacing: "0.03em",
      }}
    >
      Dil nga llogaria
    </button>
  );
}
