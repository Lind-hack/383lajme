import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/auth", "/profili", "/tregu-preview", "/hyr"],
    },
    sitemap: "https://www.383ks.com/sitemap.xml",
  };
}
