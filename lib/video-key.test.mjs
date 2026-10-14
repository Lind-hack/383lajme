import { test } from "node:test";
import assert from "node:assert/strict";
import { videoKey, videoIdFromKey } from "./video-key.mjs";

test("a YouTube id round-trips through its key, case and all", () => {
  for (const id of ["D4ZEFuI_wSw", "o4xOUGirL-4", "aaaaaaaaaaa", "ZZZZZZZZZZZ"]) {
    const key = videoKey(id);
    assert.match(key, /^video-[0-9a-f]{22}$/);
    assert.match(key, /^[a-z0-9-]{1,160}$/, "fits the story-slug column");
    assert.equal(videoIdFromKey(key), id);
  }
  assert.notEqual(videoKey("aaaaaaaaaaa"), videoKey("AAAAAAAAAAA"));
});

test("anything else is not a video", () => {
  for (const bad of [null, "", "short", "D4ZEFuI_wS", "D4ZEFuI_wSw!", 42]) assert.equal(videoKey(bad), null);
  for (const bad of ["kurti-ne-bruksel", "video-", "video-zz", "video-" + "0".repeat(22), null]) assert.equal(videoIdFromKey(bad), null);
});
