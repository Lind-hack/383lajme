import { MOCK_ARTICLES, type Article } from "./mock-data";

const GHOST_URL = process.env.GHOST_URL;
const GHOST_KEY = process.env.GHOST_CONTENT_API_KEY;

function isGhostConfigured(): boolean {
  return Boolean(GHOST_URL && GHOST_KEY);
}

export async function getPosts(): Promise<Article[]> {
  if (!isGhostConfigured()) return MOCK_ARTICLES;

  try {
    const res = await fetch(
      `${GHOST_URL}/ghost/api/content/posts/?key=${GHOST_KEY}&limit=10&include=tags,authors`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return MOCK_ARTICLES;
    const data = await res.json();
    return data.posts ?? MOCK_ARTICLES;
  } catch {
    return MOCK_ARTICLES;
  }
}

export async function getPostBySlug(slug: string): Promise<Article | null> {
  if (!isGhostConfigured()) {
    return MOCK_ARTICLES.find((a) => a.slug === slug) ?? null;
  }

  try {
    const res = await fetch(
      `${GHOST_URL}/ghost/api/content/posts/slug/${slug}/?key=${GHOST_KEY}&include=tags,authors`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.posts?.[0] ?? null;
  } catch {
    return null;
  }
}
