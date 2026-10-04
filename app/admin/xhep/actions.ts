"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PLACEMENTS = new Set(["hero", "city", "wall"]);
const ID = /^[0-9a-f-]{36}$/;

async function gate() {
  if (!(await isAdminAuthed())) redirect("/admin");
  const admin = createAdminClient();
  if (!admin) redirect("/admin/xhep?err=nokey");
  return admin;
}

/** Approve a trip and say where it goes: the page's lead, its city, or the wall. */
export async function approveAction(formData: FormData) {
  const admin = await gate();
  const id = String(formData.get("id") ?? "");
  const placement = String(formData.get("placement") ?? "");
  if (!ID.test(id) || !PLACEMENTS.has(placement)) redirect("/admin/xhep?err=input");
  const { error } = await admin
    .from("xhep_submissions")
    .update({ status: "approved", placement, reviewed_at: new Date().toISOString(), admin_note: null })
    .eq("id", id);
  if (error) redirect("/admin/xhep?err=save");
  revalidatePath("/admin/xhep");
  redirect("/admin/xhep?done=approved");
}

/** Reject a trip: it stays private and its photos are deleted. */
export async function rejectAction(formData: FormData) {
  const admin = await gate();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!ID.test(id)) redirect("/admin/xhep?err=input");
  const { data } = await admin.from("xhep_submissions").select("photo_paths").eq("id", id).maybeSingle();
  const paths = (data?.photo_paths ?? []) as string[];
  if (paths.length) await admin.storage.from("xhep-submissions").remove(paths);
  const { error } = await admin
    .from("xhep_submissions")
    .update({ status: "rejected", placement: null, photo_paths: [], reviewed_at: new Date().toISOString(), admin_note: note || null })
    .eq("id", id);
  if (error) redirect("/admin/xhep?err=save");
  revalidatePath("/admin/xhep");
  redirect("/admin/xhep?done=rejected");
}
