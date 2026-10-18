import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, weeklyWindow, selectWeeklyStories, signUnsubscribe, verifyUnsubscribe, renderWeeklyEmail, newsletterPublicOrigin, newsletterRequestAllowed, newsletterImageUrl } from './newsletter.mjs';

test('Railway internal request URLs never escape into newsletter redirects', () => {
  assert.equal(newsletterPublicOrigin('https://localhost:8080/api/newsletter/confirm', 'https://383ks.com', true), 'https://383ks.com');
  assert.equal(newsletterPublicOrigin('http://localhost:3053/x', undefined, false), 'http://localhost:3053');
  assert.throws(() => newsletterPublicOrigin('http://localhost:8080/x', 'http://example.com', true));
});

test('signup accepts public production origins behind a proxy and rejects foreign origins', () => {
  const internal = 'https://localhost:8080/api/newsletter/subscribe';
  assert.equal(newsletterRequestAllowed('https://383ks.com', internal, 'https://383ks.com', true), true);
  assert.equal(newsletterRequestAllowed('https://www.383ks.com', internal, 'https://383ks.com', true), true);
  for (const origin of [null, 'https://383ks.com.evil.example', 'https://localhost:8080']) assert.equal(newsletterRequestAllowed(origin, internal, 'https://383ks.com', true), false);
});

test('email input rejects header injection, malformed addresses and oversized input', () => {
  assert.equal(normalizeEmail(' Reader@Example.COM '), 'reader@example.com');
  for (const value of ['a@b', 'a b@example.com', 'a@example.com\r\nBcc:x@y.com', 'x'.repeat(255), null]) {
    assert.equal(normalizeEmail(value), null);
  }
});

test('Sunday 18:00 Kosovo cutoff is stable through DST and year boundaries', () => {
  for (const [now, end, start] of [
    ['2026-10-18T16:00:00Z', '2026-10-18T16:00:00.000Z', '2026-10-11T16:00:00.000Z'],
    ['2026-10-18T15:59:59Z', '2026-10-11T16:00:00.000Z', '2026-10-04T16:00:00.000Z'],
    ['2026-10-25T17:00:00Z', '2026-10-25T17:00:00.000Z', '2026-10-18T16:00:00.000Z'],
    ['2026-03-29T16:00:00Z', '2026-03-29T16:00:00.000Z', '2026-03-22T17:00:00.000Z'],
    ['2027-01-03T17:00:00Z', '2027-01-03T17:00:00.000Z', '2026-12-27T17:00:00.000Z'],
  ]) {
    const window = weeklyWindow(new Date(now));
    assert.equal(window.end, end);
    assert.equal(window.start, start);
  }
});

test('weekly stories exclude stale/future/malformed articles, deduplicate, and cover categories', () => {
  const window = weeklyWindow(new Date('2026-10-18T17:00:00Z'));
  const articles = Array.from({ length: 15 }, (_, i) => ({ slug: 'story-' + i, title: 'Lajmi ' + i,
    image_url: 'https://example.com/photo.jpg', excerpt: 'Përmbledhje e verifikuar.', category: i < 10 ? 'Politikë' : 'Ekonomi',
    published_at: '2026-10-14T12:00:00Z', engagement_score: 100 - i, source: 'Reuters' }));
  const result = selectWeeklyStories([...articles, articles[0], { ...articles[0], slug: 'duplicate' },
    { ...articles[1], slug: 'old', published_at: window.start },
    { ...articles[1], slug: 'future', published_at: '2026-10-19T12:00:00Z' },
    { ...articles[1], slug: '', title: '' }], window);
  assert.equal(result.total, 15);
  assert.equal(result.stories.length, 8);
  assert.ok(result.stories.slice(0, 6).some(a => a.category === 'Ekonomi'));
  assert.equal(new Set(result.stories.map(a => a.title)).size, result.stories.length);
});

test('unsubscribe signatures cannot be forged, repurposed or validated with a different secret', () => {
  const id = 'a0ba6535-dd52-4124-9d88-555638187cf5', secret = 's'.repeat(40);
  const token = signUnsubscribe(id, secret);
  assert.equal(verifyUnsubscribe(token, secret), id);
  for (const invalid of [token + 'x', token.replace(id, 'b'.repeat(36)), '', null]) assert.equal(verifyUnsubscribe(invalid, secret), null);
  assert.equal(verifyUnsubscribe(token, 'other-secret'), null);
  assert.throws(() => signUnsubscribe(id, ''));
});

test('email renders source-backed text safely, accessible links and a plain text alternative', () => {
  const issue = { ...weeklyWindow(new Date('2026-10-18T17:00:00Z')), total: 1, stories: [{
    slug: 'lajm/?x=1', title: '<script>alert(1)</script> & lajmi', excerpt: '<img onerror=evil> Test', category: 'Kosovë', source: 'Reuters',
  }] };
  const message = renderWeeklyEmail(issue, 'https://383ks.com', 'signed-token');
  assert.ok(!message.html.includes('<script>'));
  assert.ok(!message.html.includes('<img onerror'));
  assert.ok(message.html.includes('lajm%2F%3Fx%3D1'));
  assert.ok(message.html.includes('Çregjistrohu'));
  assert.ok(message.text.includes('Reuters'));
  assert.ok(message.text.includes('signed-token'));
  assert.ok(message.html.includes('max-width:600px'));

});

