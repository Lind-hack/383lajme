import type { MetadataRoute } from "next";
import { getArticles } from "@/lib/db";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";

export const revalidate = 3600;

const BASE = "https://www.383ks.com";

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/tregu`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/privatesia`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryPages: MetadataRoute.Sitemap = Object.keys(SLUG_TO_CATEGORY).map(
    (slug) => ({
      url: `${BASE}/kategori/${slug}`,
      changeFrequency: "hourly",
      priority: 0.8,
    })
  );

  const articlePages: MetadataRoute.Sitemap = (await getArticles(500))
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE}/article/${a.slug}`,
      lastModified: toDate(a.createdAt) ?? toDate(a.publishedAt),
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  return [...staticPages, ...categoryPages, ...articlePages];
}
