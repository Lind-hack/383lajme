import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveAction, rejectAction } from "./actions";

export const dynamic = "force-dynamic";

const CITY: Record<string, string> = {
  prizren: "Prizren",
  gjakove: "Gjakovë",
  peje: "Pejë",
  prishtine: "Prishtinë",
  mitrovice: "Mitrovicë",
  ferizaj: "Ferizaj",
  gjilan: "Gjilan",
};

const PLACE_LABEL: Record<string, string> = { hero: "Kreu i faqes", city: "Faqja e qytetit", wall: "Muri i udhëtimeve" };

const MESSAGES: Record<string, string> = {
  nokey: "Mungon SUPABASE_SERVICE_ROLE_KEY.",
  input: "Zgjidh ku shkon udhëtimi.",
  save: "Ruajtja dështoi. Provo sërish.",
  approved: "U aprovua.",
  rejected: "U refuzua dhe fotot u fshinë.",
};

type Row = {
  id: string;
  user_id: string;
  city_id: string;
  story: string;
  photo_paths: string[];
  status: "pending" | "approved" | "rejected";
  placement: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function when(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sq-AL", { timeZone: "Europe/Belgrade", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Kosova në xhep: trips visitors sent with consent. Review the photos and
 * words, then approve (choosing where the trip appears) or reject (the photos
 * are deleted). Photos load through signed links that expire in an hour.
 */
export default async function AdminXhepPage({ searchParams }: { searchParams: Promise<{ err?: string; done?: string }> }) {
  if (!(await isAdminAuthed())) redirect("/admin");
  const params = await searchParams;
  const admin = createAdminClient();

  const shell: React.CSSProperties = { maxWidth: "1180px", margin: "0 auto", padding: "16px 12px 40px" };
  const card: React.CSSProperties = {
    display: "grid",
    gap: "12px",
    padding: "18px 20px",
    borderRadius: "var(--a-radius-lg)",
    border: "1px solid var(--a-border)",
    background: "var(--a-panel)",
    boxShadow: "var(--a-shadow-1)",
  };

  if (!admin) {
    return (
      <main style={shell}>
        <h1>Kosova në xhep</h1>
        <p>{MESSAGES.nokey}</p>
      </main>
    );
  }

  const [{ data: pending }, { data: reviewed }] = await Promise.all([
    admin.from("xhep_submissions").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(50),
    admin.from("xhep_submissions").select("*").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(20),
  ]);
  const queue = (pending ?? []) as Row[];
  const done = (reviewed ?? []) as Row[];

  const allPaths = [...queue, ...done].flatMap((r) => r.photo_paths ?? []);
  const signed = allPaths.length ? (await admin.storage.from("xhep-submissions").createSignedUrls(allPaths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const emails = new Map<string, string>();
  await Promise.all(
    [...new Set(queue.map((r) => r.user_id))].map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) emails.set(id, data.user.email);
    })
  );

  const message = params.err ? MESSAGES[params.err] : params.done ? MESSAGES[params.done] : null;

  return (
    <main style={shell}>
      <header style={{ display: "grid", gap: 6, marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Kosova në xhep · Udhëtimet e dërguara</h1>
        <p style={{ margin: 0, color: "var(--a-muted)" }}>
          Muret dhe historitë që vizitorët dërguan me pëlqim. Asgjë nuk publikohet pa aprovim. Refuzimi i fshin fotot.
        </p>
        {message && <p role="status" style={{ margin: 0, fontWeight: 700 }}>{message}</p>}
      </header>

      <section style={{ display: "grid", gap: 16 }} aria-label="Në pritje">
        <h2 style={{ margin: 0 }}>Në pritje ({queue.length})</h2>
        {queue.length === 0 && <p style={{ color: "var(--a-muted)" }}>Asnjë udhëtim në pritje.</p>}
        {queue.map((row) => (
          <article key={row.id} style={card}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "baseline" }}>
              <strong>{CITY[row.city_id] ?? row.city_id}</strong>
              <span style={{ color: "var(--a-muted)" }}>{when(row.created_at)}</span>
              <span style={{ color: "var(--a-muted)" }}>{emails.get(row.user_id) ?? row.user_id}</span>
            </div>
            {row.photo_paths.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                {row.photo_paths.map((p) =>
                  urlOf.get(p) ? (
                    <a key={p} href={urlOf.get(p)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlOf.get(p)} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />
                    </a>
                  ) : null
                )}
              </div>
            )}
            {row.story && <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{row.story}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              <form action={approveAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="hidden" name="id" value={row.id} />
                <label>
                  Ku shkon:{" "}
                  <select name="placement" defaultValue="wall" required>
                    <option value="hero">{PLACE_LABEL.hero}</option>
                    <option value="city">{PLACE_LABEL.city}</option>
                    <option value="wall">{PLACE_LABEL.wall}</option>
                  </select>
                </label>
                <button type="submit">Aprovo</button>
              </form>
              <form action={rejectAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="hidden" name="id" value={row.id} />
                <input name="note" placeholder="Arsyeja (opsionale)" maxLength={500} />
                <button type="submit">Refuzo</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {done.length > 0 && (
        <section style={{ display: "grid", gap: 8, marginTop: 28 }} aria-label="Të shqyrtuara">
          <h2 style={{ margin: 0 }}>Të shqyrtuara së fundi</h2>
          {done.map((row) => (
            <p key={row.id} style={{ margin: 0 }}>
              <strong>{CITY[row.city_id] ?? row.city_id}</strong> · {row.status === "approved" ? `Aprovuar → ${PLACE_LABEL[row.placement ?? ""] ?? "—"}` : "Refuzuar"} · {when(row.reviewed_at)}
              {row.admin_note ? ` · ${row.admin_note}` : ""}
              {row.status === "approved" && (
                <>
                  {" · "}
                  <a href="/visit?lang=sq#trips" target="_blank" rel="noreferrer">Shih në faqe</a>
                  {" · "}
                  <form action={rejectAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="note" value="Hequr nga faqja" />
                    <button type="submit" style={{ border: 0, background: "none", color: "#b42318", fontWeight: 700, cursor: "pointer", padding: 0 }}>Hiq nga faqja</button>
                  </form>
                </>
              )}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
