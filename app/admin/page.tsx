import { AlertCircle } from "lucide-react";
import { isAdminAuthed } from "@/lib/admin-auth";
import { articleCategoryCounts, listArticles, type SortKey } from "@/lib/admin/articles";
import ArticleList from "./_components/ArticleList";
import ArticleToolbar from "./_components/ArticleToolbar";
import Pagination from "./_components/Pagination";

/**
 * The article queue.
 *
 * This page used to read all 130 files in data/auto-articles, parse 1,228
 * articles including 1.5 MB of body text, and hand every one of them to a
 * client component as props -- which was both the lag and the wrong store.
 * Those batches are the outage fallback lib/db.ts reads when Supabase is
 * unreachable; they share zero slugs with what the site renders, so the panel
 * was editing articles no reader would ever see.
 *
 * It now reads one page of news_articles, filtered in Postgres, without a body.
 */

export const dynamic = "force-dynamic";

const SORTS = new Set<SortKey>(["recent", "oldest", "score"]);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminAuthed())) return <LoginScreen />;

  const params = await searchParams;
  const one = (key: string): string | undefined => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const sortRaw = one("sort");
  const sort: SortKey = SORTS.has(sortRaw as SortKey) ? (sortRaw as SortKey) : "recent";
  const page = Math.max(1, Number.parseInt(one("page") ?? "1", 10) || 1);

  const [result, categories] = await Promise.all([
    listArticles({ q: one("q"), category: one("category"), sort, page }),
    articleCategoryCounts(),
  ]);

  return (
    <>
      <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
        <ArticleToolbar categories={categories} total={result.total} />

        {result.error ? (
          <div
            role="alert"
            className="panel mt-3 flex items-start gap-2.5 px-4 py-3.5"
            style={{ borderColor: "rgba(180,24,26,0.3)" }}
          >
            <AlertCircle size={17} aria-hidden style={{ color: "var(--a-danger)", flexShrink: 0 }} />
            <div>
              <p className="m-0 text-[13px] font-bold" style={{ color: "var(--a-danger)" }}>
                Artikujt nuk u lexuan dot
              </p>
              <p className="m-0 mt-1 text-[12px]" style={{ color: "var(--a-muted)" }}>
                {result.error}
              </p>
            </div>
          </div>
        ) : (
          <>
            <ArticleList rows={result.rows} />
            <Pagination page={result.page} pageCount={result.pageCount} />
          </>
        )}
      </main>
    </>
  );
}

/**
 * Login.
 *
 * The inline script is unchanged from the hardened version: it asks the server
 * whether this deployment wants a second factor, so the TOTP field appears the
 * moment ADMIN_TOTP_SECRET is set with no redeploy of this page. Only the
 * presentation moved onto the admin tokens.
 */
function LoginScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-[380px] p-8" style={{ boxShadow: "var(--a-shadow-2)" }}>
        <div className="mb-7 flex items-baseline gap-2">
          <span className="text-[22px] font-black tracking-tight" style={{ color: "var(--a-ink)" }}>
            383
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "var(--a-faint)" }}
          >
            Admin
          </span>
        </div>

        <div id="login-form" className="flex flex-col gap-3">
          <input id="pw-input" type="password" placeholder="Fjalëkalimi" className="field" />
          {/* Shown only when the deployment has ADMIN_TOTP_SECRET set, so the
              form is unchanged for anyone who has not enrolled a device yet. */}
          <input
            id="code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Kodi 6-shifror"
            hidden
            className="field tnum tracking-[0.3em]"
          />
          <button id="login-btn" type="button" className="btn btn-primary h-10">
            Hyr
          </button>
          <p
            id="login-error"
            role="alert"
            className="m-0 hidden text-[12px] font-semibold"
            style={{ color: "var(--a-danger)" }}
          >
            Fjalëkalim i gabuar.
          </p>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              var codeEl = document.getElementById('code-input');
              // Ask the server whether this deployment wants a second factor,
              // rather than hardcoding it: the field then appears the moment
              // ADMIN_TOTP_SECRET is set, with no redeploy of this page.
              fetch('/api/admin/login').then(function(r) { return r.json(); }).then(function(d) {
                if (d && d.totp) codeEl.hidden = false;
              }).catch(function() {});

              async function doLogin() {
                var pw = document.getElementById('pw-input').value;
                var body = { password: pw };
                if (!codeEl.hidden) body.code = codeEl.value;
                var res = await fetch('/api/admin/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
                });
                if (res.ok) { window.location.reload(); return; }
                var err = document.getElementById('login-error');
                var msg = 'Fjalëkalim i gabuar.';
                try { var j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
                err.textContent = msg;
                err.classList.remove('hidden');
              }
              document.getElementById('login-btn').addEventListener('click', doLogin);
              ['pw-input', 'code-input'].forEach(function(id) {
                document.getElementById(id).addEventListener('keydown', function(e) {
                  if (e.key === 'Enter') doLogin();
                });
              });
            `,
          }}
        />
      </div>
    </main>
  );
}
