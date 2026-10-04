// Server only. Approved visitor trips for the public page.
//
// The visitor's originals stay in the private xhep-submissions bucket. On
// approval each photo is re-encoded (orientation applied, at most 1600 px,
// WebP, all metadata such as GPS dropped) into the public xhep-public bucket
// under <submission id>/<n>.webp. A trip approved before this existed is
// published the first time the page reads it.

import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const PRIVATE = "xhep-submissions";
const PUBLIC = "xhep-public";

export type ShowcaseTrip = {
  id: string;
  cityId: string;
  story: string;
  placement: "hero" | "city" | "wall";
  photos: string[];
  approvedAt: string | null;
};

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Row = { id: string; city_id: string; story: string | null; placement: string | null; photo_paths: string[] | null; public_photo_paths: string[] | null; reviewed_at: string | null };

const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC}/${path}`;

/** Copy a trip's photos to the public bucket, cleaned; returns the public paths. */
export async function publishSubmission(admin: Admin, id: string, privatePaths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const [n, path] of privatePaths.entries()) {
    const { data, error } = await admin.storage.from(PRIVATE).download(path);
    if (error || !data) continue;
    const clean = await sharp(Buffer.from(await data.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const target = `${id}/${n + 1}.webp`;
    const { error: upError } = await admin.storage.from(PUBLIC).upload(target, clean, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (!upError) out.push(target);
  }
  await admin.from("xhep_submissions").update({ public_photo_paths: out }).eq("id", id);
  return out;
}

/** Take a trip's public copies down. */
export async function unpublishSubmission(admin: Admin, id: string) {
  const { data } = await admin.storage.from(PUBLIC).list(id);
  const paths = (data ?? []).map((f) => `${id}/${f.name}`);
  if (paths.length) await admin.storage.from(PUBLIC).remove(paths);
  await admin.from("xhep_submissions").update({ public_photo_paths: [] }).eq("id", id);
}

/** Approved trips, newest first; optionally only one city's. Never throws. */
export async function getShowcase({ cityId, limit = 30 }: { cityId?: string; limit?: number } = {}): Promise<ShowcaseTrip[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  try {
    let query = admin
      .from("xhep_submissions")
      .select("id, city_id, story, placement, photo_paths, public_photo_paths, reviewed_at")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(limit);
    if (cityId) query = query.eq("city_id", cityId);
    const { data } = await query;
    const rows = (data ?? []) as Row[];
    // Publish up to two waiting trips per read, so one page view stays quick.
    let budget = 2;
    for (const row of rows) {
      if ((row.public_photo_paths ?? []).length === 0 && (row.photo_paths ?? []).length > 0 && budget-- > 0) {
        row.public_photo_paths = await publishSubmission(admin, row.id, row.photo_paths ?? []).catch(() => []);
      }
    }
    return rows
      .filter((r) => (r.public_photo_paths ?? []).length > 0 || (r.story ?? "").trim())
      .map((r) => ({
        id: r.id,
        cityId: r.city_id,
        story: (r.story ?? "").trim(),
        placement: (r.placement ?? "wall") as ShowcaseTrip["placement"],
        photos: (r.public_photo_paths ?? []).map(publicUrl),
        approvedAt: r.reviewed_at,
      }));
  } catch {
    return [];
  }
}
