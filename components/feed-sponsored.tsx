import Link from "next/link";
import { CoinIcon } from "./tab-icons";

/**
 * Cards that sit between rows of an endless list (the /kerko results feed).
 * Both are labelled for what they are — an advertisement, a Tregu market — so
 * nothing in the feed passes itself off as reporting.
 */

/** 383's own offer to advertisers, in the row format, until the space is sold. */
export function FeedAd() {
  return (
    <aside className="feed-ad" aria-label="Reklamë">
      <span className="feed-ad-label">Sponsorizuar</span>
      <span className="feed-ad-mark" aria-hidden="true">
        383<i>.</i>
      </span>
      <span className="feed-ad-copy">
        <strong>Hapësira juaj këtu</strong>
        <span>Reklamo pranë lajmeve që lexuesit e Kosovës dhe të diasporës i hapin çdo ditë.</span>
      </span>
      <Link href="/kontakt" className="feed-ad-cta">
        Na kontakto <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}

/** The Tregu market that matches the search, as a way to act on the story. */
export function FeedMarket({ title, href, meta }: { title: string; href: string; meta?: string }) {
  return (
    <Link href={href} className="feed-market">
      <span className="feed-market-icon" aria-hidden="true">
        <CoinIcon size={22} />
      </span>
      <span className="feed-market-copy">
        <span className="feed-market-label">Tregu{meta ? ` · ${meta}` : ""}</span>
        <strong>{title}</strong>
      </span>
      <span className="feed-market-cta">
        Hap tregun <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
