"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  if (password !== process.env.ADMIN_SECRET) {
    redirect("/admin/poll?err=1");
  }
  const cookieStore = await cookies();
  cookieStore.set("poll_admin_auth", "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
  });
  redirect("/admin/poll");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("poll_admin_auth");
  redirect("/admin/poll");
}

export async function savePollAction(formData: FormData) {
  const cookieStore = await cookies();
  if (cookieStore.get("poll_admin_auth")?.value !== "1") {
    redirect("/admin/poll");
  }

  const today = new Date().toISOString().slice(0, 10);
  const question = ((formData.get("question") as string | null) ?? "").trim();
  const opts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const val = ((formData.get(`opt${i}`) as string | null) ?? "").trim();
    if (val) opts.push(val);
  }

  if (!question || opts.length < 2) {
    redirect("/admin/poll?err=save");
  }

  const supabase = await createClient();
  await supabase.from("daily_polls").upsert({
    poll_date: today,
    question,
    options: opts,
    updated_at: new Date().toISOString(),
  });

  redirect("/admin/poll?saved=1");
}
