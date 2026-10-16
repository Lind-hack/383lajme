import { test } from "node:test";
import assert from "node:assert/strict";
import { videoKey, videoIdFromKey, tiktokKey, tiktokIdFromKey, instagramKey, instagramIdFromKey } from "./video-key.mjs";

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

test("a TikTok id round-trips through its own key", () => {
  const id = "7697372712783596822";
  const key = tiktokKey(id);
  assert.equal(key, `video-tt-${id}`);
  assert.match(key, /^[a-z0-9-]{1,160}$/, "fits the story-slug column");
  assert.equal(tiktokIdFromKey(key), id);
  assert.equal(videoIdFromKey(key), null, "never read as a YouTube key");
  for (const bad of [null, "", "123", "7697372712783596822x", 7697372712783596822]) assert.equal(tiktokKey(bad), null);
  assert.equal(tiktokIdFromKey(videoKey("D4ZEFuI_wSw")), null);
});

test("an Instagram reel code round-trips through its own key, case and all", () => {
  for (const code of ["DbYw8sjoGEn", "C4nW7IkJkPB", "DaFxl8_s8Fk"]) {
    const key = instagramKey(code);
    assert.match(key, /^video-ig-[0-9a-f]+$/);
    assert.match(key, /^[a-z0-9-]{1,160}$/, "fits the story-slug column");
    assert.equal(instagramIdFromKey(key), code);
    assert.equal(videoIdFromKey(key), null, "never read as a YouTube key");
  }
  assert.notEqual(instagramKey("DbYw8sjoGEn"), instagramKey("dbyw8sjogen"));
  for (const bad of [null, "", "short", "has space!x", 42]) assert.equal(instagramKey(bad), null);
});
