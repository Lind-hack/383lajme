import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tokenHash } from '@/lib/newsletter-server';
import { newsletterPublicOrigin } from '@/lib/newsletter.mjs';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const origin = newsletterPublicOrigin(request.url, process.env.NEWSLETTER_SITE_URL, process.env.NODE_ENV === 'production');
  const redirect = (status: string) => NextResponse.redirect(new URL('/newsletter?status=' + status, origin), 303);
  if (Number(request.headers.get('content-length') || 0) > 2048) return redirect('invalid');
  const body = await request.text();
  if (body.length > 2048) return redirect('invalid');
  const token = new URLSearchParams(body).get('token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return redirect('invalid');
  const admin = createAdminClient();
  if (!admin) return redirect('unavailable');
  const { data, error } = await admin.rpc('confirm_newsletter_subscription', { p_token_hash: tokenHash(token) });
  return redirect(error ? 'unavailable' : data ? 'confirmed' : 'invalid');
}
