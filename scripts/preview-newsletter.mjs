/** Local release smoke test. Reads server credentials from stdin, never writes them. */
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { normalizeEmail, weeklyWindow, selectWeeklyStories, renderWeeklyEmail, signUnsubscribe } from '../lib/newsletter.mjs';

const input = JSON.parse(await new Promise(resolve => { let data = ''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => resolve(data)); }));
const admin = createClient(input.NEXT_PUBLIC_SUPABASE_URL, input.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const window = weeklyWindow();
const articles = [];
for (let page = 0; page < 11; page++) {
  const { data, error } = await admin.from('news_articles').select('slug,title,excerpt,body,source,category,published_at,featured,engagement_score,image_url,image_caption:raw_article->>image_caption,image_rights:raw_article->image_rights')
    .gt('published_at', window.start).lte('published_at', window.end).order('published_at').order('id').range(page * 1000, page * 1000 + 999);
  if (error || (page === 10 && data?.length)) throw new Error('Cannot read complete published archive');
  articles.push(...(data || []));
  if (data.length < 1000) break;
}
const issue = { ...window, ...selectWeeklyStories(articles, window) };
if (!issue.stories.length) throw new Error('No published stories in the weekly window');
let token = 'preview';
if (input.recipient) {
  if (!normalizeEmail(input.recipient)) throw new Error('Invalid recipient');
  const { data, error } = await admin.from('newsletter_subscribers').select('id').eq('email', input.recipient).single();
  if (error) throw new Error('Test recipient must have requested the newsletter');
  token = signUnsubscribe(data.id, input.NEWSLETTER_SECRET);
}
const message = renderWeeklyEmail(issue, input.NEWSLETTER_SITE_URL || 'https://383ks.com', token);
await fs.writeFile(input.output, message.html);
if (input.messageOutput) await fs.writeFile(input.messageOutput, JSON.stringify({to:input.recipient,...message,subject:'[PROVË] '+message.subject}), {mode:0o600});
console.log(JSON.stringify({ stories: issue.stories.length, archive: issue.total, htmlBytes: Buffer.byteLength(message.html), output: input.output }));
if (input.recipient && !input.previewOnly) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${input.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `newsletter-preview/${issue.id}/${input.testId}` },
    body: JSON.stringify({ from: input.NEWSLETTER_FROM, to: [input.recipient], ...message, subject: '[PROVË] ' + message.subject }),
  });
  const result = await response.json();
  console.log(JSON.stringify({ providerStatus: response.status, id: result.id, error: result.name, message: result.message }));
  if (!response.ok) {
    if (response.status !== 429 || result.name !== 'daily_quota_exceeded' || !input.GMAIL_USER || !input.GMAIL_APP_PASSWORD) process.exitCode = 1;
    else {
      const smtp = nodemailer.createTransport({ service: 'gmail', auth: { user: input.GMAIL_USER, pass: input.GMAIL_APP_PASSWORD }, connectionTimeout: 8000, socketTimeout: 10000 });
      const receipt = await smtp.sendMail({ from: { name: '383 · Përmbledhja javore', address: input.GMAIL_USER }, replyTo: input.NEWSLETTER_FROM,
        to: input.recipient, ...message, subject: '[PROVË] ' + message.subject });
      console.log(JSON.stringify({ fallback: 'gmail', accepted: receipt.accepted.length }));
    }
  }
}
