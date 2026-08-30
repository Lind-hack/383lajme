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


export interface DosjeFeedEntry {
  articleSlug: string;
  articleTitle: string;
  dossierSlug: string;
  dossierTitle: string;
  articleHref: string;
  dossierHref: string;
}

export function dosjeFeedEntries(articles: DosjeFeedArticle[]): DosjeFeedEntry[];
