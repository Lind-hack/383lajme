import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Give the chosen sources their full text.
 *
 * The search index deliberately carries only slug, title and excerpt: it holds
 * up to 2000 articles in memory and refreshes every five minutes, so loading
 * every body into it would multiply that footprint by two orders of magnitude
 * for the sake of matching, which never needs more than a headline.
 *
 * The bot does need more. Asked "pse ndodhi kjo", a model handed a two-sentence
 * excerpt correctly answers that it cannot tell — the cause is in the body, and
 * the excerpt is the part that omits it. That produced a refusal on questions
 * the archive could actually answer, which is the one failure this feature
 * cannot afford in the other direction: a bot that refuses what it does know
 * teaches readers not to ask.
 *
 * So the bodies are fetched here, after retrieval has narrowed the field to at
 * most six, in one query.
 */
type Sourced = { article: { slug: string; title: string; body: string; meta?: string } };

export async function hydrateBodies<T extends Sourced>(sources: T[]): Promise<T[]> {
  const slugs = sources.map((s) => s.article?.slug).filter(Boolean);
  if (slugs.length === 0) return sources;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return sources;

  try {
    const supabase = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from("news_articles")
      .select("slug, body")
      .in("slug", slugs);

    if (error || !data) return sources;

    const bodies = new Map<string, string>();
    for (const row of data) {
      if (row?.slug && typeof row.body === "string" && row.body.trim()) {
        bodies.set(row.slug, row.body);
      }
    }

    // Falls back to the excerpt per article rather than all-or-nothing: one
    // missing body should cost that source its detail, not the whole answer.
    return sources.map((s) => {
      const full = bodies.get(s.article.slug);
      return full ? { ...s, article: { ...s.article, body: full } } : s;
    });
  } catch (error) {
    console.error("[pyet] could not load article bodies; falling back to excerpts", error);
    return sources;
  }
}
