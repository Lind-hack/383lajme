"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Approving history.
 *
 * Follows app/admin/poll: its own cookie, the shared ADMIN_SECRET, server
 * actions rather than an API surface, and — the part worth copying deliberately
 * — every Supabase error is read and surfaced. The poll admin carries a comment
 * about an earlier version that redirected to ?saved=1 regardless and reported
 * success on a failed write; that mistake costs more here, because a silent
 * failure would look exactly like an approval.
 *
 * The two-verified-publishers rule is not enforced in this file. It lives in a
 * trigger (migration 0051), so an approval that should not happen fails at the
 * database and this code reports the refusal rather than deciding it.
 */

const AUTH_COOKIE = "dosje_admin_auth";

async function requireAuth() {
  const store = await cookies();
  if (store.get(AUTH_COOKIE)?.value !== "1") redirect("/admin/dosje");
}

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  if (!process.env.ADMIN_SECRET || password !== process.env.ADMIN_SECRET) {
    redirect("/admin/dosje?err=1");
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
  });
  redirect("/admin/dosje");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/admin/dosje");
}

/**
 * Save an editor's corrections.
 *
 * Editing text that has already been checked against its sources invalidates
 * that check: the sentence a citation supported is no longer the sentence on
 * the page. The flag set here is read by the trigger, which then refuses
 * approval until the sources have been confirmed again. Without it an editor
 * could quietly reintroduce an unsourced claim into a milestone the database
 * believes is sourced.
 */
export async function saveMilestoneAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const why = String(formData.get("why") ?? "").trim();
  const changed = String(formData.get("changed") ?? "") === "1";

  const { error } = await supabase
    .from("dosje_milestones")
    .update({
      title,
      summary,
      why: why || null,
      updated_at: new Date().toISOString(),
      ...(changed ? { claims: { edited_after_verification: true } } : {}),
    })
    .eq("id", id)
    .in("status", ["draft", "needs_source"]);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  redirect("/admin/dosje?saved=1");
}

/**
 * Publish one moment.
 *
 * Scoped to draft rows so this can never touch something already approved, the
 * same defensive scoping rejectDraftAction uses in the poll admin. If the
 * trigger refuses — too few verified publishers, or text edited after its
 * sources were checked — the message is shown rather than swallowed.
 */
export async function approveMilestoneAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("dosje_milestones")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: "admin",
    })
    .eq("id", id)
    .in("status", ["draft", "needs_source"]);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  revalidatePath("/dosje", "layout");
  redirect("/admin/dosje?approved=1");
}

export async function rejectMilestoneAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const id = String(formData.get("id") ?? "");
  // Rejected rows are kept. What was proposed and refused is part of the record
  // of how this dossier was built.
  const { error } = await supabase
    .from("dosje_milestones")
    .update({ status: "rejected" })
    .eq("id", id)
    .in("status", ["draft", "needs_source"]);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  redirect("/admin/dosje?rejected=1");
}

/** Approve one photograph as contemporaneous coverage of its own milestone. */
export async function approveMediaAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("dosje_media")
    .update({ approved: true, approved_at: new Date().toISOString(), approved_by: "admin" })
    .eq("id", id);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  redirect("/admin/dosje?approved=1");
}
