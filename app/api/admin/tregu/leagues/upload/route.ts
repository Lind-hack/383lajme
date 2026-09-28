import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
// No SVG: an uploaded SVG can carry script, and it would be served from the
// storage domain. Brand emblems that are SVG ship from /public instead.
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * POST multipart { file, kind: "emblem" | "cover" } → { url }
 *
 * League emblems and covers go to the public `league-media` bucket (migration
 * 0086) under a random name, so a replaced image never serves a stale cache.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "cover" ? "cover" : "emblem";
  if (!(file instanceof File)) return NextResponse.json({ error: "Zgjidh një imazh." }, { status: 400 });
  const extension = TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "Vetëm PNG, JPG ose WebP." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imazhi duhet të jetë nën 3 MB." }, { status: 400 });

  const path = `${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from("league-media")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data } = admin.storage.from("league-media").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
