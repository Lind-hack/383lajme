import test from 'node:test';
import assert from 'node:assert/strict';
import { propositionSearchTerms } from './tregu-news-search.mjs';
test('targeted retrieval preserves Albanian entities and rejects filter punctuation', () => {
  assert.deepEqual(propositionSearchTerms({pre_match_analysis:{proposition:{entities:['Banka e Shqipërisë','Banka e Shqipërisë','a','Kosovo%,title.ilike.*']}}}), ['Banka e Shqipërisë','Kosovo title ilike']);
  assert.deepEqual(propositionSearchTerms({}), []);
});
