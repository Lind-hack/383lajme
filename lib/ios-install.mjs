// What an iPhone or iPad reader needs to be told to add 383 to the home screen,
// read from the browser's user agent. Apple lets a website send notifications
// only from the home screen, and only from iOS 16.4; where the Share button is
// depends on the device and the browser. Pure, so it can be tested.

/**
 * @param {string} ua navigator.userAgent
 * @param {number} [touchPoints] navigator.maxTouchPoints (iPadOS reports as a Mac)
 * @returns {null | { device: "iphone" | "ipad", browser: "safari" | "chrome" | "firefox" | "edge" | "other",
 *   supported: boolean, sharePlace: string }}
 */
export function iosInstallContext(ua, touchPoints = 0) {
  const text = String(ua ?? "");
  const ipad = /iPad/.test(text) || (text.includes("Macintosh") && touchPoints > 1);
  const iphone = /iPhone|iPod/.test(text);
  if (!ipad && !iphone) return null;

  const browser = /CriOS/.test(text)
    ? "chrome"
    : /FxiOS/.test(text)
      ? "firefox"
      : /EdgiOS/.test(text)
        ? "edge"
        : /Safari/.test(text) && !/(GSA|Instagram|FBAN|FBAV|TikTok|Line)\b/.test(text)
          ? "safari"
          : "other";

  // iPadOS sends a Mac user agent without an iOS version; it is recent enough.
  const version = /OS (\d+)_(\d+)/.exec(text);
  const major = version ? Number(version[1]) : 99;
  const minor = version ? Number(version[2]) : 0;
  const supported = major > 16 || (major === 16 && minor >= 4);

  // Safari on an iPhone keeps Share in the bottom bar; on an iPad, and in
  // Chrome, Firefox and Edge on iOS, it sits at the top beside the address. An
  // in-app browser is left for Safari first, so its reader is told Safari's.
  const inSafari = browser === "safari" || browser === "other";
  const sharePlace = inSafari && !ipad ? "poshtë, në mes të shiritit të Safarit" : "lart djathtas, pranë adresës";

  return { device: ipad ? "ipad" : "iphone", browser, supported, sharePlace };
}
