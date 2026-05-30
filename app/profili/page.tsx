import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, updated_at")
    .eq("id", user.id)
    .single();

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? "";
  const initials = fullName
    ? fullName.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("")
    : (user.email ?? "?").slice(0, 2).toUpperCase();

  const joinDate = new Date(user.created_at).toLocaleDateString("sq-AL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F9F6F1",
        paddingTop: "100px",
        paddingBottom: "60px",
        fontFamily: "var(--font-manrope), sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "20px",
            border: "1.5px solid #E8E3DB",
            padding: "48px 44px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#FF4422",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.04em",
              marginBottom: "16px",
            }}
          >
            {initials}
          </div>

          {fullName && (
            <h1
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 800,
                color: "#111",
                letterSpacing: "-0.02em",
                textAlign: "center",
              }}
            >
              {fullName}
            </h1>
          )}

          <p style={{ margin: 0, fontSize: "14px", color: "#888" }}>{user.email}</p>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "12px",
              color: "#bbb",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Anëtar që nga {joinDate}
          </p>

          <div style={{ width: "100%", height: "1px", background: "#F0ECE6", margin: "24px 0" }} />

          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
