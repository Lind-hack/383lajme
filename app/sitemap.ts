import type { MetadataRoute } from "next";
import { getArticles } from "@/lib/db";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";
import { listAllDosjeTopics } from "@/lib/dosje-entries";

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
    { url: `${BASE}/visit`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/tregu`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/dosje`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/privatesia`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryPages: MetadataRoute.Sitemap = Object.keys(SLUG_TO_CATEGORY).map(
    (slug) => ({
      url: `${BASE}/kategori/${slug}`,
      changeFrequency: "hourly",
      priority: 0.8,
    })
  );

  // A temporary upstream database outage must not prevent an otherwise valid
  // deployment. The route revalidates hourly, so article URLs are restored on
  // the next successful refresh without serving invented data.
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    articlePages = (await getArticles(500, undefined, { withBody: false }))
      .filter((a) => a.slug)
      .map((a) => ({
        url: `${BASE}/article/${a.slug}`,
        lastModified: toDate(a.createdAt) ?? toDate(a.publishedAt),
        changeFrequency: "daily" as const,
        priority: 0.6,
      }));
  } catch (error) {
    console.error("[sitemap] article lookup unavailable; emitting static sitemap", error);
  }

  // Dossiers were absent from the sitemap entirely, including the five that
  // have been live for months. Same posture as the articles above: a database
  // outage costs this section for an hour, not the deployment.
  let dosjePages: MetadataRoute.Sitemap = [];
  try {
    dosjePages = (await listAllDosjeTopics()).map((t) => ({
      url: `${BASE}/dosje/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error("[sitemap] dossier lookup unavailable; omitting dossier URLs", error);
  }

  return [...staticPages, ...categoryPages, ...dosjePages, ...articlePages];
}
