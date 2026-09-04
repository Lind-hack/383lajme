import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { deleteArticle, getArticleForEdit } from "@/lib/admin/articles";

/**
 * The one-click remove link the news pipeline emails.
 *
 * Two things were wrong with it.
 *
 * It removed the article from `data/auto-articles/*.json`, which is the outage
 * fallback lib/db.ts reads only when Supabase is unreachable. That store shares
 * zero slugs with the rows news_articles serves to the site, so the page
 * cheerfully reported "Artikulli u hoq me sukses" while the article stayed
 * live. It now deletes from news_articles, which is what a reader sees.
 *
 * And it deleted on GET. Mail clients, link scanners and chat previewers fetch
 * URLs in messages without anyone clicking, so an emailed link that deletes on
 * GET can delete on its own. GET now only asks; the deletion is a POST from the
 * form on that page, which a prefetcher will not send.
 *
 * The `?secret=` credential is kept because links already sent must keep
 * working, but it is no longer in the URL of the request that actually deletes:
 * the form posts it in the body. A credential in a query string lands in server
 * logs, browser history and the Referer of every outbound link on the page --
 * which is why lib/admin-auth.ts stopped accepting one.
 */

const REMOVE_SECRET = process.env.REMOVE_SECRET ?? "";

/** Constant-time for equal lengths; length is compared first because timingSafeEqual throws on a mismatch. */
function secretOk(provided: string): boolean {
  if (!REMOVE_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(REMOVE_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Titles come from scraped news through an LLM rewrite and are not trusted markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") ?? "";
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";

  if (!secretOk(secret)) return html("Lidhje e pavlefshme.", 401);
  if (!id) return html("Mungon identifikuesi i artikullit.", 400);

  const article = await getArticleForEdit(id);
  if (!article) {
    return html("Artikulli nuk u gjet — ka gjasa të jetë hequr tashmë.", 200);
  }

  // Ask, do not act. The POST below is what removes it.
  return html(
    `<p class="q">A do ta heqësh këtë artikull nga faqja?</p>
     <p class="t">${esc(article.title)}</p>
     <form method="POST" action="/api/remove">
       <input type="hidden" name="id" value="${esc(id)}" />
       <input type="hidden" name="secret" value="${esc(secret)}" />
       <button type="submit" class="danger">Hiqe artikullin</button>
     </form>`,
    200,
    { raw: true },
  );
}

export async function POST(request: NextRequest) {
  let secret = "";
  let id = "";
  try {
    const form = await request.formData();
    secret = String(form.get("secret") ?? "");
    id = String(form.get("id") ?? "").trim();
  } catch {
    return html("Kërkesë e pavlefshme.", 400);
  }

  if (!secretOk(secret)) return html("Lidhje e pavlefshme.", 401);
  if (!id) return html("Mungon identifikuesi i artikullit.", 400);

  const result = await deleteArticle(id);
  if (!result.ok) return html(`Gabim teknik: ${esc(result.error)}`, 500);

  return html("Artikulli u hoq nga faqja.", 200);
}

function html(body: string, status: number, opts: { raw?: boolean } = {}): NextResponse {
  const inner = opts.raw ? body : `<p>${body}</p>`;
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>383 Lajme</title>
  <style>
    body { background: #111; color: #fff; font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1a1a1a; border-radius: 16px; padding: 40px 48px;
            max-width: 520px; text-align: center; }
    h1 { margin: 0 0 16px; font-size: 22px; }
    p { color: #aaa; margin: 0 0 20px; line-height: 1.6; }
    p.t { color: #fff; font-weight: 700; font-size: 17px; line-height: 1.4; }
    p.q { color: #aaa; }
    button.danger { background: #E41E20; color: #fff; border: none; cursor: pointer;
                    border-radius: 10px; padding: 12px 22px; font: inherit; font-weight: 700; }
    a { color: #44aaff; text-decoration: none; font-size: 14px; display: inline-block; margin-top: 22px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>383 Lajme</h1>
    ${inner}
    <a href="/">← Kthehu në faqe</a>
  </div>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
