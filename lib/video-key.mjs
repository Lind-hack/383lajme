// A video's key where 383 keeps reactions and comments: the same column a
// story's slug goes in (story_reactions.article_slug, article_comments
// .article_slug), whose format is lowercase letters, digits and hyphens. A
// YouTube id is case-sensitive, so it is written as hex: "video-" + 22 hex
// characters, and read back exactly.

const ID = /^[A-Za-z0-9_-]{11}$/;
const KEY = /^video-([0-9a-f]{22})$/;

/** "video-…" for a YouTube id, or null for anything that is not one. */
export function videoKey(id) {
  if (typeof id !== "string" || !ID.test(id)) return null;
  let hex = "";
  for (const ch of id) hex += ch.charCodeAt(0).toString(16).padStart(2, "0");
  return `video-${hex}`;
}

/** The YouTube id inside a video key, or null for a story slug or a malformed key. */
export function videoIdFromKey(key) {
  const m = typeof key === "string" ? KEY.exec(key) : null;
  if (!m) return null;
  let id = "";
  for (let i = 0; i < m[1].length; i += 2) id += String.fromCharCode(parseInt(m[1].slice(i, i + 2), 16));
  return ID.test(id) ? id : null;
}
