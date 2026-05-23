import { type NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN  = process.env.GITHUB_PAT ?? "";
const REMOVE_SECRET = process.env.REMOVE_SECRET ?? "";
const GITHUB_REPO   = "Lind-hack/383lajme";
const FILE_PREFIX   = "data/auto-articles";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? "";
  const id     = searchParams.get("id")     ?? "";
  const file   = searchParams.get("file")   ?? "";

  if (!REMOVE_SECRET || secret !== REMOVE_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(file)) {
    return new NextResponse("Invalid file parameter", { status: 400 });
  }
  if (!id) {
    return new NextResponse("Missing id", { status: 400 });
  }
  if (!GITHUB_TOKEN) {
    return new NextResponse("GitHub token not configured", { status: 500 });
  }

  const filePath = `${FILE_PREFIX}/${file}`;
  const apiUrl   = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  const headers  = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };

  const getResp = await fetch(apiUrl, { headers });
  if (!getResp.ok) {
    return new NextResponse(`GitHub GET failed: ${getResp.status}`, { status: 502 });
  }

  const fileData = (await getResp.json()) as { content: string; sha: string };
  const decoded  = Buffer.from(fileData.content, "base64").toString("utf-8");
  const articles = JSON.parse(decoded) as Array<Record<string, unknown>>;
  const filtered = articles.filter((a) => a.id !== id);

  if (filtered.length === articles.length) {
    return new NextResponse(page("Artikulli nuk u gjet."), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const updated = Buffer.from(JSON.stringify(filtered, null, 2), "utf-8").toString("base64");
  const putResp = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore: remove article ${id} via one-click`,
      content: updated,
      sha: fileData.sha,
    }),
  });

  if (!putResp.ok) {
    const err = await putResp.text();
    return new NextResponse(`GitHub PUT failed: ${putResp.status} — ${err}`, { status: 502 });
  }

  return new NextResponse(
    page("Artikulli u hoq me sukses. Faqja do të përditësohet brenda ~90 sekondave."),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function page(message: string): string {
  return `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>383 Lajme</title>
  <style>
    body { background: #111; color: #fff; font-family: sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border-radius: 16px; padding: 40px 48px;
            max-width: 480px; text-align: center; }
    h1 { margin: 0 0 16px; font-size: 22px; }
    p { color: #aaa; margin: 0 0 28px; line-height: 1.6; }
    a { color: #44aaff; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>383 Lajme</h1>
    <p>${message}</p>
    <a href="/">← Kthehu në faqe</a>
  </div>
</body>
</html>`;
}
