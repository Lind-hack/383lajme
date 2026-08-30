export interface DosjeFeedArticle {
  title?: string;
  excerpt?: string;
  category?: string;
}

export interface DosjeFeedLink {
  slug: string;
  title: string;
  href: string;
}

export function dosjeLinkForArticle(article: DosjeFeedArticle): DosjeFeedLink | null;
