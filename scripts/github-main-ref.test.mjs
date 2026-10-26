import assert from "node:assert/strict";
import test from "node:test";
import { githubMainViaGit } from "./github-main-ref.mjs";
import { verifyProductionSource } from "./verify-production-deployment.mjs";

const sha = "a".repeat(40);
const packet = (text) => (Buffer.byteLength(text) + 4).toString(16).padStart(4, "0") + text;
const advertisement = (main = sha) => packet("# service=git-upload-pack\n") + "0000"
  + packet(`${"b".repeat(40)} HEAD\0multi_ack\n`)
  + packet(`${main} refs/heads/main\n`) + "0000";
const response = (body = advertisement()) => new Response(body, {
  headers: { "content-type": "application/x-git-upload-pack-advertisement" },
});
const env = { RAILWAY_ENVIRONMENT_NAME: "production", RAILWAY_GIT_BRANCH: "main",
  RAILWAY_GIT_COMMIT_SHA: sha, RAILWAY_GIT_REPO_OWNER: "Lind-hack", RAILWAY_GIT_REPO_NAME: "383lajme" };

test("REST quota failure still requires the exact independently advertised main SHA", async () => {
  for (const status of [403, 429]) {
    const fetchImpl = async (url, options) => {
      if (url.startsWith("https://api.github.com/")) return { ok: false, status };
      assert.equal(url, "https://github.com/Lind-hack/383lajme.git/info/refs?service=git-upload-pack");
      assert.equal(options.headers.Authorization, undefined);
      return response();
    };
    assert.equal((await verifyProductionSource({ env, fetchImpl })).commitSha, sha);
    await assert.rejects(verifyProductionSource({ env: { ...env, RAILWAY_GIT_COMMIT_SHA: "c".repeat(40) }, fetchImpl }), /stale production/);
  }
});

test("missing, misleading, conflicting or truncated Git refs fail closed", async () => {
  for (const body of ["<html>" + sha + "</html>", advertisement().slice(0, -7),
    advertisement().replace("refs/heads/main", "refs/heads/main-other"),
    advertisement().replace("refs/heads/main", "refs/heads/MAIN"),
    advertisement() + packet(`${"c".repeat(40)} refs/heads/main\n`)]) {
    await assert.rejects(githubMainViaGit(async () => response(body), "Lind-hack/383lajme"));
  }
});

test("a failing Git endpoint never becomes permission to deploy", async () => {
  await assert.rejects(verifyProductionSource({ env,
    fetchImpl: async () => ({ ok: false, status: 403 }) }), /refusing production build/);
});
