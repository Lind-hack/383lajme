import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, weeklyWindow, selectWeeklyStories, signUnsubscribe, verifyUnsubscribe, renderWeeklyEmail, renderConfirmationEmail, newsletterPublicOrigin, newsletterRequestAllowed } from './newsletter.mjs';

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
    excerpt: 'Përmbledhje e verifikuar.', category: i < 10 ? 'Politikë' : 'Ekonomi',
    published_at: '2026-10-14T12:00:00Z', engagement_score: 100 - i, source: 'Reuters' }));
  const result = selectWeeklyStories([...articles, articles[0], { ...articles[0], slug: 'duplicate' },
    { ...articles[1], slug: 'old', published_at: window.start },
    { ...articles[1], slug: 'future', published_at: '2026-10-19T12:00:00Z' },
    { ...articles[1], slug: '', title: '' }], window);
  assert.equal(result.total, 15);
  assert.equal(result.stories.length, 12);
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
  const confirmation = renderConfirmationEmail('https://383ks.com', 'abc');
  assert.ok(confirmation.text.includes('Konfirmo'));
  assert.ok(confirmation.html.includes('/newsletter?confirm=abc'));
});

test('every story has a readable summary under its topic in HTML and plain text', () => {
  const issue = { ...weeklyWindow(new Date('2026-10-18T17:00:00Z')), total: 12,
    stories: Array.from({ length: 12 }, (_, i) => ({ slug: `recap-${i}`, title: `Titulli ${i}`,
      excerpt: `Përmbledhja e plotë e lajmit ${i}.`, category: i % 2 ? 'Sport' : 'Kosovë', source: 'Reuters' })) };
  const message = renderWeeklyEmail(issue, 'https://383ks.com', 'token');
  for (const story of issue.stories) {
    assert.ok(message.html.includes(story.excerpt), `HTML omitted summary: ${story.slug}`);
    assert.ok(message.text.includes(story.excerpt));
  }
  assert.match(message.html, /<h2[^>]*>Kosovë<\/h2>/);
  assert.match(message.html, /<h2[^>]*>Sport<\/h2>/);
  assert.ok(message.html.indexOf('Titulli 10') < message.html.indexOf('>Sport</h2>'));
});

test('selection uses published body when excerpt is empty, without cutting a word in half', () => {
  const window = weeklyWindow(new Date('2026-10-18T17:00:00Z'));
  const result = selectWeeklyStories([{ slug: 'body', title: 'Titulli', excerpt: '',
    body: '<p>Qeveria publikoi vendimin e ri.</p><p>Ai hyn në fuqi të hënën.</p>',
    category: 'Kosovë', published_at: '2026-10-14T12:00:00Z' }], window);
  assert.equal(result.stories[0].excerpt, 'Qeveria publikoi vendimin e ri. Ai hyn në fuqi të hënën.');
});

test('a busy high-engagement topic cannot crowd other weekly sections out', () => {
  const window = weeklyWindow(new Date('2026-10-18T17:00:00Z'));
  const categories = ['Kosovë', 'Shqipëri', 'Botë', 'Ekonomi', 'Sport', 'Teknologji', 'Showbiz'];
  const rows = categories.flatMap((category, c) => Array.from({ length: 5 }, (_, i) => ({
    slug: `section-${c}-${i}`, title: `Ngjarja ${c} titulli ${i}`, category, excerpt: 'Përmbledhje.',
    published_at: '2026-10-14T12:00:00Z', engagement_score: 1000 - c * 100 - i,
  })));
  const result = selectWeeklyStories(rows, window);
  assert.equal(result.stories.length, 12);
  assert.deepEqual(new Set(result.stories.map(a => a.category)), new Set(categories));
});
