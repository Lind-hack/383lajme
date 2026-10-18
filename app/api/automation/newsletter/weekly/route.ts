import { NextResponse, type NextRequest } from 'next/server';
import { automationDenied } from '@/lib/require-automation';
import { sendWeeklyNewsletter } from '@/lib/newsletter-server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await sendWeeklyNewsletter(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Weekly newsletter unavailable. Check database and email configuration.' }, { status: 503 });
  }
}
