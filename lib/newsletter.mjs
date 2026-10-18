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

const plain = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const escape = value => plain(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
  for (const a of unique) {
    const category = plain(a.category) || 'Lajme';
    if ((categories.get(category) || 0) >= 3) continue;
    selected.push(a); categories.set(category, (categories.get(category) || 0) + 1);
    if (selected.length === 8) break;
  }
  for (const a of unique) if (selected.length < 12 && !selected.includes(a)) selected.push(a);
  return { total: unique.length, stories: selected.map(a => ({ slug: a.slug, title: plain(a.title), excerpt: plain(a.excerpt).slice(0, 280), source: plain(a.source), category: plain(a.category) || 'Lajme' })) };
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
  return `<!doctype html><html lang="sq"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><title>383 · Java në pak minuta</title></head><body style="margin:0;background:#f5f2eb;color:#1a1a1a;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff"><tr><td style="padding:28px 24px;border-bottom:3px solid #ff4422"><span style="font-size:36px;font-weight:800;letter-spacing:-2px">383<span style="color:#ff4422">.</span></span><p style="margin:8px 0 0;font-size:12px;letter-spacing:2px">JAVA NË PAK MINUTA</p></td></tr><tr><td style="padding:28px 24px;font-size:16px;line-height:1.6">${content}</td></tr><tr><td style="padding:24px;background:#eeeae2;font-size:13px;line-height:1.6;color:#555">383 Media · Prishtinë, Kosovë<br>${footer}<br><a style="color:#555" href="mailto:info@383media.com">info@383media.com</a></td></tr></table></td></tr></table></body></html>`;
}

export function renderConfirmationEmail(origin, token) {
  const url = `${origin}/newsletter?confirm=${encodeURIComponent(token)}`;
  const subject = 'Konfirmo përmbledhjen javore nga 383';
  return { subject, text: `Konfirmo emailin për të marrë lajmet kryesore çdo të diel në orën 18:00 (Kosovë).\n\n${url}\n\nLidhja vlen 24 orë. Nëse nuk e kërkove ti, shpërfille këtë email. Nuk je abonuar pa konfirmim.`,
    html: frame(subject, `<h1 style="font-size:28px;line-height:1.2">Një javë lajme.<br>Pak minuta lexim.</h1><p>Çdo të diel në orën 18:00: lajmet kryesore, përmbledhje të shkurtra dhe lidhje për të lexuar më shumë.</p><p><a style="display:inline-block;background:#ff4422;color:#fff;padding:14px 22px;text-decoration:none;border-radius:6px" href="${escape(url)}">Konfirmo abonimin</a></p><p style="font-size:14px;color:#666">Lidhja vlen 24 orë. Nëse nuk e kërkove ti, shpërfille këtë email. Abonimi aktivizohet vetëm pasi ta konfirmosh.</p>`, 'Këtë email e more pas një kërkese abonimi në 383.') };
}

export function renderWeeklyEmail(issue, origin, token) {
  const unsubscribe = `${origin}/newsletter?unsubscribe=${encodeURIComponent(token)}`;
  const date = new Intl.DateTimeFormat('sq-AL', { timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric' });
  const range = `${date.format(new Date(issue.start))} – ${date.format(new Date(issue.end))}`;
  const subject = `383 · Java në pak minuta — ${issue.id}`;
  const articleUrl = a => `${origin}/article/${encodeURIComponent(a.slug)}`;
  const headline = a => `<p style="margin:0 0 6px;color:#a82c16;font-size:12px;font-weight:bold">${escape(a.category)} · ${escape(a.source)}</p><h2 style="font-size:23px;line-height:1.3;margin:0 0 10px"><a style="color:#1a1a1a;text-decoration:none" href="${escape(articleUrl(a))}">${escape(a.title)}</a></h2>`;
  const lead = issue.stories.slice(0, 8).map(a => `<div style="padding:22px 0;border-bottom:1px solid #e5e1d9">${headline(a)}<p style="margin:0 0 12px">${escape(a.excerpt)}</p><a style="color:#a82c16;font-size:14px" href="${escape(articleUrl(a))}">Lexo lajmin →</a></div>`).join('');
  const extra = issue.stories.slice(8).map(a => `<p><a style="color:#1a1a1a" href="${escape(articleUrl(a))}">${escape(a.title)}</a><br><span style="font-size:13px;color:#666">${escape(a.category)} · ${escape(a.source)}</span></p>`).join('');
  return { subject, text: `383 · Java në pak minuta\n${range}\n\nLajmet kryesore të përzgjedhura nga ${issue.total} lajme të javës në 383.\n\n` + issue.stories.map(a => `${a.category} · ${a.source}\n${a.title}\n${a.excerpt}\n${articleUrl(a)}`).join('\n\n') + `\n\nMë shumë nga 383\nTregu: ${origin}/tregu\nVizito Kosovën: ${origin}/visit\n\nÇregjistrohu: ${unsubscribe}\n383 Media · Prishtinë, Kosovë · info@383media.com`,
    html: frame('Lajmet që shënuan javën, të përmbledhura për ty.', `<p style="font-size:13px;color:#666">${escape(range)}</p><h1 style="font-size:30px;line-height:1.15;margin:12px 0">Java që lamë pas.</h1><p>Lajmet kryesore, të përzgjedhura nga <strong>${issue.total}</strong> lajme të javës në 383. Përmbledhje nga raportimet e publikuara, me burimin dhe lidhjen për çdo lajm.</p>${lead}${extra ? '<h2 style="font-size:22px;margin-top:28px">Vlen të dish edhe</h2>' + extra : ''}<h2 style="font-size:22px;margin-top:28px">Më shumë nga 383</h2><p><a style="color:#a82c16" href="${origin}/tregu">Tregu · çfarë parashikojnë lexuesit</a><br><a style="color:#a82c16" href="${origin}/visit">Visit · zbulo Kosovën</a></p>`, `Po e merr këtë përmbledhje sepse konfirmove abonimin në 383.<br><a style="color:#555" href="${escape(unsubscribe)}">Çregjistrohu</a> · <a style="color:#555" href="${origin}/privatesia">Privatësia</a>`) };
}
