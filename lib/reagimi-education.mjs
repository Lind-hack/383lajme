// Only verified educational publishers may supply Reagimi's video.
export const EDUCATIONAL_ROLE = "Video edukative";
export const EDUCATIONAL_PUBLISHERS = Object.freeze({
  "/@teded": "TED-Ed",
  "/@nasagovvideo": "NASA Video",
});

export function educationalPublisher(authorUrl) {
  try {
    const url = new URL(authorUrl);
    if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com"].includes(url.hostname) || url.username || url.password || url.port) return null;
    return EDUCATIONAL_PUBLISHERS[url.pathname.replace(/\/$/, "").toLowerCase()] ?? null;
  } catch { return null; }
}

export function educationalVideoId(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    let id;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (["youtube.com", "www.youtube.com"].includes(url.hostname)) {
      id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id ?? "") ? id : null;
  } catch { return null; }
}

export async function verifyEducationalVideo(raw, fetcher = fetch) {
  const id = educationalVideoId(raw);
  if (!id) throw new Error("A valid HTTPS YouTube video URL is required.");
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
  const response = await fetcher(endpoint, { signal: AbortSignal.timeout(10000), next: { revalidate: 3600 } });
  if (!response.ok) throw new Error("YouTube could not verify an available embeddable video.");
  const metadata = await response.json();
  const publisher = educationalPublisher(metadata.author_url);
  if (!publisher || metadata.type !== "video" || typeof metadata.title !== "string" || !metadata.title.trim()) {
    throw new Error("Video publisher is not an approved educational channel. News outlets and unknown channels are excluded.");
  }
  if (typeof metadata.html !== "string" || !metadata.html.includes(`https://www.youtube.com/embed/${id}`)) {
    throw new Error("YouTube did not confirm this video's embed.");
  }
  return { id, publisher, channelUrl: metadata.author_url, originalTitle: metadata.title, embedUrl: `https://www.youtube.com/embed/${id}` };
}

export function validateEducationInput(input, todayKey) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A video selection is required.");
  if (input.date !== todayKey) throw new Error("The selection must be for today's Kosovo date.");
  for (const [field, max] of [["title", 400], ["context", 160]]) {
    if (typeof input[field] !== "string" || !input[field].trim() || input[field].trim().length > max) throw new Error(`${field} must be nonempty and at most ${max} characters.`);
  }
  if (!educationalVideoId(input.videoUrl)) throw new Error("A valid HTTPS YouTube video URL is required.");
  return { date: todayKey, title: input.title.trim(), context: input.context.trim(), videoUrl: input.videoUrl };
}

export function educationRow(selection, verified) {
  return {
    reagimi_date: selection.date,
    quote: selection.title,
    speaker_name: verified.publisher,
    speaker_role: EDUCATIONAL_ROLE,
    context_line: selection.context,
    article_slug: null,
    video_url: verified.embedUrl,
  };
}
