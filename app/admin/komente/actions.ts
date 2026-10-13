"use server";

import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * An editor's call on a reported comment: keep it (visible again, and reports
 * no longer hide it) or delete it. Every action checks the signed session
 * itself; the layout is not a gate.
 */
export async function judgeCommentAction(formData: FormData) {
  if (!(await isAdminAuthed())) redirect("/admin");
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/komente?err=env");

  const id = Number(formData.get("id"));
  const verdict = String(formData.get("verdict") ?? "");
  if (!Number.isSafeInteger(id) || id <= 0 || (verdict !== "keep" && verdict !== "delete")) redirect("/admin/komente?err=bad");

  const { error } = await supabase
    .from("article_comments")
    .update(verdict === "keep" ? { status: "visible", kept: true } : { status: "deleted" })
    .eq("id", id);
  if (error) redirect("/admin/komente?err=write");
  redirect(`/admin/komente?${verdict === "keep" ? "kept" : "deleted"}=1`);
}
