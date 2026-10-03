import assert from "node:assert/strict";
import test from "node:test";
import { FRAME, LAYOUTS, MAX_PHOTOS, MEMORIES_H, MEMORIES_W, VIBES, coverCrop, photoRects } from "./memories-layout.mjs";
import { contrastRatio } from "./qr-art.mjs";

test("every layout places every photo inside the woven frame, without overlaps", () => {
  for (const layout of LAYOUTS) {
    for (let n = 1; n <= MAX_PHOTOS; n += 1) {
      const rects = photoRects(layout, n);
      assert.equal(rects.length, n, `${layout} ${n}`);
      for (const r of rects) {
        assert.ok(r.x >= FRAME && r.y >= FRAME && r.x + r.w <= MEMORIES_W - FRAME && r.y + r.h <= MEMORIES_H - FRAME, `${layout} ${n}`);
        assert.ok(r.w > 40 && r.h > 40);
      }
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i];
          const b = rects[j];
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          assert.ok(!overlap, `${layout} ${n}: ${i} overlaps ${j}`);
        }
      }
    }
  }
  assert.deepEqual(photoRects("grid", 0), []);
  assert.equal(photoRects("grid", 99).length, MAX_PHOTOS);
});

test("cover crop fills the box and stays inside the source", () => {
  const c = coverCrop(4000, 3000, 500, 500);
  assert.equal(Math.round(c.sw), 3000);
  assert.equal(Math.round(c.sh), 3000);
  assert.ok(c.sx >= 0 && c.sy >= 0);
});

test("caption text stays readable on every vibe's ground", () => {
  for (const [name, vibe] of Object.entries(VIBES)) {
    assert.ok(contrastRatio(vibe.text, vibe.ground) >= 4.5, name);
  }
});
