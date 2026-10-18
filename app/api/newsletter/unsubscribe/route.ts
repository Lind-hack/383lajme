import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribe, newsletterPublicOrigin } from '@/lib/newsletter.mjs';

export const runtime = 'nodejs';
// GET only opens the confirmation page: link scanners must not change consent.
export function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const target = new URL('/newsletter', newsletterPublicOrigin(request.url, process.env.NEWSLETTER_SITE_URL, process.env.NODE_ENV === 'production'));
  target.searchParams.set('unsubscribe', token.slice(0, 200));
  return NextResponse.redirect(target, 303);
}
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (Number(request.headers.get('content-length') || 0) > 2048) return new Response(null, { status: 413 });
  const body = await request.text();
  if (body.length > 2048) return new Response(null, { status: 413 });
  const form = new URLSearchParams(body);
  const oneClick = form.get('List-Unsubscribe') === 'One-Click';
  const token = url.searchParams.get('token') || form.get('token');
  const id = verifyUnsubscribe(token, process.env.NEWSLETTER_SECRET || '');
  if (!id) return new Response('Lidhje e pavlefshme.', { status: 400 });
  const admin = createAdminClient();
  if (!admin) return new Response('Provo përsëri më vonë.', { status: 503 });
  const { error } = await admin.rpc('unsubscribe_newsletter', { p_subscriber_id: id });
  if (error) return new Response('Provo përsëri më vonë.', { status: 503 });
  return oneClick ? new Response(null, { status: 204 }) : NextResponse.redirect(new URL('/newsletter?status=unsubscribed', newsletterPublicOrigin(request.url, process.env.NEWSLETTER_SITE_URL, process.env.NODE_ENV === 'production')), 303);
}
