// A publisher's og:image is evidence for comparison, never a publication photo.
const licenses = new Map([
  ['CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/'],
]);
for (const kind of ['BY', 'BY-SA']) for (const version of ['2.0', '2.5', '3.0', '4.0']) {
  licenses.set(`CC ${kind} ${version}`, `https://creativecommons.org/licenses/${kind.toLowerCase()}/${version}/`);
}
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
function identity(value) {
  try {
    const url = new URL(value);
    let path = decodeURIComponent(url.pathname);
    const host = url.hostname === 'thumb.wikimedia.org' ? 'upload.wikimedia.org' : url.hostname;
    if (host === 'upload.wikimedia.org' && path.includes('/thumb/')) {
      path = path.replace('/thumb/', '/');
      path = path.slice(0, path.lastIndexOf('/'));
    }
    return `${host}${path}`;
  } catch { return null; }
}
export function approvedBotaImage(article) {
  const rights = article?.imageRights;
  if (!rights || typeof rights !== 'object' || rights.provider !== 'wikimedia-commons' || rights.distinct_from_source !== true) return null;
  if (!text(article.imageSubject, 200) || !text(article.imageCaption, 700) || !text(rights.subject_evidence, 500)) return null;
  if (typeof rights.license !== 'string') return null;
  if (rights.license.startsWith('CC BY') && !text(rights.creator, 500)) return null;
  if (!/^[a-f0-9]{64}$/.test(rights.sha256 ?? '') || !Number.isFinite(Date.parse(rights.verified_at))) return null;
  if (!licenses.has(rights.license) || licenses.get(rights.license) !== rights.license_url) return null;
  if (!Array.isArray(rights.source_images_checked) || rights.source_images_checked.length > 8 || rights.source_images_checked.some(url => !text(url, 3000) || !identity(url))) return null;
  if (!(article.imageWidth >= 1200 && article.imageHeight >= 630)) return null;
  try {
    const image = new URL(article.imageUrl), page = new URL(rights.source_page);
    if (image.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(image.hostname) || image.username || image.password || image.port) return null;
    if (page.protocol !== 'https:' || page.hostname !== 'commons.wikimedia.org' || !page.pathname.startsWith('/wiki/File:') || page.username || page.password || page.port) return null;
    if (rights.source_images_checked.some(url => identity(url) === identity(article.imageUrl))) return null;
    return {imageUrl: image.href, imageWidth: article.imageWidth, imageHeight: article.imageHeight, imageSubject: article.imageSubject, imageCaption: article.imageCaption, imageRights: rights};
  } catch { return null; }
}
export function safeBotaImage(article) {
  return {...article, ...(approvedBotaImage(article) ?? {imageUrl: null, imageRights: null, imageCaption: null, imageSubject: null, imageWidth: null, imageHeight: null})};
}
