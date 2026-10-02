import type { MetadataRoute } from "next";

/**
 * Makes 383 installable: what a phone calls it, its icon, and that it opens as
 * its own app rather than a browser tab.
 *
 * On iPhone this is not cosmetic. Apple lets a website send notifications only
 * once it is added to the home screen and opened from there as an app, so
 * without this the 07:00 edition push could never reach an iPhone reader
 * (app/per-ty/ios-install-guide.tsx walks them through it).
 *
 * It opens on Për ty: someone who installs 383 is installing their own paper.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "383",
    short_name: "383",
    description: "Lajmet e tua nga Kosova dhe bota, çdo mëngjes.",
    lang: "sq",
    start_url: "/per-ty",
    scope: "/",
    display: "standalone",
    background_color: "#F9F6F1",
    theme_color: "#F9F6F1",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
