import test from "node:test";
import assert from "node:assert/strict";

import { remoteImageSrc } from "./remote-image.mjs";

const AJ = "https://www.aljazeera.com/wp-content/uploads/2025/12/AP25212360542213-1766539320.jpg";

test("an allowlisted host is asked for a display-sized rendition", () => {
  assert.equal(remoteImageSrc(AJ, 1200), `${AJ}?w=1200`);
  assert.equal(remoteImageSrc(AJ, 800), `${AJ}?w=800`);
});

test("a fractional width is rounded rather than passed through as a decimal", () => {
  assert.equal(remoteImageSrc(AJ, 799.6), `${AJ}?w=800`);
});

test("hosts measured to break or bloat under the parameter are left alone", () => {
  // ?w=1200 returns a 1-byte body here; the size already lives in the path.
  const bbc = "https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/0b8b/live/x.jpg";
  assert.equal(remoteImageSrc(bbc, 1200), bbc);
  // ?w=1200 served 211 KB against a 35 KB original.
  const koha = "https://resources.koha.net/images/2022/March/25/auto_q15802140601648205210.jpg";
  assert.equal(remoteImageSrc(koha, 1200), koha);
  // Guardian renditions are signed; editing the width voids the signature.
  const guim = "https://i.guim.co.uk/img/media/009fc4/930_0_5000_4002/master/5000.jpg?s=abc";
  assert.equal(remoteImageSrc(guim, 1200), guim);
});

test("a size the author already chose is preserved", () => {
  assert.equal(remoteImageSrc(`${AJ}?w=640`, 1200), `${AJ}?w=640`);
  const cropped = `${AJ}?resize=1200%2C675`;
  assert.equal(remoteImageSrc(cropped, 1200), cropped);
});

test("an existing unrelated query survives alongside the width", () => {
  const src = `${AJ}?v=2`;
  assert.equal(remoteImageSrc(src, 1200), `${AJ}?v=2&w=1200`);
});

test("anything unusable degrades to the original value instead of throwing", () => {
  assert.equal(remoteImageSrc(undefined, 1200), undefined);
  assert.equal(remoteImageSrc("", 1200), "");
  assert.equal(remoteImageSrc("/local/hero.jpg", 1200), "/local/hero.jpg");
  assert.equal(remoteImageSrc("not a url", 1200), "not a url");
  assert.equal(remoteImageSrc("javascript:alert(1)", 1200), "javascript:alert(1)");
  assert.equal(remoteImageSrc(AJ, 0), AJ);
  assert.equal(remoteImageSrc(AJ, Number.NaN), AJ);
});