test('every story keeps its category and summary in a simple numbered reading order', () => {
  const issue = { ...weeklyWindow(new Date('2026-10-18T17:00:00Z')), total: 12,
    stories: Array.from({ length: 12 }, (_, i) => ({ slug: `recap-${i}`, title: `Titulli ${i}`,
      excerpt: `Përmbledhja e plotë e lajmit ${i}.`, category: i % 2 ? 'Sport' : 'Kosovë', source: 'Reuters' })) };
  const message = renderWeeklyEmail(issue, 'https://383ks.com', 'token');
  for (const story of issue.stories) {
    assert.ok(message.html.includes(story.excerpt), `HTML omitted summary: ${story.slug}`);
    assert.ok(message.text.includes(story.excerpt));
  }
  assert.ok(message.html.includes('1 / 12 · Kosovë'));
  assert.ok(message.html.includes('2 / 12 · Sport'));
  assert.ok(message.html.indexOf('Titulli 1</a>') < message.html.indexOf('Titulli 10</a>'));
});

test('selection uses published body when excerpt is empty, without cutting a word in half', () => {
  const window = weeklyWindow(new Date('2026-10-18T17:00:00Z'));
  const result = selectWeeklyStories([{ slug: 'body', title: 'Titulli', excerpt: '',
    image_url: 'https://example.com/body.jpg', body: '<p>Qeveria publikoi vendimin e ri.</p><p>Ai hyn në fuqi të hënën.</p>',
    category: 'Kosovë', published_at: '2026-10-14T12:00:00Z' }], window);
  assert.equal(result.stories[0].excerpt, 'Qeveria publikoi vendimin e ri. Ai hyn në fuqi të hënën.');
});

test('a busy high-engagement topic cannot crowd other weekly sections out', () => {
  const window = weeklyWindow(new Date('2026-10-18T17:00:00Z'));
  const categories = ['Kosovë', 'Shqipëri', 'Botë', 'Ekonomi', 'Sport', 'Teknologji', 'Showbiz'];
  const rows = categories.flatMap((category, c) => Array.from({ length: 5 }, (_, i) => ({
    slug: `section-${c}-${i}`, title: `Ngjarja ${c} titulli ${i}`, category, excerpt: 'Përmbledhje.', image_url: 'https://example.com/photo.jpg',
    published_at: '2026-10-14T12:00:00Z', engagement_score: 1000 - c * 100 - i,
  })));
  const result = selectWeeklyStories(rows, window);
  assert.equal(result.stories.length, 8);
  assert.deepEqual(new Set(result.stories.map(a => a.category)), new Set(categories));
});


test('selection requires article photography and useful published text, preserving credits', () => {
  const window = weeklyWindow(new Date('2026-10-18T17:00:00Z'));
  const good = { slug: 'good', title: 'Një ngjarje', excerpt: 'Vendimi u miratua të hënën.', category: 'Kosovë', published_at: '2026-10-14T12:00:00Z', image_url: 'https://images.example.com/photo.jpg?x=1&y=2', raw_article: { image_caption: 'Foto ilustruese nga arkivi', image_rights: { creator: 'Autori', license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', source_page: 'https://commons.wikimedia.org/wiki/File:Photo.jpg' } } };
  const result = selectWeeklyStories([good, {...good, slug:'missing', title:'Pa foto', image_url:null}, {...good, slug:'unsafe', title:'Foto e pavlefshme',image_url:'javascript:alert(1)'}, {...good,slug:'empty',title:'Pa tekst',excerpt:''}, {...good,slug:'headline-only',title:'Vetëm titulli',excerpt:'Vetëm titulli'}], window);
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].imageUrl, good.image_url);
  assert.equal(result.stories[0].imageCreator, 'Autori');
  const message = renderWeeklyEmail({...window,...result}, 'https://383ks.com', 'token');
  assert.equal((message.html.match(/<img /g)||[]).length, 1);
  assert.ok(message.html.includes('photo.jpg?x=1&amp;y=2'));
  assert.ok(message.html.includes('Foto ilustruese nga arkivi'));
  assert.ok(message.html.includes('CC BY 4.0'));
  assert.ok(message.html.includes('Vendimi u miratua të hënën.'));
  assert.ok(!message.html.includes('konfirmove'));
  assert.ok(Buffer.byteLength(message.html)<80000);
});

test('image URLs reject active content and private hosts', () => {
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,foo', '//example.com/image.jpg', 'https://127.0.0.1/a', 'https://user:pass@example.com/a', 'https://192.168.1.2/a', 'https://[::1]/a']) assert.equal(newsletterImageUrl(value), null);
  assert.equal(newsletterImageUrl('/photos/article.jpg'), 'https://383ks.com/photos/article.jpg');
});
