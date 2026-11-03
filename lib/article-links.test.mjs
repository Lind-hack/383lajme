import test from 'node:test';
import assert from 'node:assert/strict';
import { articleLinks } from './article-links.mjs';
test('registration and attribution URLs are clickable without swallowing punctuation', () => {
  const parts = articleLinks('Regjistrimi: https://forms.gle/4eES7GP1trKFMSnC6.');
  assert.equal(parts[1].url, 'https://forms.gle/4eES7GP1trKFMSnC6');
  assert.equal(parts.map((p) => p.text).join(''), 'Regjistrimi: https://forms.gle/4eES7GP1trKFMSnC6.');
});
test('unsafe or invalid protocols are never converted to anchors', () => {
  for (const text of ['javascript:alert(1)', 'https://', 'https://user:pass@example.com']) {
    assert.ok(articleLinks(text).every((part) => !part.url));
  }
});
