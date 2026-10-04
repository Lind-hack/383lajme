import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTENT_TYPE, DAILY_LIMIT, MAX_PHOTO_BYTES, checkFields, sniffImage } from "@/lib/xhep/submission.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "xhep-submissions";

/**
 * POST multipart { cityId, story, consent: "yes", photos[] } → { ok: true }.
 *
 * A signed-in visitor offers their Kosova në xhep mural and story for the
 * public page. Nothing is published here: the row waits as "pending" and the
 * photos sit in a private bucket until an admin reviews them (/admin/xhep).
 * An account is required so a takedown request can be honoured and spam
 * answered; five submissions a day per account at most.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "auth" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File);
  const fields = checkFields({ cityId: form.get("cityId"), story: form.get("story"), consent: form.get("consent"), photoCount: photos.length });
  if (!fields.ok) return NextResponse.json(fields, { status: 400 });

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin.from("xhep_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return NextResponse.json({ ok: false, code: "limit" }, { status: 429 });

  // Every photo is read and checked before anything is stored.
  const files: { bytes: Buffer; ext: keyof typeof CONTENT_TYPE }[] = [];
  for (const photo of photos) {
    if (photo.size > MAX_PHOTO_BYTES) return NextResponse.json({ ok: false, code: "too_large" }, { status: 400 });
    const bytes = Buffer.from(await photo.arrayBuffer());
    const ext = sniffImage(bytes) as keyof typeof CONTENT_TYPE | null;
    if (!ext) return NextResponse.json({ ok: false, code: "type" }, { status: 400 });
    files.push({ bytes, ext });
  }

  const id = crypto.randomUUID();
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    const path = `${user.id}/${id}/${i + 1}.${file.ext}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, file.bytes, { contentType: CONTENT_TYPE[file.ext], upsert: false });
    if (error) {
      if (paths.length) await admin.storage.from(BUCKET).remove(paths);
      console.warn("[xhep] submission upload failed", error.message);
      return NextResponse.json({ ok: false, code: "upload" }, { status: 502 });
    }
    paths.push(path);
  }

  const { error } = await admin.from("xhep_submissions").insert({
    id,
    user_id: user.id,
    city_id: fields.cityId,
    story: fields.story,
    photo_paths: paths,
    consent_at: new Date().toISOString(),
  });
  if (error) {
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    console.warn("[xhep] submission insert failed", error.message);
    return NextResponse.json({ ok: false, code: "save" }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
