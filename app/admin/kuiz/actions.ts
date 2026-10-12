"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import { publishKuizi } from "@/lib/kuizi-server";
import {
  EXPLAIN_MAX,
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_MAX,
  QUESTION_MAX,
  QUIZ_LENGTH,
  isStoredQuiz,
  type QuizQuestion,
} from "@/lib/kuizi-data.mjs";

const isDateKey = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const back = (date: string, flag: string) => redirect(`/admin/kuiz?date=${date}&${flag}`);

/** Every action checks the signed session itself; the layout is not a gate. */
async function requireAuth(): Promise<NonNullable<ReturnType<typeof createAdminClient>>> {
  if (!(await isAdminAuthed())) redirect("/admin");
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/kuiz?err=env");
  return supabase;
}

function dateFrom(formData: FormData): string {
  const raw = String(formData.get("kuiz_date") ?? "").trim();
  return isDateKey(raw) ? raw : dateKeyInKosovo();
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/kuiz");
}

/**
 * Save the admin's edit of a day's quiz and publish it.
 *
 * The edit is checked for shape (five questions, 3–4 distinct options, one
 * right index, lengths). It is not re-grounded against the articles: an
 * editor changing a question is the human check the generator lacks.
 */
export async function saveKuiziAction(formData: FormData) {
  const supabase = await requireAuth();
  const date = dateFrom(formData);

  const { data: existing } = await supabase
    .from("kuizi_daily")
    .select("questions")
    .eq("kuiz_date", date)
    .maybeSingle();
  const before: Partial<QuizQuestion>[] = Array.isArray(existing?.questions) ? existing.questions : [];

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const field = (name: string) => String(formData.get(`q${i}_${name}`) ?? "").trim();
    const options: string[] = [];
    for (let o = 0; o < MAX_OPTIONS; o++) {
      const val = field(`opt${o}`);
      if (val) options.push(val);
    }
    const correct = Number(field("correct"));
    const q = field("q");
    const explain = field("explain");
    const folded = options.map((o) => o.toLowerCase());

    if (
      q.length < 10 ||
      q.length > QUESTION_MAX ||
      !q.endsWith("?") ||
      options.length < MIN_OPTIONS ||
      options.some((o) => o.length > OPTION_MAX) ||
      new Set(folded).size !== folded.length ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= options.length ||
      !explain ||
      explain.length > EXPLAIN_MAX
    ) {
      back(date, `err=q${i + 1}`);
    }

    questions.push({
      q,
      options,
      correct,
      explain,
      slug: field("slug") || String(before[i]?.slug ?? ""),
      category: String(before[i]?.category ?? ""),
      difficulty: ([1, 2, 3] as const).includes(before[i]?.difficulty as 1 | 2 | 3)
        ? (before[i]?.difficulty as 1 | 2 | 3)
        : 2,
      trap: String(before[i]?.trap ?? ""),
    });
  }
  if (!isStoredQuiz(questions)) back(date, "err=shape");

  // Readers who already answered keep their answers; an edit that changes the
  // right option re-scores them, which is the point of correcting a mistake.
  const { error } = await supabase.from("kuizi_daily").upsert(
    {
      kuiz_date: date,
      questions,
      status: "published",
      source: "admin",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "kuiz_date" }
  );
  if (error) {
    console.error("[kuizi] admin save failed", error);
    back(date, "err=write");
  }
  refresh();
  back(date, "saved=1");
}

/** Take a day's quiz off the site (or put it back). Answers are kept. */
export async function setKuiziStatusAction(formData: FormData) {
  const supabase = await requireAuth();
  const date = dateFrom(formData);
  const status = String(formData.get("status") ?? "") === "published" ? "published" : "rejected";

  const { error } = await supabase
    .from("kuizi_daily")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("kuiz_date", date);
  if (error) {
    console.error("[kuizi] status change failed", error);
    back(date, "err=write");
  }
  refresh();
  back(date, status === "published" ? "published=1" : "unpublished=1");
}

/**
 * Throw today's quiz away and generate a new one. Only before anyone has
 * answered: deleting the row deletes its answers, and a reader's result must
 * not vanish under them.
 */
export async function regenerateKuiziAction(formData: FormData) {
  const supabase = await requireAuth();
  const date = dateFrom(formData);
  if (date !== dateKeyInKosovo()) back(date, "err=today");

  const { count } = await supabase
    .from("kuizi_answers")
    .select("voter_id", { count: "exact", head: true })
    .eq("kuiz_date", date);
  if ((count ?? 0) > 0) back(date, "err=answered");

  const { error } = await supabase.from("kuizi_daily").delete().eq("kuiz_date", date);
  if (error) back(date, "err=write");

  const outcome = await publishKuizi(supabase, new Date());
  refresh();
  if ("published" in outcome) back(date, "regenerated=1");
  back(date, `err=gen&why=${encodeURIComponent("reason" in outcome ? outcome.reason : "error" in outcome ? outcome.error : "")}`);
}
