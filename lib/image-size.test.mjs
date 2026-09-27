import test from "node:test";
import assert from "node:assert/strict";

import { imageSizeFromBytes, probeImageSize, withImageSizes, sharpFirst, isSharpEnough } from "./image-size.mjs";

function png(width, height) {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

/** A JPEG whose frame header sits behind an APP1 (EXIF) block of `exifBytes`. */
function jpeg(width, height, exifBytes = 20) {
  const app1 = [0xff, 0xe1, ((exifBytes + 2) >> 8) & 0xff, (exifBytes + 2) & 0xff, ...new Array(exifBytes).fill(0)];
  const sof = [0xff, 0xc2, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof, 0, 0, 0, 0]);
}

function webpVp8x(width, height) {
  const b = new Uint8Array(30);
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X")]);
  const w = width - 1, h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return b;
}

test("reads dimensions from PNG, JPEG (behind EXIF) and WebP headers", () => {
  assert.deepEqual(imageSizeFromBytes(png(1920, 1080)), { width: 1920, height: 1080 });
  assert.deepEqual(imageSizeFromBytes(jpeg(640, 424, 5000)), { width: 640, height: 424 });
  assert.deepEqual(imageSizeFromBytes(webpVp8x(2048, 1152)), { width: 2048, height: 1152 });
});

test("an incomplete or unknown header is null, never a guess", () => {
  assert.equal(imageSizeFromBytes(jpeg(640, 424, 5000).subarray(0, 300)), null);
  assert.equal(imageSizeFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])), null);
  assert.equal(imageSizeFromBytes(undefined), null);
});

function streamingFetch(bytes, { status = 206, chunk = 64 } = {}) {
  let calls = 0;
  const impl = async () => {
    calls++;
    let offset = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (offset >= bytes.length) return controller.close();
        controller.enqueue(bytes.subarray(offset, offset + chunk));
        offset += chunk;
      },
    });
    return { ok: status < 400, body };
  };
  return { impl, calls: () => calls };
}

test("probes a remote photo once and serves repeats from memory", async () => {
  const fake = streamingFetch(jpeg(1600, 900, 3000));
  const url = "https://example.test/a.jpg";
  assert.deepEqual(await probeImageSize(url, fake.impl), { width: 1600, height: 900 });
  assert.deepEqual(await probeImageSize(url, fake.impl), { width: 1600, height: 900 });
  assert.equal(fake.calls(), 1);
});

test("a failing host resolves to null and is retried on the next render", async () => {
  const url = "https://example.test/broken.jpg";
  let calls = 0;
  const boom = async () => { calls++; throw new Error("ECONNRESET"); };
  assert.equal(await probeImageSize(url, boom), null);
  assert.equal(await probeImageSize(url, boom), null);
  assert.equal(calls, 2);
  assert.equal(await probeImageSize(url, async () => ({ ok: false, body: null })), null);
  assert.equal(await probeImageSize("/local.jpg"), null);
  assert.equal(await probeImageSize(undefined), null);
});

test("withImageSizes annotates only what it could measure", async () => {
  const fake = streamingFetch(png(1200, 675));
  const out = await withImageSizes([{ id: "a", imageUrl: "https://example.test/b.png" }, { id: "b" }], fake.impl);
  assert.deepEqual(out, [{ id: "a", imageUrl: "https://example.test/b.png", imageWidth: 1200, imageHeight: 675 }, { id: "b" }]);
});

const story = (id, imageWidth) => ({ id, imageUrl: `https://x.test/${id}.jpg`, imageWidth });

test("big slots go to sharp photos, keeping the ranking on both sides", () => {
  const list = [story("small1", 640), story("big1", 1600), story("small2", 900), story("big2", 1200), story("big3", 2048)];
  assert.deepEqual(sharpFirst(list, 1).map((a) => a.id), ["big1", "small1", "small2", "big2", "big3"]);
  assert.deepEqual(sharpFirst(list, 2).map((a) => a.id), ["big1", "big2", "small1", "small2", "big3"]);
});

test("when too few photos are sharp the big slots are still filled in order", () => {
  const list = [story("a", 640), story("b", 1300), story("c", 700), story("d", 800)];
  assert.deepEqual(sharpFirst(list, 3).map((a) => a.id), ["b", "a", "c", "d"]);
  assert.deepEqual(sharpFirst([story("a", 640), story("c", 700)], 1).map((a) => a.id), ["a", "c"]);
});

test("an unmeasured or missing photo never counts as sharp", () => {
  assert.equal(isSharpEnough({ imageUrl: "https://x.test/a.jpg" }), false);
  assert.equal(isSharpEnough({ imageWidth: 4000 }), false);
  assert.equal(isSharpEnough(undefined), false);
  assert.deepEqual(sharpFirst([], 2), []);
  assert.deepEqual(sharpFirst(undefined, 2), []);
});
