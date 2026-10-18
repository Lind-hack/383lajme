'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import styles from './newsletter-signup.module.css';

export default function NewsletterSignup({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const id = useId();
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState('sending'); setMessage('');
    try {
      const response = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), consent: data.get('consent') === 'on' }), signal: AbortSignal.timeout(15_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Provo përsëri pas pak minutash.');
      setState('success'); setMessage(result.message); form.reset();
    } catch (error) {
      setState('error'); setMessage(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Lidhja u ndërpre. Provo përsëri pas pak minutash.');
    }
  }
  return (
    <form onSubmit={submit} className={`${styles.form} ${compact ? styles.compact : ''}`} aria-label="Abonimi në përmbledhjen javore" aria-busy={state === 'sending'}>
      <label className={styles.label} htmlFor={`${id}-email`}>Email-i yt</label>
      <div className={styles.inputRow}>
        <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} autoCapitalize="none" maxLength={254} placeholder="ti@shembull.com" required disabled={state === 'sending'} aria-describedby={`${id}-message`} />
        <button type="submit" disabled={state === 'sending'} aria-label={state === 'sending' ? 'Duke u regjistruar' : 'Abonohu në përmbledhjen javore'}>
          <span>{state === 'sending' ? 'Po dërgohet' : 'Abonohu'}</span>
          {state === 'sending' ? <LoaderCircle className={styles.spinner} size={17} aria-hidden /> : state === 'success' ? <Check size={17} aria-hidden /> : <ArrowRight size={17} aria-hidden />}
        </button>
      </div>
      <div className={styles.consent}>
      <label className={styles.consentChoice}>
        <input type="checkbox" name="consent" required disabled={state === 'sending'} />
        <span className={styles.consentControl} aria-hidden="true"><span /><Check size={13} strokeWidth={3} /></span>
        <span>Dua përmbledhjen javore me email. Mund të çregjistrohem kurdo.</span>
      </label>
      <Link className={styles.privacy} href="/privatesia" onClick={onNavigate}>Privatësia</Link>
      </div>
      <p id={`${id}-message`} role={state === 'error' ? 'alert' : 'status'} aria-live="polite" data-state={state} className={styles.message}>
        {state === 'sending' ? 'Duke dërguar kërkesën…' : message}
      </p>
    </form>
  );
}
