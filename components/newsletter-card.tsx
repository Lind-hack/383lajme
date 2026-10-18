import { MailOpen } from 'lucide-react';
import NewsletterSignup from './newsletter-signup';
import styles from './newsletter-card.module.css';

/* Local extension of 383, code-led; no new visual identity.
 * THESIS: a weekly letter interrupts the news scroll with a useful invitation.
 * OWN-WORLD: 383 orange, ink and cream; Manrope; a folded physical envelope.
 * STORY: recognise weekly news, enter email inline, confirm from the inbox.
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
        <div className={styles.postmark}><span>PRISHTINË</span><strong>383</strong><span>PËR TY</span></div>
        <div className={styles.envelope}>
          <div className={styles.envelopeBack} />
          <div className={styles.letter}>
            <div className={styles.letterHeader}><strong>383<span>.</span></strong><span>E DIEL<br />18:00</span></div>
            <p>Java në<br />pak minuta.</p>
            <div className={styles.letterLines}><i /><i /><i /></div>
          </div>
          <div className={styles.foldLeft} /><div className={styles.foldRight} /><div className={styles.foldBottom} />
          <span className={styles.seal}>383</span>
        </div>
        <span className={styles.note}>Nga 383. Për ty.</span>
      </div>}
    </section>
  );
}
