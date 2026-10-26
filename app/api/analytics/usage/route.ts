import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { pertyLoopReport, type LoopEvent } from '@/lib/perty-loop-report.mjs';
import { parseUsageBatch } from '@/lib/usage-events.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const buckets = new Map<string, { until: number; count: number }>();

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const accepted = ['https://383ks.com', 'https://www.383ks.com'];
  if (process.env.NODE_ENV !== 'production') accepted.push(new URL(request.url).origin);
  if (!origin || !accepted.includes(origin)) return new Response(null, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 16_384) return new Response(null, { status: 413 });
  const secret = process.env.CRON_SECRET;
  const client = createAdminClient();
  if (!secret || !client) return new Response(null, { status: 503 });
  const ipKey = createHmac('sha256', secret).update(request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').digest('hex');
  const now = Date.now();
  if (buckets.size >= 10_000) for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
  if (buckets.size >= 10_000 && !buckets.has(ipKey)) return new Response(null, { status: 429 });
  const bucket = buckets.get(ipKey);
  if (bucket && bucket.until > now && bucket.count >= 120) return new Response(null, { status: 429 });
  buckets.set(ipKey, bucket && bucket.until > now ? { ...bucket, count: bucket.count + 1 } : { until: now + 60_000, count: 1 });
  let parsed;
  try {
    const text = await request.text();
    if (text.length > 16_384) return new Response(null, { status: 413 });
    parsed = parseUsageBatch(JSON.parse(text));
  } catch { return new Response(null, { status: 400 }); }
  if (!parsed) return new Response(null, { status: 400 });
  const digest = (value: string) => createHmac('sha256', secret).update('usage:' + value).digest('hex');
  const visitor_hash = digest(parsed.visitor), session_hash = digest(parsed.session);
  const { error } = await client.rpc('record_site_usage', { p_events: parsed.events.map(event => ({ ...event, visitor_hash, session_hash })) });
  return new Response(null, { status: error ? 503 : 204 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!secret || !timingSafeEqual(hash(supplied), hash('Bearer ' + secret))) return new Response(null, { status: 401 });
  const client = createAdminClient();
  if (!client) return new Response(null, { status: 503 });
  if (new URL(request.url).searchParams.get('report') === 'per-ty') {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const events: LoopEvent[] = [];
    // Supabase caps pages at 1,000. Never silently report a truncated denominator.
    for (let offset = 0; offset < 50_000; offset += 1000) {
      const { data, error } = await client.from('site_usage_events')
        .select('path,visitor_hash,created_at,kind,action')
        .eq('path', '/per-ty').in('kind', ['page', 'click'])
        .gte('created_at', since).lte('created_at', now.toISOString())
        .order('created_at').order('id').range(offset, offset + 999);
      if (error) return NextResponse.json({ error: 'Reading measurements unavailable' }, { status: 503 });
      events.push(...(data || []));
      if (!data || data.length < 1000) return NextResponse.json(pertyLoopReport(events, now), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    return NextResponse.json({ error: 'Report exceeds event limit; narrow the window before reporting' }, { status: 503 });
  }
  const { data, error } = await client.rpc('site_usage_summary');
  if (error) return NextResponse.json({ error: 'Usage measurements unavailable' }, { status: 503 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
