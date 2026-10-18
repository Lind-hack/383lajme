import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { encryptNewsletterMail } from './newsletter-mail.mjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderWeeklyEmail, selectWeeklyStories, signUnsubscribe, weeklyWindow, type EmailMessage, type WeeklyIssue } from './newsletter.mjs';

function newsletterStorageConfig() {
  const secret = process.env.NEWSLETTER_SECRET || '';
  const admin = createAdminClient();
  if (secret.length < 32 || !admin) throw new Error('Newsletter database configuration missing');
  return { secret, admin };
}
export function newsletterConfig() {
  const storage = newsletterStorageConfig();
  const key = process.env.RESEND_API_KEY || '';
  const from = process.env.NEWSLETTER_FROM || '';
  const origin = new URL(process.env.NEWSLETTER_SITE_URL || 'https://383ks.com');
  if (origin.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(origin.hostname))) throw new Error('Newsletter requires HTTPS');
  if (!key || !from || /[\r\n]/.test(from)) throw new Error('Newsletter email configuration missing');
  return { ...storage, key, from, origin: origin.origin, queueEnabled: process.env.NEWSLETTER_SMTP_QUEUE === '1' };
}
export class NewsletterRateLimitError extends Error {}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

class DeliveryError extends Error {
  constructor(public status: number) { super('email_provider_' + status); }
}
async function sendEmail(config: ReturnType<typeof newsletterConfig>, to: string, message: EmailMessage, idempotencyKey: string, unsubscribe?: string, delivery?: { subscriberId: string; issueId?: string; claimToken?: string; confirmationHash?: string; expiresAt: string }) {
  const headers = unsubscribe ? { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {};
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8_000),
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: config.from, to: [to], ...message,
      headers }),
  });
  const data = await response.json();
  if (!response.ok) {
    // Only a definite quota rejection is safe to reroute. An uncertain Resend
    // timeout must retry its idempotency key, never send through a second provider.
    if (response.status !== 429 || data.name !== 'daily_quota_exceeded' || !config.queueEnabled || !delivery) throw new DeliveryError(response.status);
    const id = createHash('sha256').update(idempotencyKey).digest('hex');
    const queued = await config.admin.rpc('enqueue_newsletter_mail', {
      p_id: id, p_subscriber_id: delivery.subscriberId, p_issue_id: delivery.issueId || null,
      p_claim_token: delivery.claimToken || null, p_confirmation_hash: delivery.confirmationHash || null,
      p_expires_at: delivery.expiresAt,
      p_payload: encryptNewsletterMail({ to, ...message, headers }, config.secret, id),
    });
    if (queued.error || queued.data !== true) throw new Error('newsletter_queue_unavailable');
    return 'queue:' + id;
  }
  if (typeof data.id !== 'string') throw new Error('email_provider_invalid_receipt');
  return data.id as string;
}

export async function requestNewsletter(email: string, ip: string) {
  const config = newsletterStorageConfig();
  const ipHash = createHmac('sha256', config.secret).update('newsletter-ip:' + ip).digest('hex');
  const { data, error } = await config.admin.rpc('activate_newsletter_subscription', { p_email: email, p_ip_hash: ipHash });
  if (error || typeof data !== 'boolean') throw new Error('subscription_storage_unavailable');
  if (!data) throw new NewsletterRateLimitError('newsletter_rate_limited');
}

