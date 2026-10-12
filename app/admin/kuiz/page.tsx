import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo, formatAlbanianDate, shiftDateKey } from "@/lib/reagimi-data";
import { MAX_OPTIONS, isStoredQuiz, splitPercents, type QuizQuestion } from "@/lib/kuizi-data.mjs";
import { regenerateKuiziAction, saveKuiziAction, setKuiziStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  saved: "U ruajt dhe u publikua.",
  unpublished: "Kuizi u hoq nga faqja.",
  published: "Kuizi u publikua përsëri.",
  regenerated: "U gjenerua një kuiz i ri.",
};

const ERRORS: Record<string, string> = {
  env: "Mungon SUPABASE_SERVICE_ROLE_KEY në server.",
  write: "Ruajtja dështoi. Shiko log-et e serverit.",
  shape: "Kuizi duhet të ketë 5 pyetje të plota.",
  today: "Vetëm kuizi i sotëm mund të gjenerohet përsëri.",
  answered: "Lexuesit kanë filluar të përgjigjen: redakto pyetjet në vend që ta gjenerosh përsëri.",
  gen: "Gjenerimi nuk prodhoi kuiz",
};

export default async function AdminKuizPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await isAdminAuthed())) redirect("/admin");
  const params = await searchParams;

  const todayKey = dateKeyInKosovo();
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey;
  const supabase = createAdminClient();

  let row: { status: string; source: string; questions: unknown; updated_at: string } | null = null;
  let players = 0;
  let counts: number[][] = [];
  if (supabase) {
    const { data } = await supabase
      .from("kuizi_daily")
      .select("status, source, questions, updated_at")
      .eq("kuiz_date", date)
      .maybeSingle();
    row = data ?? null;
    const { data: day } = await supabase.rpc("kuizi_day", { p_date: date, p_voter: null });
    if (day && typeof day === "object") {
      players = Number((day as { players?: unknown }).players) || 0;
      const raw = (day as { counts?: unknown }).counts;
      counts = Array.isArray(raw) ? raw.map((r) => (Array.isArray(r) ? r.map(Number) : [])) : [];
    }
  }
  const questions: QuizQuestion[] | null = row && isStoredQuiz(row.questions) ? (row.questions as QuizQuestion[]) : null;

  const errKey = Object.keys(ERRORS).find((k) => params.err === k || params.err?.startsWith("q"));
  const errText = params.err?.startsWith("q")
    ? `Pyetja ${params.err.slice(1)} nuk është e plotë: pikëpyetje, 3–4 opsione të ndryshme, një e saktë, shpjegim.`
    : errKey
      ? `${ERRORS[errKey]}${params.why ? `: ${params.why}` : "."}`
      : null;
  const okText = Object.keys(MESSAGES).find((k) => params[k] === "1");

  const box: React.CSSProperties = {
    background: "var(--a-panel)",
    border: "1px solid var(--a-border)",
    borderRadius: "var(--a-radius-lg)",
    padding: "18px 20px",
    boxShadow: "var(--a-shadow-1)",
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--a-border-strong)",
    borderRadius: "var(--a-radius)",
    font: "inherit",
    fontSize: "13px",
    background: "var(--a-panel)",
    color: "var(--a-ink)",
    boxSizing: "border-box",
  };
  const btn: React.CSSProperties = {
    height: "34px",
    padding: "0 14px",
    borderRadius: "var(--a-radius)",
    border: "1px solid var(--a-accent-fill)",
    background: "var(--a-accent-fill)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const quiet: React.CSSProperties = { ...btn, background: "transparent", color: "var(--a-ink)", borderColor: "var(--a-border-strong)" };
  const small: React.CSSProperties = { fontSize: "11px", color: "var(--a-muted)" };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "16px 12px 48px", display: "grid", gap: "14px" }}>
      <div style={{ ...box, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Kuizi i ditës · {formatAlbanianDate(date)}</h1>
          <p style={{ ...small, margin: "4px 0 0" }}>
            {row
              ? `${row.status === "published" ? "Publikuar" : row.status === "rejected" ? "I hequr nga faqja" : "Draft"} · ${row.source === "admin" ? "redaktuar nga admini" : "automatik"} · ${players} lexues janë përgjigjur`
              : "Asnjë kuiz për këtë ditë. Gjenerohet automatikisht nga ora 06:00."}
          </p>
        </div>
        <nav style={{ display: "flex", gap: "8px", fontSize: "13px" }}>
          <Link href={`/admin/kuiz?date=${shiftDateKey(date, -1)}`}>← Dita para</Link>
          {date !== todayKey && <Link href="/admin/kuiz">Sot</Link>}
          {date < todayKey && <Link href={`/admin/kuiz?date=${shiftDateKey(date, 1)}`}>Dita pas →</Link>}
        </nav>
      </div>

      {okText && <p style={{ ...box, margin: 0, color: "#1F8A4C", fontWeight: 600 }}>{MESSAGES[okText]}</p>}
      {errText && <p style={{ ...box, margin: 0, color: "#C0341A", fontWeight: 600 }}>{errText}</p>}

      {row && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <form action={setKuiziStatusAction}>
            <input type="hidden" name="kuiz_date" value={date} />
            <input type="hidden" name="status" value={row.status === "published" ? "rejected" : "published"} />
            <button type="submit" style={quiet}>
              {row.status === "published" ? "Hiqe nga faqja" : "Publikoje përsëri"}
            </button>
          </form>
          {date === todayKey && players === 0 && (
            <form action={regenerateKuiziAction}>
              <input type="hidden" name="kuiz_date" value={date} />
              <button type="submit" style={quiet}>Gjeneroje përsëri (rreth 1 minutë)</button>
            </form>
          )}
        </div>
      )}
      {!row && date === todayKey && (
        <form action={regenerateKuiziAction}>
          <input type="hidden" name="kuiz_date" value={date} />
          <button type="submit" style={btn}>Gjeneroje tani (rreth 1 minutë)</button>
        </form>
      )}

      {questions && (
        <form action={saveKuiziAction} style={{ display: "grid", gap: "14px" }}>
          <input type="hidden" name="kuiz_date" value={date} />
          {questions.map((q, i) => {
            const split = counts[i] ? splitPercents(counts[i], q.options.length) : null;
            return (
              <fieldset key={i} style={{ ...box, display: "grid", gap: "8px", margin: 0 }}>
                <legend style={{ fontWeight: 800, fontSize: "13px", padding: "0 4px" }}>
                  Pyetja {i + 1} · vështirësia {q.difficulty ?? "?"} · {q.category || "pa kategori"}
                </legend>
                <input name={`q${i}_q`} defaultValue={q.q} style={{ ...input, fontWeight: 700 }} aria-label={`Pyetja ${i + 1}`} />
                {Array.from({ length: MAX_OPTIONS }, (_, o) => (
                  <label key={o} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "8px" }}>
                    <input type="radio" name={`q${i}_correct`} value={o} defaultChecked={q.correct === o} aria-label={`Opsioni ${o + 1} është i sakti`} />
                    <input name={`q${i}_opt${o}`} defaultValue={q.options[o] ?? ""} placeholder={o >= 3 ? "(opsional)" : ""} style={input} />
                    <span style={{ ...small, minWidth: "86px", textAlign: "right" }}>
                      {split && split.total > 0 && o < q.options.length ? `${split.pct[o]}% (${counts[i][o]})` : ""}
                    </span>
                  </label>
                ))}
                <textarea name={`q${i}_explain`} defaultValue={q.explain} rows={2} style={input} aria-label="Çfarë do të thotë" />
                <input name={`q${i}_slug`} defaultValue={q.slug} style={{ ...input, fontFamily: "monospace", fontSize: "12px" }} aria-label="Slug-u i artikullit" />
                <p style={{ ...small, margin: 0 }}>
                  Kurthi sipas modelit: {q.trap || "—"} ·{" "}
                  <Link href={`/article/${q.slug}`} target="_blank">hap artikullin</Link>
                </p>
              </fieldset>
            );
          })}
          <div>
            <button type="submit" style={btn}>Ruaj dhe publiko</button>
            <span style={{ ...small, marginLeft: "10px" }}>
              Ndryshimi i përgjigjes së saktë i rillogarit pikët e atyre që janë përgjigjur.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
