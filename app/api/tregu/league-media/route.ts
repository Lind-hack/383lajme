import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST multipart { file } → { url }: a signed-in player's photo for their
 * private league's icon. Raster only (an SVG can carry script), 2 MB, stored
 * under the player's own folder, the only place the create RPC accepts a photo
 * from. Only the league's members ever see a private league.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Duhet të hysh në llogari." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Ngarkimi nuk është i disponueshëm." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Zgjidh një foto." }, { status: 400 });
  const extension = TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "Vetëm PNG, JPG ose WebP." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fotoja duhet të jetë nën 2 MB." }, { status: 400 });

  const path = `user/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from("league-media")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: "Ngarkimi dështoi." }, { status: 400 });
  return NextResponse.json({ url: admin.storage.from("league-media").getPublicUrl(path).data.publicUrl });
}
