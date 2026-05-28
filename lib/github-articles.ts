import fs from "fs";
import path from "path";

const GITHUB_PAT  = process.env.GITHUB_PAT ?? "";
const GITHUB_REPO = "Lind-hack/383lajme";
const AUTO_DIR    = path.join(process.cwd(), "data", "auto-articles");

export type RawArticle = Record<string, unknown>;

export function readArticlesFromDisk(fileName: string): RawArticle[] {
  const filePath = path.join(AUTO_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as RawArticle[];
}

// Tries filesystem write first (self-hosted). On Vercel (read-only fs),
// falls back to GitHub Contents API, which triggers a redeploy.
export async function writeArticles(
  fileName: string,
  articles: RawArticle[],
): Promise<void> {
  const filePath = path.join(AUTO_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), "utf-8");
    return;
  } catch {
    // Read-only filesystem (Vercel) — fall through to GitHub API
  }

  if (!GITHUB_PAT) {
    throw new Error("Filesystem is read-only and GITHUB_PAT is not configured");
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/auto-articles/${encodeURIComponent(fileName)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const getRes = await fetch(apiUrl, { headers });
  if (!getRes.ok) throw new Error(`GitHub GET ${getRes.status}`);
  const { sha } = (await getRes.json()) as { sha: string };

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `chore: update article data via admin`,
      content: Buffer.from(JSON.stringify(articles, null, 2)).toString("base64"),
      sha,
    }),
  });
  if (!putRes.ok) {
    throw new Error(`GitHub PUT ${putRes.status}: ${await putRes.text()}`);
  }
}
