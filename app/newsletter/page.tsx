import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Java në pak minuta · 383', description: 'Lajmet kryesore të javës, çdo të diel në emailin tënd.', robots: { index: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
const outcomes: Record<string, { title: string; text: string }> = {
  confirmed: { title: 'U abonove. Shihemi të dielën.', text: 'Emaili yt u konfirmua. Përmbledhjen e ardhshme do ta marrësh të dielën në orën 10:00, sipas orës së Kosovës.' },
  unsubscribed: { title: 'U çregjistrove.', text: 'Nuk do të marrësh më përmbledhje javore nga 383. Mund të abonohesh sërish kur të duash.' },
  invalid: { title: 'Kjo lidhje nuk është më e vlefshme.', text: 'Lidhjet e konfirmimit vlejnë 24 orë dhe përdoren vetëm një herë. Nëse e ke konfirmuar më parë, abonimi yt mbetet aktiv. Për t’u abonuar tani, shkruaj emailin në kartën në ballinë. Nuk nevojitet konfirmim i ri.' },
  unavailable: { title: 'Provo përsëri pas pak.', text: 'Nuk arritëm ta përfundonim kërkesën. Hape përsëri lidhjen nga emaili pas pak minutash.' },
};
export default async function NewsletterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const confirm = typeof params.confirm === 'string' && /^[a-f0-9]{64}$/.test(params.confirm) ? params.confirm : null;
  const unsubscribe = typeof params.unsubscribe === 'string' && /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(params.unsubscribe) ? params.unsubscribe : null;
  const outcome = typeof params.status === 'string' ? outcomes[params.status] : null;
  const action = confirm ? 'confirm' : unsubscribe ? 'unsubscribe' : null;
  if (!action && !outcome) redirect('/#newsletter');
  return <div className="min-h-screen bg-cream"><Navbar /><main className="mx-auto max-w-2xl px-6 pb-24 pt-36">
    <p className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-orange">383 · Përmbledhja javore</p>
    <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl">{action === 'confirm' ? 'Konfirmo emailin tënd.' : action === 'unsubscribe' ? 'Të ndalojmë emailet javore?' : outcome?.title || 'Një javë lajme. Pak minuta lexim.'}</h1>
    <p className="mb-8 text-base leading-7 text-muted">{action === 'confirm' ? 'Një hap i fundit: konfirmo që dëshiron lajmet kryesore të javës nga 383 në këtë adresë emaili.' : action === 'unsubscribe' ? 'Shtyp butonin për t’u çregjistruar. Nuk ke nevojë të hysh në llogari.' : outcome?.text || 'Politikë, ekonomi, botë, teknologji dhe sport. Lajmet që shënuan javën, përmbledhje të shkurtra dhe lidhje për të lexuar më shumë — çdo të diel në orën 10:00 në Kosovë.'}</p>
    {action ? <form action={`/api/newsletter/${action}`} method="post"><input type="hidden" name="token" value={confirm || unsubscribe || ''} /><button className="rounded-full bg-orange px-6 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4">{action === 'confirm' ? 'Konfirmo abonimin' : 'Çregjistrohu'}</button></form> : ['invalid', 'unavailable'].includes(String(params.status)) ? <Link className="underline underline-offset-4" href="/#newsletter">Abonohu në ballinë →</Link> : null}
    <Link className="mt-8 inline-block text-sm underline underline-offset-4" href="/">Kthehu te lajmet →</Link>
  </main><Footer /></div>;
}
