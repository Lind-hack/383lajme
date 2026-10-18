import { MailOpen } from 'lucide-react';
import NewsletterSignup from './newsletter-signup';
import styles from './newsletter-card.module.css';

/* Local extension of 383, code-led; no new visual identity.
 * THESIS: a weekly letter interrupts the news scroll with a useful invitation.
 * OWN-WORLD: 383 orange, ink and cream; Manrope; a folded physical envelope.
 * STORY: recognise weekly news, enter email inline, subscribe with one click.
 * FIRST VIEWPORT: large headline and form left, dimensional envelope right;
 * the drawer gets a compact version directly beneath Tregu, without navigation.
 * FORM: an editorial mail card, explicitly scoped by the user; no seed required.
 */
export default function NewsletterCard({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const headingId = compact ? 'newsletter-menu-title' : 'newsletter-title';
  const Heading = compact ? 'h3' : 'h2';
  return (
    <section id={compact ? undefined : 'newsletter'} aria-labelledby={headingId} className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.content}>
        <Heading id={headingId} className={styles.title}>
          {compact ? <>Java në email.<MailOpen size={27} strokeWidth={1.8} aria-hidden="true" /></> : <>Një javë lajme.<br />Një email për ty.</>}
        </Heading>
        <p className={styles.description}>
          {compact ? <>Lajmet kryesore, shkurt e qartë.<br />Çdo të diel, ora 18:00.</> : <>Lajmet që shënuan javën, shkurt e qartë.<br />Çdo të diel, ora 18:00 në Kosovë.</>}
        </p>
        <NewsletterSignup compact={compact} onNavigate={onNavigate} />
      </div>
      {!compact && <div className={styles.art} aria-hidden="true">
        <svg viewBox="0 0 320 260" width="320" height="260" fill="none" focusable="false">
          <path d="M33 105 151 20a14 14 0 0 1 17 0l119 85v130H33Z" fill="#e2c9aa" stroke="#9d7154" />
          <rect x="55" y="43" width="210" height="181" rx="5" fill="#fff9f2" stroke="#d5bc9f" />
          <text x="74" y="82" fill="#17130e" fontFamily="Arial,sans-serif" fontSize="31" fontWeight="800" letterSpacing="-1.5">383.</text>
          <text x="243" y="69" fill="#572213" fontFamily="Arial,sans-serif" fontSize="8" textAnchor="end">E DIEL</text>
          <text x="243" y="81" fill="#572213" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="700" textAnchor="end">18:00</text>
          <path d="M74 94h171" stroke="#e2d5c3" />
          <text x="74" y="123" fill="#17130e" fontFamily="Arial,sans-serif" fontSize="21" fontWeight="700">Java në</text>
          <text x="74" y="148" fill="#17130e" fontFamily="Arial,sans-serif" fontSize="21" fontWeight="700">pak minuta.</text>
          <path d="M74 165h167m-167 9h140m-140 9h110" stroke="#dacbb7" strokeWidth="3" />
          <path d="m33 140 127 48L287 140v95a6 6 0 0 1-6 6H39a6 6 0 0 1-6-6Z" fill="#f2e2cb" stroke="#d5bc9f" />
          <path d="m33 235 119-81a14 14 0 0 1 16 0l119 81" fill="#fff0da" stroke="#dfcbb0" />
          <circle cx="160" cy="188" r="22" fill="#ff5a36" stroke="#ac351d" />
          <circle cx="160" cy="188" r="18" stroke="#ac351d" strokeDasharray="2 2" />
          <text x="160" y="193" textAnchor="middle" fill="#17130e" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="800">383</text>
          <path d="m276 36 6 4 7-2-1 7 5 5-7 2-3 7-5-5-8 1 2-7-4-6Z" fill="#17130e" />
        </svg>
      </div>}
    </section>
  );
}
