import { createHmac, timingSafeEqual } from 'node:crypto';

const ZONE = 'Europe/Tirane';
const DAY = 86_400_000;
export function newsletterPublicOrigin(requestUrl, configured, production = true) {
  const url = new URL(configured || (production ? 'https://383ks.com' : requestUrl));
  if (url.protocol !== 'https:' && !(!production && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Newsletter requires HTTPS');
  return url.origin;
}
export function newsletterRequestAllowed(origin, requestUrl, configured, production = true) {
  const publicOrigin = newsletterPublicOrigin(requestUrl, configured, production);
  const allowed = new Set([publicOrigin]);
  if (publicOrigin === 'https://383ks.com') allowed.add('https://www.383ks.com');
  if (!production) allowed.add(new URL(requestUrl).origin);
  return typeof origin === 'string' && allowed.has(origin);
}
export function normalizeEmail(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return null;
  const local = email.split('@')[0];
  return local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') ? null : email;
}

function parts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
}
function localEvening(day) {
  const target = new Date(day).setUTCHours(18, 0, 0, 0);
  let utc = target;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(utc));
    utc += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour);
  }
  return new Date(utc);
}

/** Most recent Sunday 18:00, with separate DST offsets for both boundaries. */
export function weeklyWindow(now = new Date()) {
  const p = parts(now);
  let day = Date.UTC(+p.year, +p.month - 1, +p.day);
  day -= new Date(day).getUTCDay() * DAY;
  if (localEvening(day) > now) day -= 7 * DAY;
  return { id: new Date(day).toISOString().slice(0, 10), start: localEvening(day - 7 * DAY).toISOString(), end: localEvening(day).toISOString() };
}

