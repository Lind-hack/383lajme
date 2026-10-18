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
function summary(article) {
  const text = plain(article.excerpt) || plain(article.body);
  if (text.length <= 320) return text || plain(article.title);
  const first = text.slice(0, 321);
  const sentence = [...first.matchAll(/[.!?](?=\s|$)/g)].at(-1);
  return sentence && sentence.index >= 100 ? first.slice(0, sentence.index + 1) : first.slice(0, first.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}

/** Uses published reporting only; never falls back to demo data or generates facts. */
export function selectWeeklyStories(articles, window) {
  const start = Date.parse(window.start), end = Date.parse(window.end);
  const seenSlugs = new Set(), seenTitles = new Set();
  const ranked = articles.filter(a => {
    const date = Date.parse(a.published_at);
    return date > start && date <= end && typeof a.slug === 'string' && a.slug.trim() && plain(a.title);
  }).sort((a, b) => (Number(b.engagement_score) || 0) - (Number(a.engagement_score) || 0) || Date.parse(b.published_at) - Date.parse(a.published_at));
  const unique = ranked.filter(a => {
    const title = plain(a.title).toLocaleLowerCase('sq').replace(/[^\p{L}\p{N}]/gu, '');
    if (seenSlugs.has(a.slug) || seenTitles.has(title)) return false;
    seenSlugs.add(a.slug); seenTitles.add(title); return true;
  });
  const selected = [], categories = new Map();
  // Give each represented topic a place before allocating the remaining slots.
  for (const a of unique) {
    const category = plain(a.category) || 'Lajme';
    if (categories.has(category)) continue;
    selected.push(a); categories.set(category, 1);
    if (selected.length === 12) break;
  }
  for (const a of unique) {
    if (selected.length === 12) break;
    const category = plain(a.category) || 'Lajme';
    if (selected.includes(a) || (categories.get(category) || 0) >= 3) continue;
    selected.push(a); categories.set(category, (categories.get(category) || 0) + 1);
  }
  for (const a of unique) if (selected.length < 12 && !selected.includes(a)) selected.push(a);
  return { total: unique.length, stories: selected.map(a => ({ slug: a.slug, title: plain(a.title), excerpt: summary(a), source: plain(a.source), category: plain(a.category) || 'Lajme' })) };
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

export function renderConfirmationEmail(origin, token) {
  const url = `${origin}/newsletter?confirm=${encodeURIComponent(token)}`;
  const subject = 'Konfirmo përmbledhjen javore nga 383';
  return { subject, text: `Konfirmo emailin për të marrë lajmet kryesore çdo të diel në orën 18:00 (Kosovë).\n\n${url}\n\nLidhja vlen 24 orë. Nëse nuk e kërkove ti, shpërfille këtë email. Nuk je abonuar pa konfirmim.`,
    html: frame('Edhe një hap: konfirmo emailin tënd për lajmet e javës.', `<h1 class="email-title" style="font-family:Georgia,serif;font-size:36px;font-weight:normal;line-height:1.15;letter-spacing:-1px;margin:0 0 20px">Një javë lajme.<br>Pak minuta për ty.</h1><p style="margin:0 0 24px">Lajmet kryesore, të ndara sipas temave. Një përmbledhje e shkurtër për çdo lajm dhe lidhja për ta lexuar më tej. Çdo të diel në orën 18:00, në Kosovë.</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#17130e" style="border-radius:8px;text-align:center"><a style="display:inline-block;border:14px solid #17130e;border-left-width:22px;border-right-width:22px;background:#17130e;color:#fff9f2;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px" href="${escape(url)}">Konfirmo abonimin →</a></td></tr></table><p style="margin:24px 0 0;font-size:14px;color:#554d43">Lidhja vlen 24 orë. Abonimi aktivizohet vetëm pasi ta konfirmosh. Nëse nuk e kërkove ti, shpërfille këtë email.</p><p style="margin:14px 0 0;font-size:12px;color:#554d43">Butoni nuk hapet? <a style="color:#8c2816" href="${escape(url)}">Hap lidhjen e konfirmimit</a>.</p>`, 'Këtë email e more pas një kërkese abonimi në 383.') };
}

export function renderWeeklyEmail(issue, origin, token) {
  const unsubscribe = `${origin}/newsletter?unsubscribe=${encodeURIComponent(token)}`;
  const date = new Intl.DateTimeFormat('sq-AL', { timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric' });
  const range = `${date.format(new Date(issue.start))} – ${date.format(new Date(issue.end))}`;
  const subject = `383 · Java në pak minuta — ${issue.id}`;
  const articleUrl = a => `${origin}/article/${encodeURIComponent(a.slug)}`;
  const groups = new Map();
  for (const story of issue.stories) {
    const category = plain(story.category) || 'Lajme';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(story);
  }
  const sections = [...groups].map(([category, stories]) => `<h2 style="font-family:Georgia,serif;font-size:28px;font-weight:normal;line-height:1.25;margin:34px 0 0;padding:0 0 12px;border-bottom:2px solid #17130e">${escape(category)}</h2>${stories.map(a => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:22px 0;border-bottom:1px solid #e1dbd0"><h3 style="font-size:20px;line-height:1.35;margin:0 0 10px;font-weight:bold"><a style="color:#17130e;text-decoration:none" href="${escape(articleUrl(a))}">${escape(a.title)}</a></h3><p style="font-size:16px;line-height:1.65;margin:0 0 14px;color:#383229">${escape(summary(a))}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:12px;line-height:1.5;color:#655b4e">${escape(a.source || '383')}</td><td align="right" style="font-size:14px;font-weight:bold"><a style="color:#8c2816;text-decoration:underline" href="${escape(articleUrl(a))}">Lexo lajmin →</a></td></tr></table></td></tr></table>`).join('')}`).join('');
  const textSections = [...groups].map(([category, stories]) => `${category.toLocaleUpperCase('sq')}\n${'—'.repeat(20)}\n\n` + stories.map(a => `${a.title}\n${summary(a)}\nBurimi: ${a.source || '383'}\n${articleUrl(a)}`).join('\n\n')).join('\n\n');
  const readMinutes = Math.max(1, Math.ceil(issue.stories.reduce((sum, a) => sum + plain(a.title).split(' ').length + summary(a).split(' ').length, 0) / 200));
  return { subject, text: `383 · Java në pak minuta\n${range}\n\n${issue.stories.length} lajme të përzgjedhura nga ${issue.total} raportime të javës. Rreth ${readMinutes} minuta lexim.\n\n${textSections}\n\nMë shumë nga 383\nTregu: ${origin}/tregu\nVizito Kosovën: ${origin}/visit\n\nÇregjistrohu: ${unsubscribe}\n383 Media · Prishtinë, Kosovë · info@383media.com`,
    html: frame('Lajmet që shënuan javën, të ndara sipas temave dhe të përmbledhura për ty.', `<p style="margin:0 0 14px;font-size:13px;color:#655b4e">${escape(range)}</p><h1 class="email-title" style="font-family:Georgia,serif;font-size:40px;font-weight:normal;line-height:1.1;letter-spacing:-1px;margin:0 0 18px">Java që lamë pas.</h1><p style="margin:0 0 12px">${issue.stories.length} lajme të përzgjedhura nga ${issue.total} raportime të javës në 383. Përmbledhje të shkurtra, burimi dhe lidhja për të lexuar më tej.</p><p style="margin:0 0 24px;font-size:13px;color:#655b4e">Rreth ${readMinutes} minuta lexim · ${[...groups.keys()].map(escape).join(' / ')}</p>${sections}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;background:#f5f0e7"><tr><td style="padding:20px"><h2 style="font-size:18px;margin:0 0 10px">Më shumë nga 383</h2><p style="margin:0;font-size:14px;line-height:1.9"><a style="color:#8c2816" href="${escape(origin)}/tregu">Tregu · çfarë parashikojnë lexuesit →</a><br><a style="color:#8c2816" href="${escape(origin)}/visit">Visit · zbulo Kosovën →</a></p></td></tr></table>`, `Po e merr këtë përmbledhje sepse konfirmove abonimin në 383.<br><a style="color:#554d43" href="${escape(unsubscribe)}">Çregjistrohu</a> · <a style="color:#554d43" href="${escape(origin)}/privatesia">Privatësia</a>`) };
}
