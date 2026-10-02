import { test } from "node:test";
import assert from "node:assert/strict";
import { iosInstallContext } from "./ios-install.mjs";

const SAFARI_17 = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const SAFARI_16_3 = SAFARI_17.replace("17_5", "16_3");
const SAFARI_16_4 = SAFARI_17.replace("17_5", "16_4");
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0";
const IPADOS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

test("Safari on an iPhone: Share is in the bottom bar", () => {
  assert.deepEqual(iosInstallContext(SAFARI_17), {
    device: "iphone",
    browser: "safari",
    supported: true,
    sharePlace: "poshtë, në mes të shiritit të Safarit",
  });
});

test("web push needs iOS 16.4 or newer", () => {
  assert.equal(iosInstallContext(SAFARI_16_3).supported, false);
  assert.equal(iosInstallContext(SAFARI_16_4).supported, true);
});

test("Chrome on an iPhone keeps Share at the top", () => {
  const c = iosInstallContext(CHROME_IOS);
  assert.equal(c.browser, "chrome");
  assert.equal(c.sharePlace, "lart djathtas, pranë adresës");
});

test("in-app browsers are recognised, and told where Share is in Safari", () => {
  // The guide sends them to Safari first, so the next step is Safari's.
  assert.equal(iosInstallContext(INSTAGRAM).browser, "other");
  assert.equal(iosInstallContext(INSTAGRAM).sharePlace, "poshtë, në mes të shiritit të Safarit");
});

test("an iPad that reports itself as a Mac is still an iPad", () => {
  assert.equal(iosInstallContext(IPADOS, 5)?.device, "ipad");
  assert.equal(iosInstallContext(IPADOS, 5)?.sharePlace, "lart djathtas, pranë adresës");
  assert.equal(iosInstallContext(IPADOS, 0), null); // a real Mac
});

test("nothing to do off Apple's phones and tablets", () => {
  assert.equal(iosInstallContext(ANDROID), null);
  assert.equal(iosInstallContext(""), null);
});
