import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPoll } from "@/lib/polls-data";
import { loginAction, savePollAction, logoutAction } from "./actions";

export default async function AdminPollPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get("poll_admin_auth")?.value === "1";

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#F9F6F1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    fontFamily: "var(--font-manrope), sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: "20px",
    border: "1.5px solid #E8E3DB",
    padding: "40px 44px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  };

  const logo = (
    <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
      <span style={{ fontSize: "24px", fontWeight: 900, color: "#111", letterSpacing: "-0.03em" }}>383</span>
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "#FF4422",
          display: "inline-block",
          marginBottom: "2px",
        }}
      />
    </div>
  );

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

  const submitBtnStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "10px",
    background: "#FF4422",
    color: "#fff",
    border: "none",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "var(--font-manrope), sans-serif",
    width: "100%",
  };

  if (!isAuthed) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            {logo}
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 600 }}>Admin · Sondazhi</span>
          </div>

          {params.err === "1" && (
            <p style={{ color: "#e53e3e", fontSize: "13px", margin: "0 0 16px" }}>
              Fjalëkalim i gabuar.
            </p>
          )}

          <form action={loginAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="password"
              name="password"
              placeholder="Fjalëkalimi i adminit"
              required
              autoFocus
              style={inputStyle}
            />
            <button type="submit" style={submitBtnStyle}>
              Hyr
            </button>
          </form>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const { data: adminPoll } = await supabase
    .from("daily_polls")
    .select("question, options")
    .eq("poll_date", today)
    .single();

  let currentQuestion: string;
  let currentOptions: string[];

  if (adminPoll) {
    currentQuestion = adminPoll.question;
    currentOptions = adminPoll.options as string[];
  } else {
    const def = getDefaultPoll(today);
    currentQuestion = def.question;
    currentOptions = def.options;
  }

  const paddedOptions = [...currentOptions, "", "", ""].slice(0, 4);

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: "580px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {logo}
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 600 }}>Admin · Sondazhi i Ditës</span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#999", fontFamily: "var(--font-manrope), sans-serif" }}
            >
              Dilni
            </button>
          </form>
        </div>

        <p style={{ margin: "0 0 24px", fontSize: "12px", color: "#aaa", fontWeight: 600, letterSpacing: "0.06em" }}>
          {today}
        </p>

        {params.saved === "1" && (
          <p style={{ color: "#22863a", fontSize: "13px", padding: "10px 14px", background: "#f0fff4", borderRadius: "8px", margin: "0 0 20px" }}>
            Sondazhi u ruajt me sukses!
          </p>
        )}
        {params.err === "save" && (
          <p style={{ color: "#e53e3e", fontSize: "13px", margin: "0 0 16px" }}>
            Duhen të paktën 2 opsione.
          </p>
        )}

        <form action={savePollAction} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 700,
                color: "#6B6B6B",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Pyetja
            </label>
            <textarea
              name="question"
              defaultValue={currentQuestion}
              rows={3}
              required
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#6B6B6B",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Opsionet (min 2, max 4)
            </label>
            {paddedOptions.map((opt, i) => (
              <input
                key={i}
                type="text"
                name={`opt${i}`}
                defaultValue={opt}
                placeholder={i < 2 ? `Opsioni ${i + 1} *` : `Opsioni ${i + 1} (opsional)`}
                style={inputStyle}
              />
            ))}
          </div>

          <button type="submit" style={{ ...submitBtnStyle, marginTop: "4px" }}>
            Ruaj për sot
          </button>
        </form>
      </div>
    </div>
  );
}
