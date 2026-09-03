"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, mintAdminSession, verifyAdminSession } from "@/lib/admin-session";
import { totpEnabled, verifyTotp } from "@/lib/admin-totp";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo, embedUrl, youtubeId } from "@/lib/reagimi-data";

// One shared admin session, replacing a per-panel cookie whose value was the
// literal string "1". httpOnly keeps page scripts out of a cookie; it does not
// stop the person holding the browser from setting one in devtools or curl, and
// a value of "1" leaves nothing to guess. Sending `Cookie: poll_admin_auth=1`
// to production returned the full panel.
const AUTH_COOKIE = ADMIN_COOKIE;

const MAX_QUOTE = 400;
const MAX_NAME = 120;
const MAX_ROLE = 120;
const MAX_CONTEXT = 160;

export async function loginAction(formData: FormData) {
  const secret = process.env.ADMIN_SECRET ?? "";
  const password = formData.get("password") as string;
  if (!secret || password !== secret) {
    redirect("/admin/reagimi?err=1");
  }
  // Same second factor as the main dashboard, so one enrolled device covers
  // every panel and there is no weaker door left standing beside a locked one.
  if (totpEnabled()) {
    const code = String(formData.get("code") ?? "");
    if (!verifyTotp(code, (process.env.ADMIN_TOTP_SECRET ?? "").trim())) {
      redirect("/admin/reagimi?err=1");
    }
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, mintAdminSession(secret), ADMIN_COOKIE_OPTIONS);
  redirect("/admin/reagimi");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/admin/reagimi");
}

async function requireAuth() {
  const cookieStore = await cookies();
  if (cookieStore.get(AUTH_COOKIE)?.value !== "1") redirect("/admin/reagimi");
}

/** Accept a slug, a /article/<slug> path, or a full URL. Store the bare slug. */
function normaliseSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, "");
  const slug = withoutOrigin.replace(/^\/?(article\/)?/i, "").replace(/\/+$/, "");
  return slug || null;
}

function pickDate(raw: string): string {
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : dateKeyInKosovo();
}

export async function saveReagimiAction(formData: FormData) {
  await requireAuth();

  const reagimiDate = pickDate((formData.get("reagimi_date") as string | null) ?? "");
  const quote = ((formData.get("quote") as string | null) ?? "").trim();
  const speakerName = ((formData.get("speaker_name") as string | null) ?? "").trim();
  const speakerRole = ((formData.get("speaker_role") as string | null) ?? "").trim();
  const contextLine = ((formData.get("context_line") as string | null) ?? "").trim();
  const articleSlug = normaliseSlug((formData.get("article_slug") as string | null) ?? "");
  const rawVideo = ((formData.get("video_url") as string | null) ?? "").trim();

  if (!quote || !speakerName) redirect(`/admin/reagimi?d=${reagimiDate}&err=required`);
  if (quote.length > MAX_QUOTE) redirect(`/admin/reagimi?d=${reagimiDate}&err=long`);
  if (speakerName.length > MAX_NAME || speakerRole.length > MAX_ROLE) {
    redirect(`/admin/reagimi?d=${reagimiDate}&err=long`);
  }
  if (contextLine.length > MAX_CONTEXT) redirect(`/admin/reagimi?d=${reagimiDate}&err=long`);

  // Normalise any YouTube URL shape to an embed URL. Reject anything unparseable
  // rather than storing a link the card cannot play.
  let videoUrl: string | null = null;
  if (rawVideo) {
    const id = youtubeId(rawVideo);
    if (!id) redirect(`/admin/reagimi?d=${reagimiDate}&err=video`);
    videoUrl = embedUrl(id as string);
  }

  // RLS denies anon writes to reagimi_daily on purpose, so this needs the service key.
  const supabase = createAdminClient();
  if (!supabase) redirect(`/admin/reagimi?d=${reagimiDate}&err=nokey`);

  const { error } = await supabase.from("reagimi_daily").upsert(
    {
      reagimi_date: reagimiDate,
      quote,
      speaker_name: speakerName,
      speaker_role: speakerRole || null,
      context_line: contextLine || null,
      article_slug: articleSlug,
      video_url: videoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "reagimi_date" }
  );

  if (error) redirect(`/admin/reagimi?d=${reagimiDate}&err=save`);

  revalidatePath("/");
  redirect(`/admin/reagimi?d=${reagimiDate}&saved=1`);
}

export async function clearReagimiAction(formData: FormData) {
  await requireAuth();

  const reagimiDate = pickDate((formData.get("reagimi_date") as string | null) ?? "");

  const supabase = createAdminClient();
  if (!supabase) redirect(`/admin/reagimi?d=${reagimiDate}&err=nokey`);

  const { error } = await supabase
    .from("reagimi_daily")
    .delete()
    .eq("reagimi_date", reagimiDate);

  if (error) redirect(`/admin/reagimi?d=${reagimiDate}&err=save`);

  revalidatePath("/");
  redirect(`/admin/reagimi?d=${reagimiDate}&cleared=1`);
}
