import {NextResponse} from 'next/server';
import {readBotaSnapshot} from '@/lib/bota-store.mjs';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(await readBotaSnapshot(),{headers:{'Cache-Control':'no-store'}})}