const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const escape = value => plain(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function reportingText(article) {
  const title = plain(article.title).toLocaleLowerCase('sq');
  return [plain(article.excerpt), plain(article.body)].find(text => text && text.toLocaleLowerCase('sq') !== title) || '';
}
function summary(article) {
  const text = reportingText(article);
  if (text.length <= 280) return text || plain(article.title);
  const first = text.slice(0, 281);
  const sentence = [...first.matchAll(/[.!?](?=\s|$)/g)].at(-1);
  return sentence && sentence.index >= 100 ? first.slice(0, sentence.index + 1) : first.slice(0, first.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}

/** Only public HTTPS photos, or the site's own absolute-path assets. */
export function newsletterImageUrl(value, origin = 'https://383ks.com') {
  if (typeof value !== 'string' || value.length > 2400) return null;
  try {
    const url = new URL(value.startsWith('/') && !value.startsWith('//') ? origin + value : value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[)/i.test(url.hostname) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch { return null; }
}
function storyPhoto(article) {
  const raw = article.raw_article && typeof article.raw_article === 'object' ? article.raw_article : {};
  const imageRights = article.image_rights || raw.image_rights;
  const rights = imageRights && typeof imageRights === 'object' ? imageRights : {};
  return { imageUrl: newsletterImageUrl(article.image_url), imageCaption: plain(article.image_caption || raw.image_caption).slice(0, 180),
    imageCreator: plain(rights.creator).slice(0, 160), imageLicense: plain(rights.license).slice(0, 60),
    imageSourcePage: newsletterImageUrl(rights.source_page), imageLicenseUrl: newsletterImageUrl(rights.license_url) };
}

/** Uses published reporting only; never falls back to demo data or generates facts. */
export function selectWeeklyStories(articles, window) {
  const start = Date.parse(window.start), end = Date.parse(window.end);
  const seenSlugs = new Set(), seenTitles = new Set();
  const ranked = articles.filter(a => {
    const date = Date.parse(a.published_at);
    return date > start && date <= end && typeof a.slug === 'string' && a.slug.trim() && plain(a.title);
  }).sort((a, b) => Number(b.featured === true) - Number(a.featured === true) || (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0) || Date.parse(b.published_at) - Date.parse(a.published_at));
  const unique = ranked.filter(a => {
    const title = plain(a.title).toLocaleLowerCase('sq').replace(/[^\p{L}\p{N}]/gu, '');
    if (seenSlugs.has(a.slug) || seenTitles.has(title)) return false;
    seenSlugs.add(a.slug); seenTitles.add(title); return true;
  });
  const eligible = unique.filter(a => newsletterImageUrl(a.image_url) && reportingText(a));
  const selected = [], categories = new Map();
  // Give each represented topic a place before allocating the remaining slots.
  for (const a of eligible) {
    const category = plain(a.category) || 'Lajme';
    if (categories.has(category)) continue;
    selected.push(a); categories.set(category, 1);
    if (selected.length === 8) break;
  }
  for (const a of eligible) {
    if (selected.length === 8) break;
    const category = plain(a.category) || 'Lajme';
    if (selected.includes(a) || (categories.get(category) || 0) >= 3) continue;
    selected.push(a); categories.set(category, (categories.get(category) || 0) + 1);
  }
  for (const a of eligible) if (selected.length < 8 && !selected.includes(a)) selected.push(a);
  return { total: unique.length, stories: selected.map(a => ({ slug: a.slug, title: plain(a.title), excerpt: summary(a), source: plain(a.source), category: plain(a.category) || 'Lajme', ...storyPhoto(a) })) };
}

export function signUnsubscribe(id, secret) {
  if (!secret) throw new Error('Newsletter signing secret required');
  return id + '.' + createHmac('sha256', secret).update('newsletter-unsubscribe:' + id).digest('base64url');
}
export function verifyUnsubscribe(token, secret) {
  if (!secret || typeof token !== 'string' || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const id = token.split('.')[0];
  const expected = Buffer.from(signUnsubscribe(id, secret));
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null;
}

function frame(preview, content, footer) {
  return `<!doctype html><html lang="sq"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><meta name="color-scheme" content="light"><title>383 · Java në pak minuta</title><!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]--><style>@media(max-width:480px){.email-pad{padding-left:20px!important;padding-right:20px!important}.email-title{font-size:32px!important}} a{word-break:break-word}</style></head><body style="margin:0;padding:0;background:#f5f2eb;color:#17130e;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f2eb"><tr><td align="center" style="padding:24px 10px"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fffdf8;border:1px solid #e1dbd0"><tr><td class="email-pad" style="padding:26px 32px;background:#ff5a36;border-bottom:1px solid #17130e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:42px;line-height:1;font-weight:800;letter-spacing:-2px;color:#17130e">383.</td><td align="right" style="font-size:13px;line-height:1.5;color:#381b12">Java në pak minuta.<br>Çdo të diel · 18:00</td></tr></table></td></tr><tr><td class="email-pad" style="padding:30px 32px;font-size:16px;line-height:1.65">${content}</td></tr><tr><td class="email-pad" style="padding:24px 32px;background:#eee8dd;font-size:13px;line-height:1.7;color:#554d43"><strong style="color:#17130e">383 Media · Prishtinë, Kosovë</strong><br>${footer}<br><a style="color:#554d43" href="mailto:info@383media.com">info@383media.com</a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

export function renderWeeklyEmail(issue, origin, token) {
  const unsubscribe = `${origin}/newsletter?unsubscribe=${encodeURIComponent(token)}`;
  const date = new Intl.DateTimeFormat('sq-AL', { timeZone: ZONE, day: 'numeric', month: 'long' });
  const range = `${date.format(new Date(issue.start))} – ${date.format(new Date(issue.end))}`;
  const subject = `383 · ${issue.stories.length} lajmet e javës`;
  const articleUrl = a => `${origin}/article/${encodeURIComponent(a.slug)}`;
  const readMinutes = Math.max(1, Math.ceil(issue.stories.reduce((sum, a) => sum + plain(a.title).split(' ').length + summary(a).split(' ').length, 0) / 200));
  const categoryOrder = ['Kosovë', 'Shqipëri', 'Botë', 'Ekonomi', 'Sport', 'Teknologji', 'Showbiz'];
  const groups = new Map();
  for (const story of issue.stories) {
    const category = plain(story.category) || 'Lajme';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(story);
  }
  const orderedGroups = [...groups].sort(([a], [b]) => {
    const rank = value => categoryOrder.includes(value) ? categoryOrder.indexOf(value) : categoryOrder.length;
    return rank(a) - rank(b) || a.localeCompare(b, 'sq');
  });
  let storyNumber = 0;
  const renderStory = a => {
    const i = storyNumber++;

    const image = newsletterImageUrl(a.imageUrl, origin);
    // Old frozen editions remain readable; new editions only select photo-backed reporting.
    const photo = image ? `<a href="${escape(articleUrl(a))}"><img src="${escape(image)}" width="112" alt="${escape('Foto për artikullin: ' + a.title)}" style="display:block;width:112px;max-width:112px;height:auto;border:0;border-radius:8px"></a>` : '';
    const credit = [a.imageCaption, a.imageCreator, a.imageLicense].filter(Boolean).map(escape).join(' · ');
    const attribution = credit ? `<p style="font-size:11px;line-height:1.5;color:#655b4e;margin:7px 0 0">${credit}${a.imageSourcePage && newsletterImageUrl(a.imageSourcePage) ? ` · <a style="color:#655b4e" href="${escape(a.imageSourcePage)}">Burimi i fotos</a>` : ''}${a.imageLicenseUrl && newsletterImageUrl(a.imageLicenseUrl) ? ` · <a style="color:#655b4e" href="${escape(a.imageLicenseUrl)}">Licenca</a>` : ''}</p>` : '';
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:26px 0;border-top:1px solid #e1dbd0"><p style="font-size:12px;line-height:1.5;font-weight:bold;color:#8c2816;margin:0 0 12px">${i + 1} / ${issue.stories.length} · ${escape(a.category || 'Lajme')}</p>${image ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="112" valign="top" style="width:112px">${photo}</td><td valign="top" style="padding-left:16px">` : ''}<h3 style="font-size:21px;line-height:1.3;margin:0 0 12px;font-weight:bold"><a style="color:#17130e;text-decoration:none" href="${escape(articleUrl(a))}">${escape(a.title)}</a></h3>${image ? '</td></tr></table>' : ''}<p style="font-size:16px;line-height:1.6;margin:14px 0 12px;color:#383229">${escape(summary(a))}</p><p style="font-size:12px;line-height:1.6;color:#655b4e;margin:0">${escape(a.source || '383')} · <a style="color:#8c2816;font-size:14px;font-weight:bold;text-decoration:underline" href="${escape(articleUrl(a))}">Lexo më shumë →</a></p>${attribution}</td></tr></table>`;
  };
  const sections = orderedGroups.map(([category, stories]) => `<h2 style="font-family:Georgia,serif;font-size:27px;line-height:1.25;font-weight:normal;margin:28px 0 0;padding-bottom:12px;border-bottom:2px solid #17130e">${escape(category)}</h2>${stories.map(renderStory).join('')}`).join('');
  let textNumber = 0;
  const textStories = orderedGroups.map(([category, stories]) => `${category.toLocaleUpperCase('sq')}\n${'—'.repeat(20)}\n\n` + stories.map(a => { const i = textNumber++; return `${i + 1} / ${issue.stories.length} · ${a.category || 'Lajme'}\n${a.title}\n${summary(a)}\nBurimi: ${a.source || '383'}\n${articleUrl(a)}`; }).join('\n\n')).join('\n\n');
  return { subject, text: `383 · Java në pak minuta\n${range}\n\n${issue.stories.length} lajme. Rreth ${readMinutes} minuta lexim. Ja çfarë ndodhi këtë javë.\n\n${textStories}\n\nKaq për këtë javë. Shihemi të dielën.\n\nÇregjistrohu: ${unsubscribe}\n383 Media · Prishtinë, Kosovë · info@383media.com`,
    html: frame(issue.stories[0]?.title || 'Lajmet që shënuan javën, shkurt e qartë.', `<p style="margin:0 0 12px;font-size:13px;color:#655b4e">${escape(range)}</p><h1 class="email-title" style="font-family:Georgia,serif;font-size:38px;font-weight:normal;line-height:1.15;letter-spacing:-1px;margin:0 0 14px">Java, shkurt e qartë.</h1><p style="margin:0 0 8px">${issue.stories.length} lajme · rreth ${readMinutes} minuta lexim.<br>Ja çfarë ndodhi këtë javë.</p>${sections}<p style="margin:12px 0 0;padding-top:24px;border-top:1px solid #e1dbd0;font-family:Georgia,serif;font-size:25px;line-height:1.3">Kaq për këtë javë.<br>Shihemi të dielën.</p>`, `Po e merr këtë përmbledhje sepse u abonove në 383.<br><a style="color:#554d43" href="${escape(unsubscribe)}">Çregjistrohu</a> · <a style="color:#554d43" href="${escape(origin)}/privatesia">Privatësia</a>`) };
}
