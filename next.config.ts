import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    /**
     * Article images are hotlinked from whichever outlet published the story,
     * so the allowlist cannot be enumerated: the pipeline ingests from AP, BBC,
     * Al Jazeera, Euronews Albania and dozens more, and a new host appears
     * whenever the feed finds one.
     *
     * Only three hosts were listed here, none of which the newsroom actually
     * publishes from, so every real article image missed the optimizer and was
     * served at whatever size the publisher happened to store. One AP photo on
     * the homepage was 10.1 MB and a BBC one 3.85 MB, against a 20 MB mobile
     * page and a 20 s LCP.
     *
     * `search` and `pathname` are deliberately left unset. Setting `search: ""`
     * requires an *empty* query string, and a large share of these URLs carry
     * one — Al Jazeera's `?resize=1920%2C1440`, the Guardian's `?width=` — so
     * constraining it would 400 exactly the images that hurt most.
     */
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
    // A publisher's image never changes under the same URL, so re-optimizing it
    // is wasted work and a wasted Vercel transformation.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
