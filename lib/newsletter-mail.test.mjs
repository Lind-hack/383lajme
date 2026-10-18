import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptNewsletterMail, decryptNewsletterMail } from './newsletter-mail.mjs';

test('mail queue encrypts private tokens and authenticates job identity and contents', () => {
  const message = { to: 'reader@example.invalid', text: 'private-confirmation-token' };
  const payload = encryptNewsletterMail(message, 'test-secret', 'job-id');
  assert.ok(!JSON.stringify(payload).includes('private-confirmation-token'));
  assert.deepEqual(decryptNewsletterMail(payload, 'test-secret', 'job-id'), message);
  assert.throws(() => decryptNewsletterMail(payload, 'other-secret', 'job-id'));
  assert.throws(() => decryptNewsletterMail(payload, 'test-secret', 'other-job'));
});
