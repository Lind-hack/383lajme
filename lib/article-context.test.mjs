import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleContext, embedFrame, weaveMedia } from './article-context.mjs';

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
