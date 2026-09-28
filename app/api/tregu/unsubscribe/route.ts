import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** One-click unsubscribe from the daily league email (link in every email). */
async function unsubscribe(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("tregu_digest_unsubscribe", { p_token: token });
    ok = data === true;
  }
  const title = ok ? "U çregjistrove" : "Lidhja nuk vlen";
  const text = ok ? "Nuk do të marrësh më emailin ditor të ligave." : "Kjo lidhje çregjistrimi ka skaduar ose nuk ekziston.";
  const body = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>383</title></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#F9F6F1;color:#111;display:grid;place-items:center;min-height:100vh">
<main style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:24px">${title}</h1>
<p style="color:#555">${text}</p>
<a href="/tregu" style="display:inline-block;margin-top:12px;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Kthehu te Tregu</a></main></body></html>`;
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const GET = unsubscribe;
// Mail clients' one-click unsubscribe (RFC 8058) posts to the same link.
export const POST = unsubscribe;
