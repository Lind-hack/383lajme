import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleContext, embedFrame, weaveMedia, chartShape } from './article-context.mjs';

const CONTEXT = {
  v: 1, status: 'ok', what: 'Rama mbrojti tarifën.', why: 'Debati nisi në qershor.',
  media: [
    { kind: 'embed', platform: 'instagram', id: 'AbC_12-x', post: 'reel', url: 'https://www.instagram.com/reel/AbC_12-x/', author: 'shesonair_tar', caption: 'Debati në studio', after: 1 },
    { kind: 'photo', src: 'https://upload.wikimedia.org/a.jpg', credit: 'Ana · CC BY 4.0', page: 'https://commons.wikimedia.org/wiki/File:A.jpg', who: 'Albin Kurti', after: 0 },
  ],
};

test('rows from before this feature have no context', () => {
  for (const value of [undefined, null, '', 'text', 5, [], {}]) assert.equal(parseArticleContext(value), undefined);
});

test('an empty or unknown-version context shows nothing', () => {
  assert.equal(parseArticleContext({ v: 1, status: 'empty' }), undefined);
  assert.equal(parseArticleContext({ v: 2, status: 'ok', what: 'x' }), undefined);
});

test('a card with only "what" keeps it and has no why', () => {
  const got = parseArticleContext({ v: 1, status: 'ok', what: 'Vetëm kjo.' });
  assert.equal(got.what, 'Vetëm kjo.');
  assert.equal(got.why, undefined);
  assert.deepEqual(got.media, []);
});

test('media with an unsafe address is dropped, the rest survives', () => {
  const got = parseArticleContext({
    ...CONTEXT,
    media: [
      ...CONTEXT.media,
      { kind: 'embed', platform: 'instagram', id: '"><script>', url: 'https://www.instagram.com/p/x/', after: 0 },
      { kind: 'embed', platform: 'myspace', id: '1', url: 'https://myspace.com/1', after: 0 },
      { kind: 'photo', src: 'https://outlet.example/stolen.jpg', credit: 'x', page: 'https://outlet.example', after: 0 },
      { kind: 'photo', src: 'https://upload.wikimedia.org/nocredit.jpg', credit: '', after: 0 },
      null, 'x',
    ],
  });
  assert.equal(got.media.length, 2);
});

test('embed frames only ever point at the platform itself', () => {
  assert.equal(embedFrame({ platform: 'instagram', id: 'AbC_12-x', post: 'reel' }), 'https://www.instagram.com/reel/AbC_12-x/embed/captioned/');
  assert.equal(embedFrame({ platform: 'instagram', id: 'AbC_12-x' }), 'https://www.instagram.com/p/AbC_12-x/embed/captioned/');
  assert.equal(embedFrame({ platform: 'x', id: '123' }), 'https://platform.twitter.com/embed/Tweet.html?id=123&dnt=true');
  assert.equal(embedFrame({ platform: 'tiktok', id: '77' }), 'https://www.tiktok.com/player/v1/77');
  assert.equal(embedFrame({ platform: 'youtube', id: 'dQw4w9WgXcQ' }), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedFrame({ platform: 'x', id: '1"' }), undefined);
});

test('media sits after its paragraph, in order, and none is lost', () => {
  const parsed = parseArticleContext(CONTEXT);
  const woven = weaveMedia(['një', 'dy', 'tre'], parsed.media);
  assert.deepEqual(woven.map((x) => x.kind), ['paragraph', 'photo', 'paragraph', 'embed', 'paragraph']);
});

test('media placed past the end of a shorter body lands after the last paragraph', () => {
  const woven = weaveMedia(['një'], [{ kind: 'photo', after: 7 }]);
  assert.deepEqual(woven.map((x) => x.kind), ['paragraph', 'photo']);
});

test('a body with no paragraphs still shows its media', () => {
  assert.deepEqual(weaveMedia([], [{ kind: 'photo', after: 0 }]).map((x) => x.kind), ['photo']);
});

const POINTS = [['2026-10-07', 83194.95], ['2026-10-20', 90000], ['2026-11-01', 70000], ['2026-11-04', 72000], ['2026-11-06', 75597.06]];
const CHART = { kind: 'crypto', label: 'Bitcoin', unit: 'USD', points: POINTS, source: 'CoinGecko', source_url: 'https://www.coingecko.com/en/coins/bitcoin' };

test('a market chart from a known source survives, alone or with a card', () => {
  const got = parseArticleContext({ v: 1, status: 'ok', chart: CHART });
  assert.equal(got.chart.label, 'Bitcoin');
  assert.equal(got.chart.points.length, 5);
  assert.equal(got.what, undefined);
});

test('a chart with bad points, too few points or a foreign source is dropped', () => {
  const bad = [
    { ...CHART, points: POINTS.slice(0, 3) },
    { ...CHART, points: [...POINTS.slice(0, 4), ['2026-11-07', 'NaN']] },
    { ...CHART, points: [...POINTS.slice(0, 4), ['not a date', 5]] },
    { ...CHART, source: 'Someone' },
    { ...CHART, source_url: 'https://evil.example/x' },
    { ...CHART, label: '' },
  ];
  for (const chart of bad) assert.equal(parseArticleContext({ v: 1, status: 'ok', what: 'x', chart }).chart, undefined);
});

test('the chart line spans the box, highest point at the top, and reports the change', () => {
  const shape = chartShape(POINTS, 300, 100);
  assert.match(shape.line, /^M0,/);
  assert.match(shape.line, /L300,/);
  // x follows the calendar (30 days across 300): 20 October, the high, sits at x 130, y 0.
  assert.ok(shape.line.includes('L130,0'), shape.line);
  assert.ok(shape.line.endsWith(`L300,${shape.lastY}`));
  assert.equal(shape.high, 90000);
  assert.equal(shape.low, 70000);
  assert.equal(shape.first, 83194.95);
  assert.equal(shape.last, 75597.06);
  assert.equal(Math.round(shape.change * 1000) / 10, -9.1);
  assert.match(shape.area, /Z$/);
});

test('a story\'s own numbers become bars, alone or with a card', () => {
  const figures = { title: 'Votat në Prishtinë', unit: '%', items: [{ label: 'VV', value: 41.5 }, { label: 'LDK', value: 27 }, { label: 'PDK', value: 0 }] };
  assert.deepEqual(parseArticleContext({ v: 1, status: 'ok', media: [], figures }).figures, figures);
  assert.deepEqual(parseArticleContext({ ...CONTEXT, figures }).figures, figures);
});

test('figures with one bar, a bad value, a long label or no title are dropped', () => {
  const ok = { title: 'Gola', unit: '', items: [{ label: 'Kosova', value: 2 }, { label: 'Suedia', value: 1 }] };
  for (const figures of [
    { ...ok, items: ok.items.slice(0, 1) },
    { ...ok, items: [...ok.items, { label: 'X', value: -1 }] },
    { ...ok, items: [...ok.items, { label: 'X', value: '3' }] },
    { ...ok, items: [...ok.items, { label: 'a'.repeat(41), value: 3 }] },
    { ...ok, items: Array.from({ length: 7 }, (_, i) => ({ label: `L${i}`, value: i + 1 })) },
    { ...ok, items: ok.items.map((i) => ({ ...i, value: 0 })) },
    { ...ok, title: '' },
    'bars',
  ]) assert.equal(parseArticleContext({ v: 1, status: 'ok', media: [], figures }), undefined, JSON.stringify(figures));
});
