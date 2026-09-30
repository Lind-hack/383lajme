import assert from 'node:assert/strict';
import test from 'node:test';
import { educationRow, educationalPublisher, educationalVideoId, validateEducationInput, verifyEducationalVideo } from './reagimi-education.mjs';
const id = 'rb7TVW77ZCs';
const input = { date: '2026-09-30', title: 'Si funksionojnë vaksinat?', context: 'Një shpjegim i sistemit imunitar nga TED-Ed.', videoUrl: `https://youtu.be/${id}` };
const metadata = { type: 'video', title: 'How do vaccines work?', author_url: 'https://www.youtube.com/@TEDEd', html: `<iframe src="https://www.youtube.com/embed/${id}"></iframe>` };
const fetcher = data => async () => ({ ok: true, json: async () => data });

test('only exact verified educational channel URLs are accepted, including normalized case', () => {
  assert.equal(educationalPublisher('https://www.youtube.com/@TEDEd'), 'TED-Ed');
  assert.equal(educationalPublisher('https://www.youtube.com/@NASAgovVideo/'), 'NASA Video');
  for (const channel of ['@KlanKosova', '@KOHA', '@RTK', '@T7', '@Dukagjini', '@Teve1', '@GazetaExpress', '@Nacionale', '@TED_ED_Fan']) {
    assert.equal(educationalPublisher(`https://www.youtube.com/${channel}`), null);
  }
  for (const url of ['https://www.youtube.com.evil.test/@TEDEd', 'https://evil.test/@TEDEd', 'http://www.youtube.com/@TEDEd', 'https://user@www.youtube.com/@TEDEd']) assert.equal(educationalPublisher(url), null);
});
test('video URLs cannot spoof YouTube or send verification requests to another host', () => {
  assert.equal(educationalVideoId(input.videoUrl), id);
  assert.equal(educationalVideoId(`https://www.youtube.com/watch?v=${id}`), id);
  for (const raw of [`https://evil.test/watch?v=${id}`, `https://youtube.com.evil.test/embed/${id}`, `http://youtu.be/${id}`, `https://youtu.be/${id}x`, 'javascript:alert(1)']) assert.equal(educationalVideoId(raw), null);
});
test('verification trusts the provider channel URL, never a claimed publisher name', async () => {
  const result = await verifyEducationalVideo(input.videoUrl, fetcher(metadata));
  assert.equal(result.publisher, 'TED-Ed');
  await assert.rejects(verifyEducationalVideo(input.videoUrl, fetcher({ ...metadata, author_name: 'TED-Ed', author_url: 'https://www.youtube.com/@KlanKosova' })), /not an approved/);
});
test('missing owner, unavailable videos and mismatched embeds fail closed', async () => {
  await assert.rejects(verifyEducationalVideo(input.videoUrl, fetcher({ ...metadata, author_url: undefined })), /not an approved/);
  await assert.rejects(verifyEducationalVideo(input.videoUrl, async () => ({ ok: false })), /available embeddable/);
  await assert.rejects(verifyEducationalVideo(input.videoUrl, fetcher({ ...metadata, html: '<iframe src="https://evil.test"></iframe>' })), /confirm/);
});
test('only the current local day with complete bounded educational copy can publish', () => {
  assert.equal(validateEducationInput(input, input.date).title, input.title);
  assert.throws(() => validateEducationInput({ ...input, date: '2026-09-29' }, input.date), /today/);
  assert.throws(() => validateEducationInput({ ...input, context: '' }, input.date), /context/);
  assert.throws(() => validateEducationInput({ ...input, title: 'a'.repeat(401) }, input.date), /title/);
});
test('published rows use verified attribution and embed, never model-supplied channel labels', async () => {
  const result = await verifyEducationalVideo(input.videoUrl, fetcher(metadata));
  const row = educationRow(input, result);
  assert.equal(row.speaker_name, 'TED-Ed');
  assert.equal(row.speaker_role, 'Video edukative');
  assert.equal(row.video_url, `https://www.youtube.com/embed/${id}`);
  assert.equal(row.article_slug, null);
});
