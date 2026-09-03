"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, mintAdminSession, verifyAdminSession } from "@/lib/admin-session";
import { totpEnabled, verifyTotp } from "@/lib/admin-totp";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import { MAX_OPTIONS } from "@/lib/sondazhi-draft.mjs";

// One shared admin session, replacing a per-panel cookie whose value was the
// literal string "1". httpOnly keeps page scripts out of a cookie; it does not
// stop the person holding the browser from setting one in devtools or curl, and
// a value of "1" leaves nothing to guess. Sending `Cookie: poll_admin_auth=1`
// to production returned the full panel.
const AUTH_COOKIE = ADMIN_COOKIE;

export async function loginAction(formData: FormData) {
  const secret = process.env.ADMIN_SECRET ?? "";
  const password = formData.get("password") as string;
  if (!secret || password !== secret) {
    redirect("/admin/poll?err=1");
  }
  // Same second factor as the main dashboard, so one enrolled device covers
  // every panel and there is no weaker door left standing beside a locked one.
  if (totpEnabled()) {
    const code = String(formData.get("code") ?? "");
    if (!verifyTotp(code, (process.env.ADMIN_TOTP_SECRET ?? "").trim())) {
      redirect("/admin/poll?err=1");
    }
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, mintAdminSession(secret), ADMIN_COOKIE_OPTIONS);
  redirect("/admin/poll");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/admin/poll");
}

async function requireAuth() {
  const cookieStore = await cookies();
  if (cookieStore.get(AUTH_COOKIE)?.value !== "1") redirect("/admin/poll");
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Save a poll for a chosen date.
 *
 * Three things changed from the version this replaces, all of which were real
 * defects rather than preferences:
 *
 *  - it could only ever write today, so there was no way to prepare tomorrow
 *    even though the generator drafts a day ahead;
 *  - the upsert had no `onConflict`, which only worked by accident of poll_date
 *    happening to be the primary key;
 *  - the Supabase error was discarded and the page redirected to `?saved=1`
 *    regardless, so a failed write reported success.
 */
export async function savePollAction(formData: FormData) {
  await requireAuth();

  const requested = ((formData.get("poll_date") as string | null) ?? "").trim();
  const pollDate = isDateKey(requested) ? requested : dateKeyInKosovo();

  const question = ((formData.get("question") as string | null) ?? "").trim();
  const contextLine = ((formData.get("context_line") as string | null) ?? "").trim();
  const slug = ((formData.get("source_article_slug") as string | null) ?? "").trim();

  const opts: string[] = [];
  for (let i = 0; i < MAX_OPTIONS; i++) {
    const val = ((formData.get(`opt${i}`) as string | null) ?? "").trim();
    if (val) opts.push(val);
  }

  if (!question || opts.length < 2) {
    redirect(`/admin/poll?date=${pollDate}&err=save`);
  }

  const supabase = createAdminClient();
  if (!supabase) redirect(`/admin/poll?date=${pollDate}&err=env`);

  // Saving from the admin is an editorial decision, so it publishes: a reviewed
  // question is by definition approved.
  const { error } = await supabase.from("daily_polls").upsert(
    {
      poll_date: pollDate,
      question,
      options: opts,
      context_line: contextLine || null,
      source_article_slug: slug || null,
      status: "approved",
    },
    { onConflict: "poll_date" }
  );

  if (error) {
    console.error("[sondazhi] admin save failed", error);
    redirect(`/admin/poll?date=${pollDate}&err=write`);
  }

  revalidatePath("/");
  redirect(`/admin/poll?date=${pollDate}&saved=1`);
}

/** Discard a generated draft without publishing it. */
export async function rejectDraftAction(formData: FormData) {
  await requireAuth();

  const requested = ((formData.get("poll_date") as string | null) ?? "").trim();
  if (!isDateKey(requested)) redirect("/admin/poll");

  const supabase = createAdminClient();
  if (!supabase) redirect(`/admin/poll?date=${requested}&err=env`);

  // Scoped to drafts so this can never delete a published question.
  const { error } = await supabase
    .from("daily_polls")
    .delete()
    .eq("poll_date", requested)
    .eq("status", "draft");

  if (error) {
    console.error("[sondazhi] draft reject failed", error);
    redirect(`/admin/poll?date=${requested}&err=write`);
  }

  redirect(`/admin/poll?date=${requested}&rejected=1`);
}
