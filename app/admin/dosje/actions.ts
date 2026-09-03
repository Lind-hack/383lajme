"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, mintAdminSession, verifyAdminSession } from "@/lib/admin-session";
import { totpEnabled, verifyTotp } from "@/lib/admin-totp";
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

// One shared admin session, replacing a per-panel cookie whose value was the
// literal string "1". httpOnly keeps page scripts out of a cookie; it does not
// stop the person holding the browser from setting one in devtools or curl, and
// a value of "1" leaves nothing to guess. Sending `Cookie: poll_admin_auth=1`
// to production returned the full panel.
const AUTH_COOKIE = ADMIN_COOKIE;

async function requireAuth() {
  const store = await cookies();
  if (!verifyAdminSession(store.get(AUTH_COOKIE)?.value, process.env.ADMIN_SECRET ?? "")) {
    redirect("/admin/dosje");
  }
}

export async function loginAction(formData: FormData) {
  const secret = process.env.ADMIN_SECRET ?? "";
  const password = formData.get("password") as string;
  if (!secret || password !== secret) {
    redirect("/admin/dosje?err=1");
  }
  // Same second factor as the main dashboard, so one enrolled device covers
  // every panel and there is no weaker door left standing beside a locked one.
  if (totpEnabled()) {
    const code = String(formData.get("code") ?? "");
    if (!verifyTotp(code, (process.env.ADMIN_TOTP_SECRET ?? "").trim())) {
      redirect("/admin/dosje?err=1");
    }
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, mintAdminSession(secret), ADMIN_COOKIE_OPTIONS);
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

  // Whether the text actually moved, not whether the form was submitted. This
  // was a hidden field pinned to "1", so saving a typo fix — or saving nothing
  // at all — marked the moment as edited after verification, which the trigger
  // then refuses to approve. With no reset path anywhere, the first click on
  // "Ruaj ndryshimet" made a milestone permanently unapprovable and the queue
  // filled with drafts that looked like reviewer backlog.
  const { data: before, error: readError } = await supabase
    .from("dosje_milestones")
    .select("title, summary, why, claims")
    .eq("id", id)
    .single();

  if (readError || !before) {
    redirect(`/admin/dosje?err=${encodeURIComponent(readError?.message ?? "not found")}`);
  }

  const prev = before as {
    title: string;
    summary: string;
    why: string | null;
    claims: Record<string, unknown> | null;
  };
  const textChanged =
    prev.title !== title ||
    prev.summary !== summary ||
    (prev.why ?? "") !== why;

  const { error } = await supabase
    .from("dosje_milestones")
    .update({
      title,
      summary,
      why: why || null,
      updated_at: new Date().toISOString(),
      // Merged, never replaced. claims carries the sentence-to-citation map
      // written at drafting time — the record of which line rests on which
      // source — and overwriting it with a single boolean destroyed it
      // unrecoverably.
      ...(textChanged
        ? { claims: { ...(prev.claims ?? {}), edited_after_verification: true } }
        : {}),
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

/**
 * Publish a whole dossier.
 *
 * A topic and its moments are approved separately on purpose: approving the
 * text of one moment is a claim about that moment, while approving the topic is
 * a decision that this subject should exist as a file at all. Until the topic
 * is approved the dossier is invisible however many moments are ready, because
 * dosje_topic() and the row level security behind it both require it.
 *
 * Refused while the topic has no approved moments — an empty dossier on the
 * site is worse than no dossier, and this is the one place that mistake is
 * cheap to prevent.
 */
export async function approveTopicAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const slug = String(formData.get("slug") ?? "");

  const { count, error: countError } = await supabase
    .from("dosje_milestones")
    .select("id", { count: "exact", head: true })
    .eq("topic_slug", slug)
    .eq("status", "approved");

  if (countError) redirect(`/admin/dosje?err=${encodeURIComponent(countError.message)}`);
  if (!count) {
    redirect(
      `/admin/dosje?err=${encodeURIComponent(
        "Dosja nuk mund të publikohet pa asnjë moment të miratuar."
      )}`
    );
  }

  const { error } = await supabase
    .from("dosje_topics")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  revalidatePath("/dosje", "layout");
  redirect("/admin/dosje?approved=1");
}

/** Take a dossier back off the site without touching its moments. */
export async function retireTopicAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const slug = String(formData.get("slug") ?? "");
  const { error } = await supabase
    .from("dosje_topics")
    .update({ status: "retired", updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  revalidatePath("/dosje", "layout");
  redirect("/admin/dosje?retired=1");
}

/**
 * Confirm that edited text still matches its sources.
 *
 * Editing after verification blocks approval, which is right — the sentence a
 * citation supported is no longer the sentence on the page. But there was no
 * way back: the flag was set and nothing anywhere cleared it, so a moment
 * became permanently unapprovable and only a manual SQL update could rescue it.
 *
 * This is the reviewer saying they have re-read the sources against the new
 * wording. It is deliberately a separate, explicit act rather than something
 * the save quietly does, because that assertion is the whole point of the flag.
 */
export async function confirmSourcesAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const id = String(formData.get("id") ?? "");
  const { data: row, error: readError } = await supabase
    .from("dosje_milestones")
    .select("claims")
    .eq("id", id)
    .single();

  if (readError || !row) {
    redirect(`/admin/dosje?err=${encodeURIComponent(readError?.message ?? "not found")}`);
  }

  const claims = { ...((row as { claims: Record<string, unknown> | null }).claims ?? {}) };
  delete claims.edited_after_verification;

  const { error } = await supabase
    .from("dosje_milestones")
    .update({ claims, last_verified_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "needs_source"]);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  redirect("/admin/dosje?saved=1");
}

/** Refuse a proposed photograph. Kept, so it is not proposed again. */
export async function rejectMediaAction(formData: FormData) {
  await requireAuth();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/dosje?err=db");

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("dosje_media")
    .update({ approved: false, approved_by: "admin:rejected", approved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirect(`/admin/dosje?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/dosje");
  redirect("/admin/dosje?rejected=1");
}
