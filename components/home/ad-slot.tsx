import Link from "next/link";

/**
 * The advertising column beside Lajmet e fundit: a 300×600 half-page slot.
 *
 * Until the space is sold it carries 383's own offer to advertisers rather
 * than an empty box. It is labelled as advertising either way, and it states
 * nothing about reach or audience that 383 has not measured.
 */
export default function AdSlot() {
  return (
    <aside className="home-ad" aria-label="Reklamë">
      {/* The column runs the list's full height; the slot inside it stays in
          view while the reader scrolls the stories beside it. */}
      <div className="home-ad-sticky">
      <span className="home-ad-label">Reklamë</span>
      <div className="home-ad-frame">
        <div className="home-ad-house">
          <span className="home-ad-mark" aria-hidden>
            383<i>.</i>
          </span>
          <strong>Hapësira juaj këtu</strong>
          <p>
            Reklamo pranë lajmeve që lexuesit e Kosovës dhe të diasporës i hapin çdo ditë.
          </p>
          <Link href="/kontakt" className="home-ad-cta">
            Na kontakto <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
      </div>
    </aside>
  );
}
