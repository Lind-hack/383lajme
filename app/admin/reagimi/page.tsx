import { cookies } from "next/headers";
import { isAdminAuthed } from "@/lib/admin-auth";
import { totpEnabled } from "@/lib/admin-totp";
import { createClient } from "@/lib/supabase/server";
import {
  dateKeyInKosovo,
  formatAlbanianDate,
  shiftDateKey,
  youtubeId,
} from "@/lib/reagimi-data";
import { loginAction, logoutAction, saveReagimiAction, clearReagimiAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  auth: "Fjalëkalim i gabuar.",
  required: "Citati dhe emri i folësit janë të detyrueshëm.",
  long: "Njëra nga fushat është shumë e gjatë.",
  video: "Linku i videos nuk njihet. Përdor një link YouTube.",
  nokey: "Mungon SUPABASE_SERVICE_ROLE_KEY. Ruajtja nuk mund të kryhet.",
  save: "Ruajtja dështoi. Provo përsëri.",
};

export default async function AdminReagimiPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; saved?: string; cleared?: string; d?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const isAuthed = await isAdminAuthed();

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

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#6B6B6B",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "8px",
  };

  const hintStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    color: "#9a9a9a",
    fontWeight: 500,
    marginTop: "6px",
    letterSpacing: 0,
    textTransform: "none",
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

  const logo = (
    <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
      <span style={{ fontSize: "24px", fontWeight: 900, color: "#111", letterSpacing: "-0.03em" }}>
        383
      </span>
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

  if (!isAuthed) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            {logo}
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 600 }}>
              Admin · Reagimi
            </span>
          </div>

          {params.err && (
            <p style={{ color: "#e53e3e", fontSize: "13px", margin: "0 0 16px" }}>
              {ERRORS[params.err] ?? ERRORS.save}
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
            {totpEnabled() && (
              <input
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Kodi 6-shifror"
                required
                style={inputStyle}
              />
            )}
            <button type="submit" style={submitBtnStyle}>
              Hyr
            </button>
          </form>
        </div>
      </div>
    );
  }

  const today = dateKeyInKosovo();
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(params.d ?? "") ? (params.d as string) : today;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reagimi_daily")
    .select("quote, speaker_name, speaker_role, context_line, article_slug, video_url")
    .eq("reagimi_date", targetDate)
    .maybeSingle();

  const dayLabel = formatAlbanianDate(targetDate);
  const isToday = targetDate === today;

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: "600px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {logo}
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 600 }}>
              Admin · Reagimi i Ditës
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#999",
                fontFamily: "var(--font-manrope), sans-serif",
              }}
            >
              Dilni
            </button>
          </form>
        </div>

        <p
          style={{
            margin: "0 0 4px",
            fontSize: "12px",
            color: "#aaa",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {dayLabel} · {targetDate} {isToday ? "" : "(datë e ardhshme)"}
        </p>

        <div style={{ display: "flex", gap: "10px", margin: "0 0 20px" }}>
          <a
            href={`/admin/reagimi?d=${today}`}
            style={{ fontSize: "12px", color: isToday ? "#111" : "#FF4422", fontWeight: 700 }}
          >
            Sot
          </a>
          <a
            href={`/admin/reagimi?d=${shiftDateKey(today, 1)}`}
            style={{ fontSize: "12px", color: "#FF4422", fontWeight: 700 }}
          >
            Nesër
          </a>
        </div>

        <p
          style={{
            margin: "0 0 20px",
            fontSize: "12px",
            color: "#6B6B6B",
            lineHeight: 1.55,
            background: "#FAFAF8",
            border: "1px solid #E8E3DB",
            borderRadius: "10px",
            padding: "10px 12px",
          }}
        >
          {existing
            ? "Kjo ditë është e kuruar. Ndryshimet zëvendësojnë atë që është publikuar."
            : "Kjo ditë nuk është e kuruar. Faqja po tregon automatikisht një artikull të sotëm."}
        </p>

        {params.saved === "1" && (
          <p
            style={{
              color: "#22863a",
              fontSize: "13px",
              padding: "10px 14px",
              background: "#f0fff4",
              borderRadius: "8px",
              margin: "0 0 20px",
            }}
          >
            U ruajt me sukses.
          </p>
        )}
        {params.cleared === "1" && (
          <p
            style={{
              color: "#6B6B6B",
              fontSize: "13px",
              padding: "10px 14px",
              background: "#FAFAF8",
              borderRadius: "8px",
              margin: "0 0 20px",
            }}
          >
            U fshi. Faqja kthehet te zgjedhja automatike.
          </p>
        )}
        {params.err && (
          <p style={{ color: "#e53e3e", fontSize: "13px", margin: "0 0 16px" }}>
            {ERRORS[params.err] ?? ERRORS.save}
          </p>
        )}

        <form action={saveReagimiAction} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <input type="hidden" name="reagimi_date" value={targetDate} />

          <div>
            <label htmlFor="quote" style={labelStyle}>
              Citati
            </label>
            <textarea
              id="quote"
              name="quote"
              defaultValue={existing?.quote ?? ""}
              rows={3}
              required
              maxLength={400}
              placeholder="Çfarë u tha, fjalë për fjalë"
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
            <span style={hintStyle}>
              Pa thonjëza. Faqja i shton vetë. Maksimumi 400 karaktere.
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="speaker_name" style={labelStyle}>
                Folësi
              </label>
              <input
                id="speaker_name"
                type="text"
                name="speaker_name"
                defaultValue={existing?.speaker_name ?? ""}
                required
                maxLength={120}
                placeholder="Emri Mbiemri"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="speaker_role" style={labelStyle}>
                Funksioni
              </label>
              <input
                id="speaker_role"
                type="text"
                name="speaker_role"
                defaultValue={existing?.speaker_role ?? ""}
                maxLength={120}
                placeholder="Ministër, analist…"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label htmlFor="context_line" style={labelStyle}>
              Konteksti
            </label>
            <input
              id="context_line"
              type="text"
              name="context_line"
              defaultValue={existing?.context_line ?? ""}
              maxLength={160}
              placeholder="Pas takimit në Bruksel"
              style={inputStyle}
            />
            <span style={hintStyle}>Rreshti i vogël mbi citatin. Opsional.</span>
          </div>

          <div>
            <label htmlFor="article_slug" style={labelStyle}>
              Artikulli
            </label>
            <input
              id="article_slug"
              type="text"
              name="article_slug"
              defaultValue={existing?.article_slug ?? ""}
              placeholder="slug-i-artikullit"
              style={inputStyle}
            />
            <span style={hintStyle}>Slug, /article/slug ose URL e plotë. Opsional.</span>
          </div>

          <div>
            <label htmlFor="video_url" style={labelStyle}>
              Video
            </label>
            <input
              id="video_url"
              type="text"
              name="video_url"
              defaultValue={existing?.video_url ?? ""}
              placeholder="https://www.youtube.com/watch?v=..."
              style={inputStyle}
            />
            <span style={hintStyle}>
              {existing?.video_url && youtubeId(existing.video_url)
                ? "Lidhur me një video."
                : "Lëre bosh dhe faqja e kërkon vetë videon."}
            </span>
          </div>

          <button type="submit" style={{ ...submitBtnStyle, marginTop: "4px" }}>
            Ruaj për {isToday ? "sot" : targetDate}
          </button>
        </form>

        {existing && (
          <form action={clearReagimiAction} style={{ marginTop: "12px" }}>
            <input type="hidden" name="reagimi_date" value={targetDate} />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                background: "none",
                border: "1.5px solid #E8E3DB",
                color: "#6B6B6B",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "var(--font-manrope), sans-serif",
              }}
            >
              Fshi dhe kthehu te zgjedhja automatike
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
