import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    /**
     * Every production build compiles from scratch. Next 16 keeps a Turbopack
     * build cache in .next/cache/turbopack by default, and Railway restores
     * .next/cache between deploys: the build of d0c21ee (2026-09-30) reused the
     * previous commit's compiled globals.css, so production served the new
     * markup against the old stylesheet and every mascot image rendered at its
     * full intrinsic size. The very next build, with identical CSS, came out
     * right. A slightly slower build is the price of never shipping stale CSS.
     */
    turbopackFileSystemCacheForBuild: false,
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
    // Article cards use a sharper derivative; Next 16 only permits qualities
    // explicitly declared here.
    qualities: [75, 90],
    // A publisher's image never changes under the same URL, so re-optimizing it
    // is wasted work and a wasted Vercel transformation.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async redirects() {
    return [
      // Toni merged into Bota për Kosovën. Done here rather than only in
      // app/toni/page.tsx because a config redirect passes the query string
      // through (search results and old links deep-link ?vendi=, which the
      // Bota map preselects) and is a real 308 before any page renders. The
      // page-level redirect stays as a fallback.
      { source: "/toni", destination: "/bota-per-kosoven", permanent: true },
    ];
  },
};

export default nextConfig;
