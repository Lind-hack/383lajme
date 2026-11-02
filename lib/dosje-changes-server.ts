import { createAdminClient } from "@/lib/supabase/admin";
import { buildChangeEmail } from "@/lib/dosje-report.mjs";
import { sendMail } from "@/lib/mailer";

/**
 * The reader-visible dosje changes not yet emailed (dosje_changes, migration
 * 0119), with the dossier and article titles the email shows. Links between an
 * article and a dossier that is not public are left out: no reader sees them.
 */

export const DOSJE_OWNER = "lindsylqa@gmail.com";

export type DosjeChange = {
  id: number;
  at: string;
  topic_slug: string;
  milestone_id: string | null;
  kind: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor: string | null;
  topic_title?: string;
  article_title?: string;
};

export async function pendingChanges(opts: { actor?: string } = {}): Promise<DosjeChange[]> {
  const db = createAdminClient();
  if (!db) throw new Error("Supabase admin client not configured");
  // Article links only count for a public dossier. Those of a draft or retired
  // one stay unstamped (they go out once it is live) and are never read here,
  // so they cannot crowd the window and starve newer changes.
  const { data: live, error: liveError } = await db.from("dosje_topics").select("slug").eq("status", "approved");
  if (liveError) throw new Error(`dosje_topics: ${liveError.message}`);
  const liveSlugs = (live ?? []).map((t) => String(t.slug));

  const LINKS = "(article_link,article_unlink)";
  let other = db.from("dosje_changes").select("*").is("emailed_at", null).not("kind", "in", LINKS).order("at").limit(500);
  if (opts.actor) other = other.eq("actor", opts.actor);
  const { data: otherRows, error } = await other;
  if (error) throw new Error(`dosje_changes: ${error.message}`);
  const rows = (otherRows ?? []) as DosjeChange[];
  if (liveSlugs.length && !opts.actor) {
    for (let i = 0; i < liveSlugs.length; i += 50) {
      const { data: linkRows, error: linkError } = await db
        .from("dosje_changes")
        .select("*")
        .is("emailed_at", null)
        .in("kind", ["article_link", "article_unlink"])
        .in("topic_slug", liveSlugs.slice(i, i + 50))
        .order("at")
        .limit(500);
      if (linkError) throw new Error(`dosje_changes: ${linkError.message}`);
      rows.push(...((linkRows ?? []) as DosjeChange[]));
    }
  }
  if (!rows.length) return rows;
  if (rows.length >= 500) console.warn("[dosje] 500+ unemailed changes; the rest follow in the next email");

  const slugs = [...new Set(rows.map((r) => r.topic_slug))];
  const topic = new Map<string, { title: string; status: string }>();
  for (let i = 0; i < slugs.length; i += 50) {
    const { data: topics, error: topicError } = await db
      .from("dosje_topics")
      .select("slug, title, status")
      .in("slug", slugs.slice(i, i + 50));
    if (topicError) throw new Error(`dosje_topics: ${topicError.message}`);
    for (const t of topics ?? []) topic.set(String(t.slug), t as { title: string; status: string });
  }
  const articleOf = (r: DosjeChange) => String((r.after ?? r.before)?.article_slug ?? "");

  const articleSlugs = [
    ...new Set(
      rows
        .filter((r) => r.kind === "article_link" || r.kind === "article_unlink")
        .map(articleOf)
        .filter(Boolean)
    ),
  ];
  const titles = new Map<string, string>();
  // Batched: one long `in.(...)` list is what broke /subjects.
  for (let i = 0; i < articleSlugs.length; i += 50) {
    const { data: arts } = await db.from("news_articles").select("slug, title").in("slug", articleSlugs.slice(i, i + 50));
    for (const a of arts ?? []) titles.set(String(a.slug), String(a.title));
  }

  // Nothing is written here: a dry run reads this too.
  return rows.map((r) => ({
    ...r,
    topic_title: topic.get(r.topic_slug)?.title ?? (r.after?.title as string | undefined) ?? (r.before?.title as string | undefined),
    article_title: titles.get(articleOf(r)),
  }));
}

export async function markEmailed(ids: number[]): Promise<void> {
  const db = createAdminClient();
  if (!db || !ids.length) return;
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db
      .from("dosje_changes")
      .update({ emailed_at: new Date().toISOString() })
      .in("id", ids.slice(i, i + 200));
    // The email already went out; a failed stamp means these rows appear once
    // more in the next one. Logged, not thrown, so the send is not reported failed.
    if (error) console.error("[dosje] changes emailed but not stamped:", error.message);
  }
}

/**
 * An admin edit emails at once: every unemailed change made by `actor`.
 * Never throws — an email failure must not undo or hide the edit; the change
 * then simply rides along in the next daily email.
 */
export async function emailChangesNow(actor: string): Promise<void> {
  try {
    const changes = await pendingChanges({ actor });
    if (!changes.length) return;
    const { subject, html, text } = buildChangeEmail(changes);
    await sendMail({
      purpose: "operator",
      to: DOSJE_OWNER,
      subject,
      html,
      text,
      idempotencyKey: `dosje-change:${changes.map((c) => c.id).join(",")}`,
    });
    await markEmailed(changes.map((c) => c.id));
  } catch (err) {
    console.warn("[dosje] change email not sent; it will be in the next daily email:", err);
  }
}
