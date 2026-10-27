import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIRAL_TAG } from "@/lib/video-edition";

/**
 * Takes a viral find off the video edition ("Virale sot"): the link beside each find in the
 * clip scout's email (scripts/clip_scout.py). The link is signed for that find alone, with the
 * service key the VPS and the site both hold (sign() in clip_scout.py is the same sum).
 *   GET  ?id=…&t=…  → a page with one button (a mail scanner opening the link takes nothing down)
 *   POST id, t      → the find joins clip-scout/removed.json, and the edition reads it at once
 */

const ID = /^[a-z]{1,3}:[A-Za-z0-9_-]{3,40}$/;

function signed(id: string, token: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !ID.test(id) || !/^[0-9a-f]{32}$/.test(token)) return false;
  const want = createHmac("sha256", key).update(`clip-scout-remove:${id}`).digest("hex").slice(0, 32);
  return timingSafeEqual(Buffer.from(want), Buffer.from(token));
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#111"><p style="color:#FF4422;font-weight:800">383 · Virale sot</p><h1 style="font-size:22px">${title}</h1>${body}</body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!signed(id, token)) return page("Lidhja nuk vlen", "<p>Kjo lidhje nuk është e plotë ose ka skaduar.</p>", 400);
  return page(
    "Ta heq këtë video nga faqja?",
    `<p>Videoja virale <b>${esc(id)}</b> hiqet nga Edicioni video menjëherë dhe nuk kthehet më.</p>
<form method="post"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="t" value="${esc(token)}">
<button style="font-size:16px;font-weight:800;padding:12px 22px;border:0;border-radius:100px;background:#FF4422;color:#fff;cursor:pointer">Hiqe</button></form>`
  );
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  const token = String(form?.get("t") ?? "");
  if (!signed(id, token)) return page("Lidhja nuk vlen", "<p>Kjo lidhje nuk është e plotë ose ka skaduar.</p>", 400);
  const admin = createAdminClient();
  if (!admin) return page("Nuk u hoq", "<p>Faqja nuk arrin dot ruajtjen. Provo sërish pas pak.</p>", 503);
  const bucket = admin.storage.from("clip-scout");
  // The list as it is now (it may not exist yet, or predate this code).
  let ids: string[] = [];
  const { data: file } = await bucket.download("removed.json");
  if (file) {
    try {
      const raw = JSON.parse(await file.text()) as { ids?: unknown };
      ids = Array.isArray(raw?.ids) ? raw.ids.filter((x): x is string => typeof x === "string") : [];
    } catch {
      ids = [];
    }
  }
  if (!ids.includes(id)) ids = [...ids, id].slice(-500);
  const body = JSON.stringify({ updatedAt: new Date().toISOString(), ids });
  const { error } = await bucket.upload("removed.json", new Blob([body], { type: "application/json" }), {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) return page("Nuk u hoq", "<p>Ruajtja nuk u krye. Provo sërish pas pak.</p>", 502);
  revalidateTag(VIRAL_TAG, { expire: 0 });
  return page("U hoq", "<p>Videoja nuk shfaqet më në Edicionin video. Klipi i radhës zë vendin e saj.</p>");
}
