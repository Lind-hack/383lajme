import { createClient } from '@supabase/supabase-js';
import { getArticleById } from './db';
import type { HomepagePlacement } from './homepage-placement.mjs';

/** Fetch independently: a placement must survive falling out of the ranked pool. */
export async function getHomepagePlacement() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const now = new Date().toISOString();
    const { data, error } = await client.from('homepage_placements')
      .select('article_id,starts_at,ends_at').eq('slot', 'lead')
      .lte('starts_at', now).gt('ends_at', now).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const article = await getArticleById(data.article_id);
    return article ? { article, placement: data as HomepagePlacement } : null;
  } catch {
    console.error('[news] Timed homepage placement unavailable; using normal rankings');
    return null;
  }
}
