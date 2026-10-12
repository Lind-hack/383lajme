import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_HIDE } from "@/lib/article-comments.mjs";
import { judgeCommentAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Reported comments (migration 0107): the ones readers hid with REPORT_HIDE
 * reports first, then any still showing with a report or two. Keep makes a
 * comment visible again for good; delete takes it down.
 */

const MESSAGES: Record<string, string> = { kept: "Komenti u mbajt.", deleted: "Komenti u fshi." };
const ERRORS: Record<string, string> = {
  env: "Mungon SUPABASE_SERVICE_ROLE_KEY në server.",
  bad: "Kërkesë e pavlefshme.",
  write: "Ruajtja dështoi. Shiko log-et e serverit.",
};

type Row = {
  id: number;
  article_slug: string;
  author_name: string;
  body: string;
  status: string;
  report_count: number;
  created_at: string;
};

export default async function AdminKomentePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdminAuthed())) redirect("/admin");
  const params = await searchParams;
  const supabase = createAdminClient();

  let rows: Row[] = [];
  let failed = false;
  let total = 0;
  if (supabase) {
    const { data, error } = await supabase
      .from("article_comments")
      .select("id, article_slug, author_name, body, status, report_count, created_at")
      .gt("report_count", 0)
      .eq("kept", false)
      .neq("status", "deleted")
      .order("report_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    failed = Boolean(error);
    rows = (data as Row[] | null) ?? [];
    const { count } = await supabase.from("article_comments").select("id", { count: "exact", head: true }).eq("status", "visible");
    total = count ?? 0;
  }

  const ok = Object.keys(MESSAGES).find((k) => params[k] === "1");
  const err = params.err ? ERRORS[params.err] : null;
  const box: React.CSSProperties = {
    background: "var(--a-panel)",
    border: "1px solid var(--a-border)",
    borderRadius: "var(--a-radius-lg)",
    padding: "16px 18px",
    boxShadow: "var(--a-shadow-1)",
  };
  const btn: React.CSSProperties = {
    padding: "7px 14px",
    borderRadius: "var(--a-radius)",
    border: "1px solid var(--a-border-strong)",
    background: "var(--a-panel)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 64px", display: "grid", gap: 14 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Komentet e raportuara</h1>
        <p style={{ margin: "6px 0 0", color: "var(--a-muted)", fontSize: 14 }}>
          {REPORT_HIDE} raportime nga lexues të ndryshëm e fshehin një koment derisa ta shikosh. {total} komente të dukshme gjithsej.
        </p>
      </header>
      {ok && <p style={{ ...box, color: "var(--a-success, #15803d)" }}>{MESSAGES[ok]}</p>}
      {err && <p style={{ ...box, color: "var(--a-danger, #b91c1c)" }}>{err}</p>}
      {!supabase && <p style={box}>{ERRORS.env}</p>}
      {failed && <p style={box}>Tabela e komenteve s&apos;u lexua — a është aplikuar migrimi 0107?</p>}
      {supabase && !failed && rows.length === 0 && <p style={box}>Asnjë koment i raportuar. 🎉</p>}
      {rows.map((r) => (
        <article key={r.id} style={{ ...box, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", fontSize: 13 }}>
            <b style={{ fontSize: 14 }}>{r.author_name}</b>
            <span style={{ color: "var(--a-muted)" }}>{new Date(r.created_at).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade" })}</span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 700,
                background: r.status === "hidden" ? "#fee2e2" : "#fef3c7",
                color: r.status === "hidden" ? "#b91c1c" : "#92400e",
              }}
            >
              {r.status === "hidden" ? "I fshehur" : "I dukshëm"} · {r.report_count} raportime
            </span>
            <Link href={`/article/${r.article_slug}`} target="_blank" style={{ marginLeft: "auto", fontWeight: 600 }}>
              Lajmi ↗
            </Link>
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>{r.body}</p>
          <form action={judgeCommentAction} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" name="verdict" value="keep" style={btn}>
              Mbaje
            </button>
            <button type="submit" name="verdict" value="delete" style={{ ...btn, borderColor: "#b91c1c", color: "#b91c1c" }}>
              Fshije
            </button>
          </form>
        </article>
      ))}
    </main>
  );
}
