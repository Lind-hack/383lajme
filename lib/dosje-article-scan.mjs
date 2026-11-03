/**
 * The newest articles over several pages, for matching against dossiers.
 *
 * One page (150) is a few days of news, so a dossier created today never met
 * the stories that made it worth creating. A page that fails ends the scan with
 * what was read: the matching still runs, on fewer articles.
 *
 * @template {{ slug: string, publishedAt?: string }} T
 * @param {(q: { before?: string, limit: number }) => Promise<T[]>} readPage
 * @param {{ pageSize: number, pages: number }} opts
 * @returns {Promise<T[]>}
 */
export async function newestArticles(readPage, { pageSize, pages }) {
  const out = new Map();
  let before;
  for (let i = 0; i < pages; i++) {
    let page;
    try {
      page = await readPage({ before, limit: pageSize });
    } catch {
      break;
    }
    for (const article of page) out.set(article.slug, article);
    const last = Date.parse(page.at(-1)?.publishedAt ?? "");
    if (page.length < pageSize || !Number.isFinite(last)) break;
    // readPage takes strictly older articles and a news run shares one
    // timestamp, so step just past the last one and drop the repeats.
    before = new Date(last + 1).toISOString();
  }
  return [...out.values()];
}
