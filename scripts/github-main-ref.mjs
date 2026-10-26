// Public Git reference discovery, independent of the REST API's shared-IP quota.
// https://git-scm.com/docs/http-protocol#_smart_clients
export async function githubMainViaGit(fetchImpl, repository) {
  const response = await fetchImpl(`https://github.com/${repository}.git/info/refs?service=git-upload-pack`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", "User-Agent": "383-production-deployment-guard" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("application/x-git-upload-pack-advertisement")) {
    throw new Error("GitHub Git reference advertisement unavailable");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10_000_000) throw new Error("Git reference advertisement exceeds limit");
  const matches = [];
  let offset = 0;
  let service = false;
  while (offset < bytes.length) {
    const prefix = bytes.subarray(offset, offset + 4).toString("ascii");
    if (!/^[0-9a-f]{4}$/i.test(prefix)) throw new Error("Invalid Git packet length");
    const length = Number.parseInt(prefix, 16);
    offset += 4;
    if (length === 0) continue;
    if (length < 4 || offset + length - 4 > bytes.length) throw new Error("Truncated Git packet");
    const payload = bytes.subarray(offset, offset + length - 4).toString("utf8");
    offset += length - 4;
    if (!service) {
      if (payload !== "# service=git-upload-pack\n") throw new Error("Unexpected Git service");
      service = true;
      continue;
    }
    const match = payload.split("\0")[0].trimEnd().match(/^([0-9a-fA-F]{40}) refs\/heads\/main$/);
    if (match) matches.push(match[1]);
  }
  if (!service || matches.length !== 1) throw new Error("GitHub did not advertise one exact main ref");
  return matches[0];
}
