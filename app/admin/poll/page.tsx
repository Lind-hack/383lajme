import { cookies } from "next/headers";
import { isAdminAuthed } from "@/lib/admin-auth";
import { totpEnabled } from "@/lib/admin-totp";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultPoll } from "@/lib/polls-data";
import {
  dateKeyInKosovo,
  pollFromRow,
  pollPercentages,
  previousDateKey,
  tallyFromCounts,
  voteCountLabel,
} from "@/lib/sondazhi-data.mjs";
import { MAX_OPTIONS, draftDateKey } from "@/lib/sondazhi-draft.mjs";
import { loginAction, savePollAction, logoutAction, rejectDraftAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPollPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; saved?: string; rejected?: string; date?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const isAuthed = await isAdminAuthed();

  // The login view centres itself: the layout renders no nav when unauthed.
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  };

  // The signed-in view sits under the shared nav, so it starts at the top and
  // matches the width of every other admin surface.
  const shellStyle: React.CSSProperties = {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "16px 12px 40px",
  };

  // Token values rather than hardcoded hexes, so this reads as the same tool as
  // the article, dossier and Tregu screens instead of a separate little app.
  const cardStyle: React.CSSProperties = {
    background: "var(--a-panel)",
    borderRadius: "var(--a-radius-lg)",
    border: "1px solid var(--a-border)",
    padding: "24px 26px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "var(--a-shadow-1)",
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
    padding: "8px 11px",
    borderRadius: "var(--a-radius)",
    border: "1px solid var(--a-border-strong)",
    fontSize: "13px",
    fontFamily: "inherit",
    outline: "none",
    background: "var(--a-panel)",
    color: "var(--a-ink)",
    boxSizing: "border-box",
  };

  const submitBtnStyle: React.CSSProperties = {
    padding: "0 12px",
    height: "34px",
    borderRadius: "var(--a-radius)",
    // --a-accent-fill, not #FF4422: white on the brand orange measures 3.44:1
    // and fails the 4.5:1 a 13px label needs. Same hue, darkened to 4.59:1.
    background: "var(--a-accent-fill)",
    color: "#fff",
    border: "1px solid var(--a-accent-fill)",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--a-muted)",
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    marginBottom: "5px",
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

  const todayKey = dateKeyInKosovo();
  const editingDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey;

  const supabase = createAdminClient();

  let row: Record<string, unknown> | null = null;
  let tallyCounts: number[] = [];
  let pendingDraftDate: string | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("daily_polls")
      .select("poll_date, question, options, context_line, source_article_slug, status")
      .eq("poll_date", editingDate)
      .maybeSingle();
    row = data ?? null;

    // A draft waiting for review, so it is visible without having to guess the date.
    const tomorrow = draftDateKey(todayKey);
    const { data: draftRow } = await supabase
      .from("daily_polls")
      .select("poll_date, status")
      .eq("status", "draft")
      .gte("poll_date", todayKey)
      .order("poll_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (draftRow?.poll_date && draftRow.poll_date !== editingDate) {
      pendingDraftDate = String(draftRow.poll_date);
    } else if (draftRow?.poll_date === editingDate) {
      pendingDraftDate = null;
    } else if (!draftRow && tomorrow === editingDate) {
      pendingDraftDate = null;
    }
  }

  const record = pollFromRow(row);
  const fallback = getDefaultPoll(editingDate);
  const currentQuestion = record?.question ?? fallback.question;
  const currentOptions = record?.options ?? fallback.options;
  const isDraft = record?.status === "draft";

  if (supabase) {
    const { data: day } = await supabase.rpc("sondazhi_day", {
      p_date: editingDate,
      p_voter: null,
    });
    tallyCounts = tallyFromCounts(
      (day as { counts?: Record<string, unknown> } | null)?.counts,
      currentOptions.length
    ).counts;
  }

  const total = tallyCounts.reduce((a, b) => a + b, 0);
  const percentages = pollPercentages(tallyCounts);

  const paddedOptions = [...currentOptions, "", "", ""].slice(0, MAX_OPTIONS);

  const noticeStyle = (bg: string, color: string): React.CSSProperties => ({
    color,
    fontSize: "13px",
    padding: "10px 14px",
    background: bg,
    borderRadius: "8px",
    margin: "0 0 20px",
  });

  return (
    <div style={shellStyle}>
      <div style={{ ...cardStyle, maxWidth: "680px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {logo}
            <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 600 }}>
              Admin · Sondazhi i Ditës
            </span>
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

        {/* Date switcher — the generator writes a day ahead, so editing only
            "today" made a reviewed question impossible to prepare. */}
        <div style={{ display: "flex", gap: "8px", margin: "16px 0 20px", flexWrap: "wrap" }}>
          {[
            { key: previousDateKey(todayKey), label: "Dje" },
            { key: todayKey, label: "Sot" },
            { key: draftDateKey(todayKey), label: "Nesër" },
          ].map(({ key, label }) => (
            <a
              key={key}
              href={`/admin/poll?date=${key}`}
              style={{
                padding: "6px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
                border: "1.5px solid",
                // The selected pill carries white text, so it takes the
                // darkened fill: white on #FF4422 is 3.44:1 and fails.
                borderColor: key === editingDate ? "var(--a-accent-fill)" : "var(--a-border-strong)",
                background: key === editingDate ? "var(--a-accent-fill)" : "var(--a-panel)",
                color: key === editingDate ? "#fff" : "#6B6B6B",
              }}
            >
              {label}
            </a>
          ))}
          <span style={{ alignSelf: "center", fontSize: "12px", color: "#aaa", fontWeight: 600, letterSpacing: "0.06em" }}>
            {editingDate}
          </span>
        </div>

        {params.saved === "1" && (
          <p style={noticeStyle("#f0fff4", "#22863a")}>Sondazhi u ruajt dhe u publikua.</p>
        )}
        {params.rejected === "1" && (
          <p style={noticeStyle("#F9F6F1", "#6B6B6B")}>Drafti u fshi.</p>
        )}
        {params.err === "save" && (
          <p style={{ color: "#e53e3e", fontSize: "13px", margin: "0 0 16px" }}>
            Duhen pyetja dhe të paktën 2 opsione.
          </p>
        )}
        {params.err === "write" && (
          <p style={noticeStyle("#fff5f5", "#e53e3e")}>
            Ruajtja dështoi. Provo përsëri — asgjë nuk u ndryshua.
          </p>
        )}
        {params.err === "env" && (
          <p style={noticeStyle("#fff5f5", "#e53e3e")}>
            SUPABASE_SERVICE_ROLE_KEY mungon, prandaj ruajtja nuk është e mundur.
          </p>
        )}

        {isDraft && (
          <div style={noticeStyle("#FFF8E6", "#8A6D00")}>
            <strong>Draft i pashqyrtuar.</strong> Kjo pyetje u gjenerua automatikisht dhe
            nuk shfaqet te lexuesit derisa ta ruash.
          </div>
        )}

        {pendingDraftDate && (
          <p style={noticeStyle("#FFF8E6", "#8A6D00")}>
            Ka një draft për <strong>{pendingDraftDate}</strong> që pret shqyrtim.{" "}
            <a href={`/admin/poll?date=${pendingDraftDate}`} style={{ color: "#8A6D00", fontWeight: 700 }}>
              Shqyrtoje
            </a>
          </p>
        )}

        {/* Live tally — previously invisible from the admin entirely. */}
        {total > 0 && (
          <div style={{ margin: "0 0 24px", padding: "14px 16px", background: "#F9F6F1", borderRadius: "10px" }}>
            <p style={{ ...labelStyle, marginBottom: "10px" }}>Rezultatet · {voteCountLabel(total)}</p>
            {currentOptions.map((opt, i) => (
              <div
                key={i}
                style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#44413D", padding: "3px 0" }}
              >
                <span>{opt}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {percentages[i] ?? 0}%{" "}
                  <span style={{ color: "#A9A096", fontWeight: 400 }}>({tallyCounts[i] ?? 0})</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <form action={savePollAction} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <input type="hidden" name="poll_date" value={editingDate} />

          <div>
            <label style={labelStyle}>Pyetja</label>
            <textarea
              name="question"
              defaultValue={currentQuestion}
              rows={3}
              required
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Konteksti (opsional)</label>
            <textarea
              name="context_line"
              defaultValue={record?.contextLine ?? ""}
              rows={2}
              placeholder="Një fjali: çfarë ndodhi sot dhe pse pyetja bëhet sot."
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Opsionet (min 2, max {MAX_OPTIONS})
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

          <div>
            <label style={labelStyle}>Slug-u i artikullit (opsional)</label>
            <input
              type="text"
              name="source_article_slug"
              defaultValue={record?.sourceArticleSlug ?? ""}
              placeholder="p.sh. ndertimet-prishtine"
              style={inputStyle}
            />
          </div>

          <button type="submit" style={{ ...submitBtnStyle, marginTop: "4px" }}>
            {isDraft ? "Mirato dhe publiko" : `Ruaj për ${editingDate}`}
          </button>
        </form>

        {isDraft && (
          <form action={rejectDraftAction} style={{ marginTop: "10px" }}>
            <input type="hidden" name="poll_date" value={editingDate} />
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
              Fshij draftin
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
