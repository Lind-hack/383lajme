import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import AdminClient, { type AdminArticle } from "./AdminClient";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const AUTO_DIR = path.join(process.cwd(), "data", "auto-articles");

function loadArticlesWithFiles(): AdminArticle[] {
  if (!fs.existsSync(AUTO_DIR)) return [];
  const results: AdminArticle[] = [];
  const files = fs.readdirSync(AUTO_DIR).filter((f) => f.endsWith(".json")).sort().reverse();
  for (const fileName of files) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(AUTO_DIR, fileName), "utf-8")
      ) as Array<Record<string, unknown>>;
      for (const a of raw) {
        results.push({
          id:          String(a.id ?? ""),
          file:        fileName,
          title:       String(a.title ?? ""),
          excerpt:     String(a.excerpt ?? ""),
          imageUrl:    a.image_url ? String(a.image_url) : undefined,
          source:      String(a.source ?? ""),
          sourceFlag:  String(a.source_flag ?? "🌍"),
          category:    String(a.category ?? ""),
          score:       Number(a.engagement_score ?? 0),
          publishedAt: String(a.published_at ?? ""),
          slug:        String(a.slug ?? ""),
        });
      }
    } catch {
      // skip malformed files
    }
  }
  return results;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_auth")?.value ?? "";
  const isAuthed = Boolean(ADMIN_SECRET && session === ADMIN_SECRET);

  const params = await searchParams;
  const initialEditId = params.id ?? undefined;

  if (!isAuthed) {
    return <LoginScreen />;
  }

  const articles = loadArticlesWithFiles();
  return <AdminClient articles={articles} initialEditId={initialEditId} />;
}

function LoginScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F9F6F1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-manrope), sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #E8E3DB",
          borderRadius: "20px",
          padding: "48px 56px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
          <span style={{ fontWeight: 900, fontSize: "22px", color: "#111" }}>383</span>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#999", letterSpacing: "0.06em", textTransform: "uppercase" }}>Admin</span>
        </div>
        <div id="login-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input
            id="pw-input"
            type="password"
            placeholder="Fjalëkalimi"
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1.5px solid #E8E3DB",
              fontSize: "15px",
              fontFamily: "inherit",
              outline: "none",
              background: "#FAFAF8",
            }}
          />
          <button
            id="login-btn"
            type="button"
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#FF4422",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: "15px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Hyr
          </button>
          <p id="login-error" style={{ color: "#e53e3e", fontSize: "13px", margin: 0, display: "none" }}>
            Fjalëkalim i gabuar.
          </p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              async function doLogin() {
                var pw = document.getElementById('pw-input').value;
                var res = await fetch('/api/admin/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: pw })
                });
                if (res.ok) { window.location.reload(); }
                else { document.getElementById('login-error').style.display = 'block'; }
              }
              document.getElementById('login-btn').addEventListener('click', doLogin);
              document.getElementById('pw-input').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') doLogin();
              });
            `,
          }}
        />
      </div>
    </main>
  );
}
