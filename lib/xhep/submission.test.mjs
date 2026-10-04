import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImage, checkFields, MAX_PHOTOS } from "./submission.mjs";

test("photos are recognised by their bytes, not their claimed type", () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpg");
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
  assert.equal(sniffImage(Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "latin1")), "webp");
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'>")), null);
  assert.equal(sniffImage(Buffer.from("<html>")), null);
  assert.equal(sniffImage(new Uint8Array(0)), null);
  assert.equal(sniffImage(undefined), null);
});

test("fields: a known city, explicit consent, something to send", () => {
  assert.deepEqual(checkFields({ cityId: "prizren", story: "  Ishte bukur. ", consent: "yes", photoCount: 0 }), { ok: true, cityId: "prizren", story: "Ishte bukur." });
  assert.equal(checkFields({ cityId: "tirana", story: "x", consent: "yes", photoCount: 0 }).code, "city");
  assert.equal(checkFields({ cityId: "peje", story: "x", consent: "no", photoCount: 0 }).code, "consent");
  assert.equal(checkFields({ cityId: "peje", story: "x", consent: undefined, photoCount: 1 }).code, "consent");
  assert.equal(checkFields({ cityId: "peje", story: "   ", consent: "yes", photoCount: 0 }).code, "empty");
  assert.equal(checkFields({ cityId: "peje", story: "x".repeat(2001), consent: "yes", photoCount: 0 }).code, "story");
  assert.equal(checkFields({ cityId: "peje", story: "", consent: "yes", photoCount: MAX_PHOTOS + 1 }).code, "photos");
  assert.equal(checkFields({ cityId: "peje", story: "", consent: "yes", photoCount: 2 }).ok, true);
});
