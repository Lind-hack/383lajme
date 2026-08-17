"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo, embedUrl, youtubeId } from "@/lib/reagimi-data";

const AUTH_COOKIE = "reagimi_admin_auth";

const MAX_QUOTE = 400;
const MAX_NAME = 120;
const MAX_ROLE = 120;
const MAX_CONTEXT = 160;

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  if (!process.env.ADMIN_SECRET || password !== process.env.ADMIN_SECRET) {
    redirect("/admin/reagimi?err=auth");
  }
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
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