async function loadIssue(config: ReturnType<typeof newsletterConfig>, window: ReturnType<typeof weeklyWindow>): Promise<WeeklyIssue | null> {
  const existing = await config.admin.from('newsletter_issues').select('content').eq('id', window.id).maybeSingle();
  if (existing.error) throw new Error('newsletter_issue_unavailable');
  if (existing.data) return existing.data.content as WeeklyIssue;
  const articles: Record<string, unknown>[] = [];
  // Paginate the full week instead of taking only the most recent stories.
  for (let page = 0; page <= 10; page++) {
    const { data, error } = await config.admin.from('news_articles')
      .select('id,slug,title,excerpt,body,source,category,published_at,engagement_score,image_url,image_caption:raw_article->>image_caption,image_rights:raw_article->image_rights')
      .gt('published_at', window.start).lte('published_at', window.end)
      .order('published_at').order('id').range(page * 1000, page * 1000 + 999);
    if (error) throw new Error('newsletter_archive_unavailable');
    if (page === 10 && data?.length) throw new Error('newsletter_archive_exceeds_limit');
    articles.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const selected = selectWeeklyStories(articles, window);
  if (!selected.stories.length) return null;
  const issue: WeeklyIssue = { ...window, ...selected };
  const created = await config.admin.from('newsletter_issues').upsert({ id: window.id, cutoff: window.end, content: issue }, { onConflict: 'id', ignoreDuplicates: true });
  if (created.error) throw new Error('newsletter_issue_not_saved');
  // Another worker may have won; always use the single persisted snapshot.
  const saved = await config.admin.from('newsletter_issues').select('content').eq('id', window.id).single();
  if (saved.error) throw new Error('newsletter_issue_unavailable');
  return saved.data.content as WeeklyIssue;
}

export async function sendWeeklyNewsletter() {
  const now = new Date(), window = weeklyWindow(now);
  // Sunday evening through Monday afternoon only; no surprise midweek sends.
  if (now.getTime() - Date.parse(window.end) >= 20 * 3_600_000) return { skipped: 'outside_weekly_window', sent: 0, failed: 0, pending: 0, held: 0 };
  const config = newsletterConfig();
  const issue = await loadIssue(config, window);
  if (!issue) return { skipped: 'no_published_stories', sent: 0, failed: 0, pending: 0, held: 0 };
  let sent = 0, failed = 0, queued = 0;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await config.admin.rpc('claim_newsletter_delivery', { p_issue_id: issue.id });
    if (error) throw new Error('newsletter_claim_failed');
    const claim = data?.[0] as { subscriber_id: string; email: string; claim_token: string } | undefined;
    if (!claim) break;
    // Recheck consent immediately before contacting the provider.
    const current = await config.admin.from('newsletter_subscribers').select('status,confirmed_at').eq('id', claim.subscriber_id).single();
    if (current.error) throw new Error('newsletter_consent_unavailable');
    if (current.data.status !== 'active' || current.data.confirmed_at > issue.end) continue;
    let providerId: string;
    try {
      const token = signUnsubscribe(claim.subscriber_id, config.secret);
      providerId = await sendEmail(config, claim.email, renderWeeklyEmail(issue, config.origin, token),
        `newsletter-weekly/${issue.id}/${claim.subscriber_id}`, `${config.origin}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
          subscriberId: claim.subscriber_id, issueId: issue.id, claimToken: claim.claim_token,
          expiresAt: new Date(Date.parse(issue.end) + 20 * 3_600_000).toISOString(),
        });
      if (providerId.startsWith('queue:')) { queued++; continue; }
    } catch (error) {
      failed++;
      const permanent = error instanceof DeliveryError && error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status);
      const updated = await config.admin.from('newsletter_deliveries').update({ status: permanent ? 'held' : 'pending',
        last_error: error instanceof DeliveryError ? error.message : 'provider_timeout_or_network', claimed_until: null,
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() })
        .eq('issue_id', issue.id).eq('subscriber_id', claim.subscriber_id).eq('claim_token', claim.claim_token).in('status', ['pending', 'held']);
      if (updated.error) throw new Error('newsletter_retry_not_saved');
      break;
    }
    const receipt = await config.admin.from('newsletter_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), provider_id: providerId, claimed_until: null, last_error: null })
      .eq('issue_id', issue.id).eq('subscriber_id', claim.subscriber_id).eq('claim_token', claim.claim_token).select('subscriber_id');
    // Record an accepted message even if consent was revoked during the provider
    // request. It cannot be recalled, and the subscriber remains opted out.
    if (receipt.error || receipt.data?.length !== 1) throw new Error('newsletter_receipt_not_saved');
    sent++;
    await new Promise(resolve => setTimeout(resolve, 550));
  }
  const [pending, held] = await Promise.all([
    config.admin.from('newsletter_deliveries').select('subscriber_id', { count: 'exact', head: true }).eq('issue_id', issue.id).eq('status', 'pending'),
    config.admin.from('newsletter_deliveries').select('subscriber_id', { count: 'exact', head: true }).eq('issue_id', issue.id).eq('status', 'held').neq('last_error', 'smtp_queued'),
  ]);
  if (pending.error || held.error) throw new Error('newsletter_status_unavailable');
  return { issue: issue.id, sent, queued, failed, pending: pending.count || 0, held: held.count || 0 };
}
