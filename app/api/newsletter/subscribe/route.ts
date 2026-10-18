import { NextResponse } from 'next/server';
import { normalizeEmail, newsletterRequestAllowed } from '@/lib/newsletter.mjs';
import { requestNewsletter } from '@/lib/newsletter-server';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!newsletterRequestAllowed(origin, request.url, process.env.NEWSLETTER_SITE_URL, process.env.NODE_ENV === 'production')) return NextResponse.json({ error: 'Kërkesë e palejuar.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 2048) return new Response(null, { status: 413 });
  let input;
  try {
    const body = await request.text();
    if (body.length > 2048) return new Response(null, { status: 413 });
    input = JSON.parse(body);
  } catch { return NextResponse.json({ error: 'Kërkesë e pavlefshme.' }, { status: 400 }); }
  const email = normalizeEmail(input?.email);
  if (!email || input?.consent !== true) return NextResponse.json({ error: 'Shkruaj një email të vlefshëm dhe prano abonimin javor.' }, { status: 400 });
  try {
    await requestNewsletter(email, request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown');
    return NextResponse.json({ message: 'Kontrollo emailin (edhe dosjen spam) për ta konfirmuar abonimin. Nëse je tashmë i abonuar, nuk ke nevojë të bësh asgjë.' }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Abonimi nuk është i disponueshëm tani. Provo përsëri pas pak minutash.' }, { status: 503 });
  }
}
